import { createReadStream } from 'node:fs'
import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'

export const tools = {
  codex: 'Codex',
  workbuddy: 'WorkBuddy',
  'claude-code': 'Claude Code',
  'claude-ai': 'Claude',
}

// Records that describe the session rather than a moment in it survive any time window.
const always = new Set([
  'session_meta',
  'turn_context',
  'world_state',
  'api-request-shape',
  'custom-title',
  'ai-title',
  'summary',
])

function isInitialContextRecord(record) {
  if (!record || typeof record !== 'object') return false
  if (always.has(record.type)) return true
  if (record.type === 'attachment' && record.attachment?.type !== 'queued_command') return true
  if (record.type === 'response_item') {
    const p = record.payload || {}
    if (p.type === 'additional_tools') return true
    if (p.type === 'message' && p.role === 'developer') return true
  }
  return false
}

// Split on \n only: node:readline also breaks at U+2028, which appears inside JSON strings.
export async function* lines(input) {
  const decoder = new StringDecoder('utf8')
  let rest = ''
  for await (const chunk of input) {
    rest += decoder.write(chunk)
    let start = 0
    let end
    while ((end = rest.indexOf('\n', start)) >= 0) {
      yield rest.slice(start, end)
      start = end + 1
    }
    rest = rest.slice(start)
  }
  rest += decoder.end()
  if (rest) yield rest
}

export function timeWindow({ from, to } = {}) {
  const start = from ? Date.parse(from) : -Infinity
  const end = to ? Date.parse(to) : Infinity
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`Invalid time window: ${from ?? ''} to ${to ?? ''}`)
  }
  return [start, end]
}

export async function readJsonl(files, { from, to } = {}) {
  const [start, end] = timeWindow({ from, to })
  const records = []
  for (const file of [].concat(files)) {
    let input
    let childErr = null
    if (file.endsWith('.zst')) {
      const child = spawn('zstd', ['-dc', file], { stdio: ['ignore', 'pipe', 'inherit'] })
      child.on('error', err => { childErr = err })
      input = child.stdout
    } else {
      input = createReadStream(file)
    }
    let number = 0
    let fileRecords = 0
    let firstBadLine = 0
    for await (const line of lines(input)) {
      number++
      if (!line.trim()) continue
      let record
      try {
        record = JSON.parse(line)
      } catch {
        if (!firstBadLine) firstBadLine = number
        continue
      }
      fileRecords++
      const time = typeof record.timestamp === 'number' ? record.timestamp : Date.parse(record.timestamp)
      if (Number.isFinite(time) && (time < start || time > end) && !isInitialContextRecord(record)) continue
      records.push(record)
    }
    if (childErr) {
      throw new Error(`Failed to decompress ${file} with zstd: ${childErr.message}`)
    }
    if (firstBadLine && fileRecords === 0) {
      throw new Error(`Invalid JSON at line ${firstBadLine}: ${file}`)
    }
  }
  return records
}

export const attachmentLabel = name => (/\.(png|jpe?g|webp|gif|heic)$/i.test(name) ? '[附图]' : `[附件：${name}]`)

export function parseArguments(text) {
  try {
    return typeof text === 'string' ? JSON.parse(text) : text
  } catch {
    return text
  }
}

export function isoTime(value) {
  if (value === undefined || value === null || value === '') return undefined
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function mentions(text) {
  const files = []
  const request = String(text)
    .replace(/(^|\s)@(?:"([^"]+)"|(~?[/\\][^\s"]+))/g, (whole, space, quoted, bare) => {
      const name = (quoted || bare).split(/[/\\]/).pop()
      files.push(attachmentLabel(name))
      return space === '\n' ? space : ''
    })
    .replace(/@skill:\S*?\/([\w-]+)\/SKILL\.md(?: ([A-Z][\w-]*(?: [A-Z][\w-]*)*))?/g, (whole, name, label) => (
      label && label.toLowerCase().replace(/ /g, '-') !== name.toLowerCase() ? `@${name} ${label}` : `@${name}`))
    .trim()
  return [request, ...files].filter(Boolean).join('\n\n')
}

export function stripInjected(text) {
  return String(text ?? '')
    .replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<(local-command-caveat|local-command-stdout|local-command-stderr|bash-stdout|bash-stderr|ide_opened_file|ide_selection|user-prompt-submit-hook)>[\s\S]*?<\/\1>/g, '')
    .trim()
}

export function imagesOf(content) {
  if (!content || typeof content !== 'object') return []
  if (Array.isArray(content)) return content.flatMap(imagesOf)
  const url = typeof content.image_url === 'string' ? content.image_url : content.image_url?.url
  const data = url?.match(/^data:([\w/+.-]+);base64,(.+)$/s)
  if (data) return [{ mime: data[1], base64: data[2] }]
  if (content.type === 'image' && content.source?.type === 'base64') {
    return [{ mime: content.source.media_type, base64: content.source.data }]
  }
  return Array.isArray(content.content) ? imagesOf(content.content) : []
}

export function textOf(content) {
  if (content === undefined || content === null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(textOf).filter(Boolean).join('\n')
  if (/image/.test(content.type || '')) return '[图片]'
  return content.text ?? content.thinking ?? textOf(content.content)
}

function oneLine(text, length = 80) {
  const line = String(text ?? '').trim().split('\n')[0].replace(/\s+/g, ' ')
  return line.length > length ? `${line.slice(0, length - 1)}…` : line
}

function fileName(path) {
  return String(path ?? '').split(/[/\\]/).filter(Boolean).pop() || ''
}

export function shortUrl(url) {
  try {
    const { hostname, pathname } = new URL(url)
    return oneLine(`${hostname.replace(/^www\./, '')}${pathname === '/' ? '' : pathname}`, 60)
  } catch {
    return oneLine(url, 60)
  }
}

function inputText(input) {
  if (input === undefined || input === null || input === '') return undefined
  return typeof input === 'string' ? input : JSON.stringify(input, null, 2)
}

const toolKinds = {
  WebSearch: 'search', web_search: 'search', WebFetch: 'open', web_fetch: 'open',
  Bash: 'command', shell: 'command', exec_command: 'command', execute_command: 'command', run_command: 'command',
  Read: 'read', read_file: 'read', view: 'read', Glob: 'find', Grep: 'find', LS: 'find', list_dir: 'find',
  Write: 'edit', Edit: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit', apply_patch: 'edit',
  create_file: 'edit', write_file: 'edit', str_replace: 'edit', str_replace_based_edit_tool: 'edit',
  Agent: 'agent', Task: 'agent', Skill: 'skill', start_process: 'command', device_bash: 'command',
  view_image: 'view',
}

const toolNames = {
  TaskCreate: '新建待办', TaskUpdate: '更新待办', TaskList: '查看待办', TodoWrite: '更新待办', ToolSearch: '查找工具',
  SendUserFile: '把文件发给你', get_device_info: '查看你电脑的信息', read_process_output: '读取命令输出',
  device_request_folder_access: '请你允许访问文件夹', device_request_delete_permission: '请你允许删除文件',
  device_stage_files: '准备从你电脑传回文件', device_commit_files: '从你电脑传回文件',
}

const artifactNames = { read: '读取作品页', list: '列出作品', list_assets: '查看作品页里的文件', publish: '发布作品页' }

export function describeTool(name, input = {}) {
  const args = typeof input === 'object' && input !== null ? input : {}
  const base = String(name).split('__').pop()
  const kind = toolKinds[name] || toolKinds[base] || 'other'
  const patchText = typeof input === 'string' ? input : (typeof args.input === 'string' ? args.input : '')
  const patchFiles = [...patchText.matchAll(/\*\*\* (?:Add|Update|Delete) File:\s*([^\n\r\\"]+)/g)]
    .map(match => fileName(match[1].trim()))
    .filter(Boolean)
  const patchMatch = patchFiles[0]
  const path = args.file_path || args.path || args.notebook_path || patchMatch
  const file = fileName(path) || undefined
  const files = patchFiles.length > 1 ? [...new Set(patchFiles)] : undefined
  const cmdText = args.command || args.cmd
  const cmdLine = Array.isArray(cmdText) ? cmdText.join(' ') : cmdText
  const rawSkill = kind === 'skill'
    ? String(args.skill || args.name || '').trim()
    : (String(path || cmdLine || '').match(/(?:^|[/\\])skills[/\\]([\w-]+)[/\\]SKILL\.md\b/)?.[1] || '')
  const skill = rawSkill || undefined
  const summary = {
    search: () => `搜索「${oneLine(args.query || args.q, 60)}」`,
    open: () => `打开 ${shortUrl(args.url || args.ref_id)}`,
    command: () => `运行 ${oneLine(cmdLine)}`,
    read: () => `读取 ${file || ''}`.trim(),
    view: () => `查看 ${file || '图片'}`,
    find: () => `查找 ${oneLine(args.pattern || path, 60)}`,
    edit: () => `${/^(Write|create_file|write_file)$/.test(base) ? '写入' : '修改'} ${file || ''}`.trim(),
    agent: () => `派出子任务：${oneLine(args.description || args.prompt || args.task_name, 40)}`,
    skill: () => `加载技能 ${skill || ''}`.trim(),
    other: () => (
      typeof args.title === 'string' && typeof args.code === 'string'
        ? oneLine(args.title, 80)
        : (base === 'Artifact' ? artifactNames[args.action] || '更新画布' : toolNames[base] || base)
    ),
  }[kind]()
  const shown = kind === 'command'
    ? cmdLine
    : kind === 'agent'
      ? (args.prompt || args.message)
      : kind === 'edit' && typeof (args.content || args.input) === 'string'
        ? (args.content || args.input)
        : input
  const agent = kind === 'agent' ? oneLine(args.description || args.prompt || args.task_name, 40) : undefined
  return { name, kind, summary, input: inputText(shown), stats: { [kind]: 1 }, file, files, skill, agent }
}

export function deriveDefaultTitle(session) {
  if (session.title && String(session.title).trim()) {
    return String(session.title).trim()
  }
  const firstUser = (session.items || []).find(item => item.type === 'user' && item.text && item.text !== '（中途打断）')
  if (firstUser) {
    const clean = String(firstUser.text)
      .replace(/\[(?:附图|图片|附件：[^\]]+)\]/g, '')
      .replace(/\[\$([\w:-]+)\]\([^)]*\)/g, '')
      .replace(/^(?:[$@][\w:-]+\s+)+/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (clean) {
      const firstSentence = clean.split(/[。！？!?\n]/)[0].trim() || clean
      return firstSentence.length > 42 ? `${firstSentence.slice(0, 41)}…` : firstSentence
    }
  }
  return `${tools[session.tool] || 'Agent'} Session`
}

export function cutSession(session, { from, to } = {}) {
  if (!from && !to) return session
  const [start, end] = timeWindow({ from, to })
  const items = session.items.filter(item => {
    const time = Date.parse(item.time)
    return time >= start && time <= end
  })
  if (!items.length) throw new Error('No conversation items found within the specified time window')
  const { tokens: _tokens, ...rest } = session
  return { ...rest, started: items[0].time, ended: items.at(-1).time, items }
}

export function createTranscript() {
  const items = []
  const calls = new Map()
  const add = item => {
    for (const key of Object.keys(item)) if (item[key] === undefined) delete item[key]
    items.push(item)
    return item
  }
  return {
    items,
    user(text, time, { images = [], ...extra } = {}) {
      text = String(text ?? '').trim() || (images.length ? '[图片]' : '')
      if (text) add({ type: 'user', text, time, ...extra, images: images.length ? images : undefined })
    },
    assistant(text, time, { key, ...extra } = {}) {
      text = String(text ?? '').trim()
      if (!text) return
      const last = items.at(-1)
      if (key && last?.type === 'assistant' && last.key === key) last.text += `\n\n${text}`
      else add({ type: 'assistant', text, time, key, ...extra })
    },
    reasoning(text, time) {
      text = String(text ?? '').trim()
      if (text) add({ type: 'reasoning', text, time })
    },
    tool(id, tool, time) {
      const item = add({ type: 'tool', ...tool, time })
      if (id) calls.set(id, item)
      return item
    },
    compact(info, time) {
      return add({ type: 'compact', ...info, time })
    },
    result(id, output, time, images = []) {
      const item = id ? calls.get(id) : items.findLast(entry => entry.type === 'tool' && !entry.output)
      if (!item) return
      if (time) item.done = time
      output = String(output ?? '').trim()
      if (output) item.output = item.output ? `${item.output}\n${output}` : output
      if (images.length) item.images = [...(item.images || []), ...images]
    },
    finish({ tool, model, title, description = '', deliverables = [], tokens, contextWindow, initialContext }) {
      for (const item of items) delete item.key
      const times = items.map(item => item.time).filter(Boolean).sort()
      const session = {
        tool,
        model,
        title,
        description,
        started: times[0],
        ended: times.at(-1),
        tokens,
        contextWindow,
        initialContext,
        deliverables: deliverables.length ? deliverables : undefined,
        items,
      }
      session.title = deriveDefaultTitle(session)
      for (const key of Object.keys(session)) if (session[key] === undefined) delete session[key]
      return session
    },
  }
}
