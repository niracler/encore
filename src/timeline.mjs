import { createTranslator } from './i18n.mjs'

const kinds = {
  search: 'look', open: 'look', read: 'look', find: 'look', view: 'look',
  command: 'make', code: 'make', edit: 'make', skill: 'make', other: 'make',
  agent: 'send', reply: 'back',
}
const order = ['send', 'back', 'look', 'make']
export const waitThreshold = 150
export const binSeconds = 30

function resolveWindowCapacity(tool = 'codex', model = '', contextWindow = 0) {
  if (Number.isFinite(contextWindow) && contextWindow > 0) {
    const label = contextWindow >= 1000000
      ? `${(contextWindow / 1000000).toFixed(1)}M`
      : `${Number((contextWindow / 1000).toFixed(1))}k`
    return { tokens: contextWindow, label }
  }
  const t = String(tool || '').toLowerCase()
  const m = String(model || '').toLowerCase()
  if (
    t.startsWith('claude') ||
    m.includes('claude') ||
    m.includes('opus') ||
    m.includes('sonnet') ||
    m.includes('gpt-6') ||
    m.includes('gpt-5') ||
    m.includes('1m')
  ) {
    return { tokens: 1000000, label: '1.0M' }
  }
  return { tokens: 200000, label: '200k' }
}

export function kindOf(stats = {}, fallbackKind = '') {
  if (fallbackKind && kinds[fallbackKind]) return kinds[fallbackKind]
  const found = Object.keys(stats).map(key => kinds[key] || 'make')
  return order.find(kind => found.includes(kind)) || 'make'
}

function extractSkillNames(item, knownSkills = new Set()) {
  const names = new Set()
  if (typeof item.skill === 'string' && item.skill.trim()) {
    names.add(item.skill.trim())
  } else if (Array.isArray(item.skill)) {
    for (const entry of item.skill) {
      if (typeof entry === 'string' && entry.trim()) names.add(entry.trim())
    }
  }
  const text = `${item.text || ''}\n${item.summary || ''}\n${item.input || ''}`
  const known = new Set([
    ...knownSkills,
    'encore', 'grill-me', 'grilling', 'to-spec', 'to-tickets', 'implement', 'retro',
    'imagegen', 'visualize', 'slides-review', 'slidev', 'presentation-design',
  ])
  for (const match of text.matchAll(/(?:\/|@|\$)([a-z][\w-]{2,})/gi)) {
    const candidate = match[1]
    if (known.has(candidate)) names.add(candidate)
  }
  for (const match of text.matchAll(/加载技能\s+([\w-]+)/g)) names.add(match[1])
  for (const match of text.matchAll(/"skill"\s*:\s*"([\w-]+)"/g)) names.add(match[1])
  for (const match of text.matchAll(/skills\/([\w-]+)\/SKILL\.md/g)) names.add(match[1])
  return [...names]
}

function extractFileChips(work) {
  const tools = []
  const changes = []
  const memories = []
  const pushTarget = (rawTarget, isEdit) => {
    const target = String(rawTarget || '').trim().split(/[/\\]/).pop()
    if (!target) return
    if (/AGENTS\.md|CLAUDE\.md|memory/i.test(target)) memories.push(target)
    else tools.push(target)
    if (isEdit) changes.push(target)
  }
  for (const item of work) {
    const isEdit = Boolean(item.kind === 'edit' || item.stats?.edit)
    const explicitFiles = [
      ...(typeof item.file === 'string' && item.file.trim() ? [item.file.trim()] : []),
      ...(Array.isArray(item.files) ? item.files : []),
    ]
    const summary = String(item.summary || '')
    const input = String(item.input || '')
    if (explicitFiles.length) {
      for (const f of [...new Set(explicitFiles)]) pushTarget(f, isEdit)
    } else {
      for (const match of summary.matchAll(/(?:读取|写入|修改|查看)\s+([^\s，；,]+)/g)) {
        pushTarget(match[1], summary.startsWith('写入') || summary.startsWith('修改') || isEdit)
      }
      for (const match of input.matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\n\\"]+)/g)) {
        pushTarget(match[1], true)
      }
      for (const match of input.matchAll(/"(?:file_path|path)"\s*:\s*"([^"]+)"/g)) {
        pushTarget(match[1], isEdit)
      }
    }
  }
  if (!tools.length && work[0]?.summary) {
    tools.push(String(work[0].summary).slice(0, 28))
  }
  return { tools, changes, memories }
}

function documentEdits(item) {
  const input = String(item.input || '').trim()
  if (!input) return []
  const isEdit = item.kind === 'edit' || item.stats?.edit
  const summaryFile = String(item.summary || '').match(/^(?:写入|修改|Write|Edit)\s+([^\s、,]+\.md)(?:\s|$)/i)?.[1]
  if (!isEdit && !summaryFile && item.name !== 'apply_patch') return []
  if (!/^\*\*\* Begin Patch\b/.test(input)) {
    const path = isEdit && typeof item.file === 'string' && /\.md$/i.test(item.file.trim())
      ? item.file.trim() : summaryFile
    return path ? [{ path, content: input }] : []
  }

  const edits = []
  let current
  for (const line of input.split(/\r?\n/)) {
    const header = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/)
    if (header) {
      current = undefined
      if (header[1] !== 'Delete') {
        current = { path: header[2].trim(), lines: [] }
        edits.push(current)
      }
    } else if (line === '*** End Patch') {
      break
    } else if (line.startsWith('…（中间省略 ')) {
      // A clipped section may contain a file header. Wait for the next one.
      current = undefined
    } else if (current && line.startsWith('*** Move to: ')) {
      current.path = line.slice('*** Move to: '.length).trim()
    } else if (current && /^[+ ]/.test(line)) {
      current.lines.push(line.slice(1))
    }
  }
  return edits.map(({ path, lines }) => ({ path, content: lines.join('\n').trim() }))
}

function extractStepDocs(toolItems, stepIndex) {
  const byPath = new Map()
  toolItems.forEach((item, idx) => {
    for (const [part, { path, content }] of documentEdits(item).entries()) {
      const file = path.split(/[/\\]/).pop()
      if (!/\.md$/i.test(file) || file.startsWith('_') || /^\d{4}-\d{2}-\d{2}\.md$/.test(file)) continue
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
      const body = fm ? fm[2].trim() : content
      const heading = body.match(/^#{1,3}\s+([^\r\n]+)/m)?.[1]?.replace(/^#+\s*/, '').trim()
      const title = heading || fm?.[1].match(/^\s*title\s*:\s*['"]?([^\r\n'"]+)['"]?\s*$/m)?.[1]?.trim()
      if (!title) continue
      byPath.set(path, {
        id: part ? `doc-${stepIndex}-${idx}-${part}` : `doc-${stepIndex}-${idx}`,
        file,
        title,
        chars: content.length,
        content: body || content,
        t: item.t || 0,
      })
    }
  })
  return [...byPath.values()]
}

function extractStepSubagents(toolItems, stepIndex, t) {
  const list = []
  toolItems.forEach((item, idx) => {
    const rawSum = String(item.summary || '')
    const isSub = Boolean(
      item.kind === 'agent' ||
      item.stats?.agent ||
      item.agent ||
      item.name === 'agent_message' ||
      item.name === 'agent-message' ||
      ((item.kind === 'reply' || item.stats?.reply) && /Agent\s+"|^子任务/.test(rawSum) && !/Background command/i.test(rawSum))
    )
    if (!isSub) return
    const label = (
      item.agent ||
      rawSum
        .replace(/^(?:派出子任务|子任务交回结果|给子任务发消息)[：:\s]*/, '')
        .replace(/^Agent\s+"([^"]+)".*$/, '$1')
        .replace(/\s+交回结果$/, '')
        .trim()
    )
    const isSendMsg = /^(?:send_message|collaboration__send_message)$/.test(item.name || '')
    if (!label || isSendMsg || /^给子任务发消息/.test(rawSum)) return
    const combined = `${rawSum}\n${item.output || ''}`
    const isAsyncSpawn = /^(?:spawn_agent|collaboration__spawn_agent|followup_task|collaboration__followup_task)$/.test(item.name || '')
    let state = 'sent'
    let badge = t('agentSent')
    let report = ''
    if (/was stopped|中途打断|已取消/i.test(combined)) {
      state = 'stopped'
      badge = t('agentStopped')
    } else if (/failed:|terminated early|rate_limit|hit your session limit|^Error:\s*Failed/im.test(combined)) {
      state = 'failed'
      badge = /limit|429/i.test(combined) ? t('agentRateLimited') : t('agentFailed')
    } else if (item.kind === 'reply' || item.stats?.reply || (!isAsyncSpawn && item.output && item.output.length > 80 && !item.output.trim().startsWith('{'))) {
      state = 'done'
      badge = t('agentDone')
      if (item.output && item.output.length > 40 && !item.output.trim().startsWith('{')) {
        report = String(item.output).trim()
      }
    }
    list.push({
      id: `sub-${stepIndex}-${idx}`,
      label,
      state,
      badge,
      ...(report ? { report } : {}),
    })
  })
  return list
}

function extractStepAudios(toolItems, t) {
  const list = []
  for (const item of toolItems) {
    for (const clip of item.audio || []) {
      list.push({ src: clip.src, label: clip.label || t('defaultAudioClip'), t: item.t || 0 })
    }
  }
  return list
}

function uniqueRecent(list, limit = 6) {
  return [...new Set(list.filter(Boolean))].slice(-limit)
}

function defaultSystemPrompts(toolName) {
  if (toolName === 'claude-code' || toolName === 'claude-ai') {
    return [
      {
        id: 'sys-core',
        stepIndex: -1,
        tokEst: 3400,
        tag: 'Core',
        title: 'Claude System Prompt · Core Identity & Task Loop',
        meta: '≈3.4k · Initial',
        payload: `You are Claude Code, Anthropic's agentic coding environment.\n\n# Doing tasks\n- Read and understand existing files before proposing modifications.\n- Prefer minimal, root-cause changes that follow repository conventions.\n- Verify changes with tests or build scripts when available.`,
      },
      {
        id: 'sys-safety',
        stepIndex: -1,
        tokEst: 2700,
        tag: 'Safety',
        title: 'Git, Sandbox & Verification Discipline',
        meta: '≈2.7k · Initial',
        payload: `# Tool & Git Safety\n- Never commit, push, or deploy unless explicitly instructed by the user.\n- Respect workspace boundaries and avoid destructive git commands.`,
      },
    ]
  }
  if (toolName === 'workbuddy') {
    return [
      {
        id: 'sys-core',
        stepIndex: -1,
        tokEst: 3200,
        tag: 'Core',
        title: 'WorkBuddy Desktop Agent · Core Role & Execution Rules',
        meta: '≈3.2k · Initial',
        payload: `You are WorkBuddy, a desktop agent bound to the active local workspace directory.\n\n# Core Responsibilities\n1. Search and read workspace documents, spreadsheets, PDFs, and images on demand; ground answers in primary sources.\n2. Decompose complex research into parallel sub-tasks and synthesize verified deliverables.\n3. Confirm with the user before overwriting formal documents or sending external messages.`,
      },
      {
        id: 'sys-workspace',
        stepIndex: -1,
        tokEst: 1800,
        tag: 'Workspace',
        title: 'Workspace File I/O & Deliverable Conventions',
        meta: '≈1.8k · Initial',
        payload: `# Workspace Conventions\n- Inspect directory structure and project notes before modifying files.\n- Save intermediate drafts, tables, and final reports under the designated workspace path.`,
      },
    ]
  }
  return [
    {
      id: 'sys-core',
      stepIndex: -1,
      tokEst: 3500,
      tag: 'Core',
      title: 'Codex System Instructions · Agent Loop & Precision',
      meta: '≈3.5k · Initial',
      payload: `You are a coding agent running in Codex.\n\n# How you work\n- Fix problems at the root cause rather than surface-level patches.\n- Keep changes minimal and consistent with the existing codebase.`,
    },
    {
      id: 'sys-sandbox',
      stepIndex: -1,
      tokEst: 2600,
      tag: 'Sandbox',
      title: 'Sandbox, Approvals & Multi-Agent Coordination',
      meta: '≈2.6k · Initial',
      payload: `# Sandbox & Approvals\n- Obey all instructions in scoped AGENTS.md files.\n- Coordinate sub-agents cleanly when delegating parallel subtasks.`,
    },
  ]
}

function defaultToolSchemas(toolName) {
  if (toolName === 'claude-code' || toolName === 'claude-ai') {
    return [
      { id: 'schema-bash', stepIndex: -1, tokEst: 1800, tag: 'Schema', title: 'Bash · Execute Shell Command', meta: '≈1.8k · Schema', payload: '{\n  "name": "Bash",\n  "input_schema": { "command": "string", "description": "string" }\n}' },
      { id: 'schema-read-edit', stepIndex: -1, tokEst: 2400, tag: 'Schema', title: 'Read / Edit / Write · File Operations', meta: '≈2.4k · Schema', payload: '{\n  "tools": ["Read", "Edit", "Write"]\n}' },
      { id: 'schema-search', stepIndex: -1, tokEst: 1900, tag: 'Schema', title: 'Grep / Glob / WebSearch · Search & Discovery', meta: '≈1.9k · Schema', payload: '{\n  "tools": ["Grep", "Glob", "WebSearch", "WebFetch"]\n}' },
      { id: 'schema-agent-skill', stepIndex: -1, tokEst: 2000, tag: 'Schema', title: 'Agent / Skill / TodoWrite · Delegation & Skills', meta: '≈2.0k · Schema', payload: '{\n  "tools": ["Agent", "Skill", "TodoWrite"]\n}' },
    ]
  }
  if (toolName === 'workbuddy') {
    return [
      { id: 'schema-wb-read', stepIndex: -1, tokEst: 1800, tag: 'Schema', title: 'read_file / list_dir · Workspace Document Reader', meta: '≈1.8k · Schema', payload: '{\n  "tools": ["read_file", "list_dir"]\n}' },
      { id: 'schema-wb-write', stepIndex: -1, tokEst: 1900, tag: 'Schema', title: 'write_file / edit_file · Deliverable & Note Writer', meta: '≈1.9k · Schema', payload: '{\n  "tools": ["write_file", "edit_file"]\n}' },
      { id: 'schema-wb-web', stepIndex: -1, tokEst: 2000, tag: 'Schema', title: 'web_search / run_command · Web Research & Scripts', meta: '≈2.0k · Schema', payload: '{\n  "tools": ["web_search", "run_command"]\n}' },
      { id: 'schema-wb-agent', stepIndex: -1, tokEst: 2100, tag: 'Schema', title: 'Agent · Parallel Research Sub-tasks', meta: '≈2.1k · Schema', payload: '{\n  "tools": ["Agent"]\n}' },
    ]
  }
  return [
    { id: 'schema-exec', stepIndex: -1, tokEst: 2200, tag: 'Schema', title: 'exec_command / write_stdin · Shell Execution', meta: '≈2.2k · Schema', payload: '{\n  "name": "exec_command",\n  "parameters": { "cmd": "string", "workdir": "string" }\n}' },
    { id: 'schema-patch', stepIndex: -1, tokEst: 2100, tag: 'Schema', title: 'apply_patch · Freeform File Patching', meta: '≈2.1k · Schema', payload: '{\n  "name": "apply_patch",\n  "grammar": "*** Begin Patch ... *** End Patch"\n}' },
    { id: 'schema-web', stepIndex: -1, tokEst: 1800, tag: 'Schema', title: 'web_search / view_image · Multimodal & Web', meta: '≈1.8k · Schema', payload: '{\n  "tools": ["web_search", "view_image"]\n}' },
    { id: 'schema-collab', stepIndex: -1, tokEst: 2000, tag: 'Schema', title: 'spawn_agent / wait_agent · Multi-Agent Fleet', meta: '≈2.0k · Schema', payload: '{\n  "tools": ["spawn_agent", "followup_task", "send_message", "wait_agent"]\n}' },
  ]
}

function defaultInjectedContext(toolName, sessionStart) {
  const dateStr = sessionStart ? String(sessionStart).slice(0, 10) : '2026-10-10'
  return [
    {
      id: 'mem-agents',
      stepIndex: -1,
      tokEst: 2100,
      tag: 'AGENTS.md',
      title: 'AGENTS.md · Workspace Collaboration & Code Rules',
      meta: '≈2.1k · Auto-mounted',
      payload: `# AGENTS.md\n\n## 1 按需读取路由\n- Read only task-relevant docs and modules.\n- Follow repository conventions and verify changes before finishing.\n\n## 3 Git 与发布\n- Use Conventional Commits.\n- Only commit or deploy when explicitly requested.`,
    },
    {
      id: 'mem-profile',
      stepIndex: -1,
      tokEst: 1100,
      tag: 'Env',
      title: `<environment_context> · Runtime & Workspace (${dateStr})`,
      meta: '≈1.1k · Auto-mounted',
      payload: `<environment_context>\n  <tool>${toolName || 'codex'}</tool>\n  <date>${dateStr}</date>\n</environment_context>`,
    },
  ]
}

function defaultSkillCatalog() {
  return [
    {
      id: 'skill-catalog-init',
      stepIndex: -1,
      tokEst: 1200,
      tag: 'Catalog',
      title: 'skill_listing · Installed Skills Index',
      meta: '≈1.2k · Index',
      payload: '# Installed Skills Index\n- encore: Curate and polish AI agent session replays\n- grill-me: Relentless interview to sharpen a plan or design\n- slides-review: Chapter-by-chapter slide review workflow',
    },
  ]
}

const DEFERRED_SCHEMA_TEMPLATES = {
  WebSearch: { tag: 'Deferred', title: 'WebSearch · Live Web Search', payload: '{\n  "name": "WebSearch",\n  "input_schema": { "query": "string" }\n}' },
  WebFetch: { tag: 'Deferred', title: 'WebFetch · Web Page Extraction', payload: '{\n  "name": "WebFetch",\n  "input_schema": { "url": "string", "prompt": "string" }\n}' },
  NotebookEdit: { tag: 'Deferred', title: 'NotebookEdit · Jupyter Cell Editor', payload: '{\n  "name": "NotebookEdit",\n  "input_schema": { "notebook_path": "string", "new_source": "string" }\n}' },
  AskUserQuestion: { tag: 'Deferred', title: 'AskUserQuestion · Structured User Prompt', payload: '{\n  "name": "AskUserQuestion",\n  "input_schema": { "questions": "array" }\n}' },
}

function resolveDynamicSchema(toolItem, stepIndex, existingIds) {
  const name = String(toolItem.name || '').trim()
  if (!name) return null
  const normId = `schema-dyn-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  if (existingIds.has(normId)) return null
  if (DEFERRED_SCHEMA_TEMPLATES[name]) {
    const tpl = DEFERRED_SCHEMA_TEMPLATES[name]
    return {
      id: normId,
      stepIndex,
      tokEst: 750,
      tag: tpl.tag,
      title: tpl.title,
      meta: '≈0.8k · Dynamic',
      payload: tpl.payload,
    }
  }
  if (name.startsWith('mcp__')) {
    const parts = name.replace(/^mcp__/, '').split('__')
    const server = parts[0] || 'mcp'
    const method = parts.slice(1).join('.') || name
    return {
      id: normId,
      stepIndex,
      tokEst: 850,
      tag: 'MCP',
      title: `${server} · ${method} (MCP Tool)`,
      meta: '≈0.9k · Dynamic',
      payload: `{\n  "mcp_server": "${server}",\n  "tool": "${method}",\n  "sample_input": ${JSON.stringify(toolItem.input ? String(toolItem.input).slice(0, 260) : '{}')}\n}`,
    }
  }
  return null
}

function assignFramesToGroups(rawGroups, frames = [], t) {
  const map = new Map()
  if (!rawGroups.length || !frames.length) return map
  let refIdx = 0
  let aiIdx = 0
  for (const frame of frames) {
    let bestIdx = -1
    let bestDiff = Infinity
    rawGroups.forEach((g, gIdx) => {
      for (const it of g.items) {
        if (it.images?.includes(frame.img)) {
          const diff = Math.abs((it.t || 0) - (frame.t || 0))
          if (diff < bestDiff) {
            bestDiff = diff
            bestIdx = gIdx
          }
        }
      }
    })
    if (bestIdx < 0) {
      for (let gIdx = rawGroups.length - 1; gIdx >= 0; gIdx--) {
        const gStart = rawGroups[gIdx].items[0]?.t ?? 0
        if (gStart <= (frame.t || 0) + 0.5) {
          bestIdx = gIdx
          if (frame.who === 'ai' && rawGroups[gIdx].groupType === 'user' && gIdx + 1 < rawGroups.length) {
            bestIdx = gIdx + 1
          }
          break
        }
      }
    }
    if (bestIdx < 0) bestIdx = 0
    if (!map.has(bestIdx)) map.set(bestIdx, [])
    const who = frame.who || 'ai'
    const fallbackLabel = who === 'you'
      ? t('defaultRefFrame', { n: ++refIdx })
      : t('defaultAiFrame', { n: ++aiIdx })
    map.get(bestIdx).push({
      img: frame.img,
      label: (frame.label && String(frame.label).trim()) ? String(frame.label).trim() : fallbackLabel,
      who,
      t: frame.t || 0,
      ...(frame.w ? { w: frame.w } : {}),
      ...(frame.h ? { h: frame.h } : {}),
    })
  }
  return map
}

function buildSteps(items, end, sessionTool = 'codex', sessionModel = '', frames = [], sessionStart = '', sessionMeta = {}, t) {
  const windowSpec = resolveWindowCapacity(sessionTool, sessionModel, sessionMeta.contextWindow)
  const initCtx = sessionMeta.initialContext || {}
  const rawGroups = []
  let work = []
  const flushWork = () => {
    if (!work.length) return
    const toolItems = work.filter(item => item.type === 'tool')
    const reasoningItems = work.filter(item => item.type === 'reasoning' && String(item.text || '').trim())
    if (toolItems.length || reasoningItems.length) rawGroups.push({ groupType: 'work', items: [...work] })
    work = []
  }
  for (const item of items) {
    if (item.type === 'tool' || item.type === 'reasoning') {
      if (item.deliverables?.length) flushWork()
      work.push(item)
      if (item.deliverables?.length) flushWork()
      continue
    }
    flushWork()
    rawGroups.push({ groupType: item.type, items: [item] })
  }
  flushWork()
  const framesByGroup = assignFramesToGroups(rawGroups, frames, t)

  const contextRecords = {}
  const registerRecord = rec => {
    const entry = { ...rec, stepIndex: rec.stepIndex ?? -1 }
    contextRecords[rec.id] = {
      id: rec.id,
      tag: rec.tag || '',
      title: rec.title,
      meta: rec.meta,
      payload: rec.payload,
      ...(rec.images?.length ? { images: rec.images } : {}),
    }
    return entry
  }

  // Antigravity transcripts contain observed steps, with no initial prompt or tool inventory.
  const observedOnly = sessionTool.startsWith('antigravity')
  function initialRecords(key, defaults) {
    const records = initCtx[key] || []
    const entries = records.length || observedOnly ? records : defaults(sessionTool, sessionStart)
    return entries.map(record => registerRecord({ ...record, stepIndex: -1 }))
  }
  const sysRecords = initialRecords('sys', defaultSystemPrompts)
  const schemaRecords = initialRecords('schema', defaultToolSchemas)
  const schemaIdSet = new Set(schemaRecords.map(r => r.id))
  for (const r of schemaRecords) if (r.title) schemaIdSet.add(`schema-dyn-${String(r.title).replace(/[^a-zA-Z0-9_-]/g, '_')}`)
  const userRecords = []
  let toolRecords = []
  const skillRecords = initialRecords('skill', defaultSkillCatalog)
  const knownSkillNames = new Set(skillRecords.map(r => r.title).filter(Boolean))
  const msgRecords = []
  const memRecords = initialRecords('mem', defaultInjectedContext)

  const sumTokEst = list => list.reduce((acc, r) => acc + (r.tokEst || 600), 0)
  const sysTokens = sumTokEst(sysRecords)
  let schemaTokens = sumTokEst(schemaRecords)
  let userTokens = 0
  let msgTokens = 0
  let toolTokens = 0
  let skillTokens = sumTokEst(skillRecords)
  let memTokens = sumTokEst(memRecords)
  let mountScale = 1
  let lastRealTotal = 0
  let uncalibratedDelta = 0
  const allTools = []
  const allSkills = []
  const allMemories = observedOnly ? [] : ['AGENTS.md']
  const allChanges = []
  let latestUserPrompt = ''
  let toolSeq = 0
  let msgSeq = 0
  let userSeq = 0
  let compactSeq = 0
  let turnCount = 0

  const computeDisplayBuckets = () => {
    let dSys = Math.round(sysTokens * mountScale)
    let dSchema = Math.round(schemaTokens * mountScale)
    let dMem = Math.round(memTokens * mountScale)
    let dSkill = Math.round(skillTokens * mountScale)
    let dUser = userTokens
    let dMsg = msgTokens
    let dTool = toolTokens
    if (lastRealTotal > 0) {
      const target = lastRealTotal + uncalibratedDelta
      const fixed = dSys + dSchema + dMem + dSkill
      const dyn = dUser + dMsg + dTool
      if (target >= fixed && dyn > 0) {
        const k = (target - fixed) / dyn
        dUser = Math.round(dUser * k)
        dMsg = Math.round(dMsg * k)
        dTool = Math.max(0, target - fixed - dUser - dMsg)
      } else if (target > 0 && fixed + dyn > 0) {
        const k = target / (fixed + dyn)
        dSys = Math.round(dSys * k)
        dSchema = Math.round(dSchema * k)
        dMem = Math.round(dMem * k)
        dSkill = Math.round(dSkill * k)
        dUser = Math.round(dUser * k)
        dMsg = Math.round(dMsg * k)
        dTool = Math.max(0, target - dSys - dSchema - dMem - dSkill - dUser - dMsg)
      }
    }
    return { sys: dSys, schema: dSchema, user: dUser, mem: dMem, skill: dSkill, msg: dMsg, tool: dTool }
  }

  const assembleCategoryList = (stepIdx, countsBefore, toksBefore, disp) => {
    const curTotal = disp.sys + disp.schema + disp.user + disp.mem + disp.msg + disp.tool + disp.skill
    const kindPct = value => Math.round((value / Math.max(1, curTotal)) * 100)
    const fmtTokDelta = (cur, prev) => {
      const diff = cur - prev
      if (diff >= 100) return `+${(diff / 1000).toFixed(1)}k`
      if (diff <= -100) return `${(diff / 1000).toFixed(1)}k`
      return ''
    }
    const fmtCountDelta = (cur, prev) => {
      if (cur > prev) return `+${cur - prev}`
      if (cur < prev) return `${cur - prev}`
      return ''
    }
    const makeCat = (id, name, color, records, curTok, prevCount, prevTok) => {
      const itemIds = records.map(r => r.id).reverse()
      const newIds = stepIdx >= 0 ? records.filter(r => r.stepIndex === stepIdx).map(r => r.id) : []
      const newSet = new Set(newIds)
      return {
        id,
        name,
        color,
        itemCount: records.length,
        count: t('itemCount', { n: records.length }),
        tok: `≈${(curTok / 1000).toFixed(1)}k`,
        pct: `${kindPct(curTok)}%`,
        delta: stepIdx >= 0 ? fmtCountDelta(records.length, prevCount) : '',
        tokDelta: stepIdx >= 0 ? fmtTokDelta(curTok, prevTok) : '',
        itemIds,
        newIds,
        items: itemIds.map(rid => ({ ...contextRecords[rid], isNew: newSet.has(rid) })),
      }
    }
    return [
      makeCat('sys', t('catSys'), 'sys', sysRecords, disp.sys, countsBefore.sys, toksBefore.sys),
      makeCat('schema', t('catSchema'), 'schema', schemaRecords, disp.schema, countsBefore.schema, toksBefore.schema),
      makeCat('user', t('catUser'), 'user', userRecords, disp.user, countsBefore.user, toksBefore.user),
      makeCat('mem', t('catMem'), 'mem', memRecords, disp.mem, countsBefore.mem, toksBefore.mem),
      makeCat('skill', t('catSkill'), 'skill', skillRecords, disp.skill, countsBefore.skill, toksBefore.skill),
      makeCat('msg', t('catMsg'), 'msg', msgRecords, disp.msg, countsBefore.msg, toksBefore.msg),
      makeCat('tool', t('catTool'), 'tool', toolRecords, disp.tool, countsBefore.tool, toksBefore.tool),
    ]
  }

  let prevDisp = computeDisplayBuckets()
  const initTotal = prevDisp.sys + prevDisp.schema + prevDisp.user + prevDisp.mem + prevDisp.skill + prevDisp.msg + prevDisp.tool
  const initCap = Math.max(windowSpec.tokens, Math.ceil(initTotal * 1.25))
  const initCapPct = val => (val <= 0 ? 0 : Number((Math.max(0.4, (val / initCap) * 100)).toFixed(2)))
  const initKindPct = val => Math.round((val / Math.max(1, initTotal)) * 100)
  const zeroCounts = {
    sys: sysRecords.length,
    schema: schemaRecords.length,
    user: 0,
    mem: memRecords.length,
    skill: skillRecords.length,
    msg: 0,
    tool: 0,
  }
  const initialSnapshot = {
    pct: Number(Math.min(99, (initTotal / initCap) * 100).toFixed(1)),
    windowTokens: windowSpec.tokens,
    windowLabel: windowSpec.label,
    totalTokens: initTotal,
    deltaTokens: 0,
    segments: {
      sys: initCapPct(prevDisp.sys),
      schema: initCapPct(prevDisp.schema),
      user: 0,
      mem: initCapPct(prevDisp.mem),
      skill: initCapPct(prevDisp.skill),
      msg: 0,
      tool: 0,
    },
    pctByKind: {
      sys: initKindPct(prevDisp.sys),
      schema: initKindPct(prevDisp.schema),
      user: 0,
      mem: initKindPct(prevDisp.mem),
      skill: initKindPct(prevDisp.skill),
      msg: 0,
      tool: 0,
    },
    tokensByKind: { ...prevDisp },
    categories: assembleCategoryList(-1, zeroCounts, prevDisp, prevDisp),
  }

  const steps = rawGroups.map((group, index) => {
    const first = group.items[0]
    const last = group.items.at(-1)
    const stepTime = first.t ?? 0
    const stepEnd = Math.max(stepTime, last.d ?? last.t ?? stepTime)
    const prevTotal = prevDisp.sys + prevDisp.schema + prevDisp.user + prevDisp.mem + prevDisp.skill + prevDisp.msg + prevDisp.tool
    const prevCounts = {
      sys: sysRecords.length,
      schema: schemaRecords.length,
      user: userRecords.length,
      mem: memRecords.length,
      skill: skillRecords.length,
      msg: msgRecords.length,
      tool: toolRecords.length,
    }
    const prevToks = { ...prevDisp }

    let kind = 'reply'
    let primaryCat = 'msg'
    let speedLabel = '1.0×'
    let dwellMs = 1500
    let spotlight = 'none'
    let detailTitle = ''
    let detailSnippet = ''
    let inBrief = ''
    let responseBrief = ''
    let stepDeltaTools = 0
    let stepEstimatedDelta = 0
    let montageFrames = []
    let compactInfo = null
    const stepFrames = framesByGroup.get(index) || []
    let stepDocs = []
    let stepSubagents = []
    let stepAudios = []

    if (group.groupType === 'user') {
      turnCount++
      userSeq++
      const cleanPromptText = (first.text || '').replace(/\s+/g, ' ').trim()
      latestUserPrompt = cleanPromptText.slice(0, 90)
      const userTok = Math.max(180, Math.round((first.text || '').length * 1.4)) + (first.images?.length ? first.images.length * 800 : 0)
      userTokens += userTok
      stepEstimatedDelta += userTok
      userRecords.push(registerRecord({
        id: `user-${userSeq}`,
        stepIndex: index,
        tokEst: userTok,
        tag: t('turnTag', { n: turnCount }),
        title: cleanPromptText.slice(0, 56) || t('userMessage'),
        meta: `≈${(userTok / 1000).toFixed(1)}k · ${stepTime}s`,
        payload: String(first.text || ''),
        ...(first.images?.length ? { images: first.images } : {}),
      }))
      for (const skill of extractSkillNames(first, knownSkillNames)) {
        if (!allSkills.includes(skill)) {
          allSkills.push(skill)
          const skTok = 1800
          skillTokens += skTok
          stepEstimatedDelta += skTok
          skillRecords.push(registerRecord({
            id: `skill-${skill}-${index}`,
            stepIndex: index,
            tokEst: skTok,
            tag: 'SKILL.md',
            title: `${skill}/SKILL.md`,
            meta: `≈${(skTok / 1000).toFixed(1)}k · ${t('turnTag', { n: turnCount })}`,
            payload: `# ${skill} (SKILL.md)\nLoaded into active context.`,
          }))
        }
      }
      kind = 'prompt'
      primaryCat = 'user'
      speedLabel = '1.0×'
      dwellMs = 1500
      detailTitle = t('promptTitle', { n: turnCount })
      detailSnippet = (first.text || '').slice(0, 260)
      inBrief = t('appendedPrompt')
      responseBrief = t('waitingForTools')
    } else if (group.groupType === 'compact') {
      compactSeq++
      const cItem = first
      const preTokens = cItem.preTokens || prevTotal
      const archivedTools = toolRecords.length
      const postTokens = cItem.postTokens || Math.min(preTokens, Math.max(24000, Math.round(preTokens * 0.28)))
      const droppedTokens = cItem.droppedTokens || Math.max(0, preTokens - postTokens)
      const summaryText = String(cItem.text || cItem.summary || 'Context Compaction Summary').trim()
      const sumTok = Math.max(1200, Math.round(summaryText.length * 0.35))
      const docId = `compact-doc-${index}`
      const recId = `compact-summary-${compactSeq}`

      toolRecords = []
      toolTokens = 0
      userTokens = Math.round(userTokens * 0.35)
      msgTokens = Math.round(msgTokens * 0.25)
      memTokens += sumTok
      lastRealTotal = postTokens
      uncalibratedDelta = 0
      const rawFixed = sysTokens + schemaTokens + memTokens + skillTokens
      if (postTokens > 0 && rawFixed > postTokens * 0.85) {
        mountScale = (postTokens * 0.72) / rawFixed
      }

      memRecords.push(registerRecord({
        id: recId,
        stepIndex: index,
        tokEst: sumTok,
        tag: 'Compact',
        title: `${t('compactTitle', { seq: cItem.seq || compactSeq })} (${(preTokens / 1000).toFixed(1)}k → ${(postTokens / 1000).toFixed(1)}k)`,
        meta: `-${(droppedTokens / 1000).toFixed(1)}k tok · ${stepTime}s`,
        payload: summaryText,
      }))

      compactInfo = {
        seq: cItem.seq || compactSeq,
        trigger: cItem.trigger || 'auto',
        preTokens,
        postTokens,
        droppedTokens,
        archivedTools,
        docId,
        recId,
        title: cItem.summary || t('compactTitle', { seq: cItem.seq || compactSeq }),
        content: summaryText,
      }

      kind = 'compact'
      primaryCat = 'mem'
      speedLabel = '0.8×'
      dwellMs = 2100
      spotlight = 'context-compact'
      detailTitle = t('compactTitle', { seq: compactInfo.seq })
      detailSnippet = summaryText.slice(0, 260)
      inBrief = `${(preTokens / 1000).toFixed(1)}k → ${(postTokens / 1000).toFixed(1)}k`
      responseBrief = t('archivedTools', { n: archivedTools, tokens: (droppedTokens / 1000).toFixed(1) })
    } else if (group.groupType === 'assistant') {
      msgSeq++
      const cleanReply = (first.text || '').replace(/\s+/g, ' ').trim()
      const msgTok = Math.max(240, Math.round((first.text || '').length * 1.4))
      msgTokens += msgTok
      stepEstimatedDelta += msgTok
      msgRecords.push(registerRecord({
        id: `msg-${msgSeq}`,
        stepIndex: index,
        tokEst: msgTok,
        tag: t('replyTag', { n: msgSeq }),
        title: cleanReply.slice(0, 56) || t('assistantReply'),
        meta: `≈${(msgTok / 1000).toFixed(1)}k · ${stepTime}s`,
        payload: String(first.text || ''),
      }))
      if (first.contextTokens > 0) {
        lastRealTotal = first.contextTokens
        uncalibratedDelta = 0
      } else if (lastRealTotal > 0) {
        uncalibratedDelta += stepEstimatedDelta
      }
      kind = 'reply'
      primaryCat = 'msg'
      speedLabel = '1.0×'
      dwellMs = 1750
      detailTitle = t('assistantReply')
      detailSnippet = (first.text || '').slice(0, 260)
      inBrief = allTools.length ? t('synthesizing', { tools: allTools.slice(-2).join(', ') }) : t('directResponse')
      responseBrief = cleanReply.slice(0, 96) || t('completedResponse')
    } else {
      const toolItems = group.items.filter(item => item.type === 'tool')
      const reasoningItems = group.items.filter(item => item.type === 'reasoning')
      const stats = sumStats(toolItems)
      const extracted = extractFileChips(toolItems)
      stepDocs = extractStepDocs(toolItems, index)
      stepSubagents = extractStepSubagents(toolItems, index, t)
      stepAudios = extractStepAudios(toolItems, t)
      allTools.push(...extracted.tools)
      allChanges.push(...extracted.changes)

      for (const memName of extracted.memories) {
        if (!allMemories.includes(memName)) {
          allMemories.push(memName)
          const memTok = 1100
          memTokens += memTok
          stepEstimatedDelta += memTok
          memRecords.push(registerRecord({
            id: `mem-dyn-${memRecords.length + 1}`,
            stepIndex: index,
            tokEst: memTok,
            tag: t('rule'),
            title: `${memName}`,
            meta: `≈${(memTok / 1000).toFixed(1)}k · ${t('stepTag', { n: index + 1 })}`,
            payload: `# ${memName}\nLoaded into context during step ${index + 1}.`,
          }))
        }
      }

      for (const rItem of reasoningItems) {
        if (!rItem.text) continue
        msgSeq++
        const rTok = Math.max(160, Math.round(rItem.text.length * 1.1))
        msgTokens += rTok
        stepEstimatedDelta += rTok
        msgRecords.push(registerRecord({
          id: `think-${msgSeq}`,
          stepIndex: index,
          tokEst: rTok,
          tag: t('thinking'),
          title: rItem.text.replace(/\s+/g, ' ').trim().slice(0, 54),
          meta: `≈${(rTok / 1000).toFixed(1)}k · ${t('reasoning')}`,
          payload: String(rItem.text),
        }))
      }

      const rawMontage = []
      for (const item of toolItems) {
        const dynSchema = resolveDynamicSchema(item, index, schemaIdSet)
        if (dynSchema) {
          schemaIdSet.add(dynSchema.id)
          schemaTokens += dynSchema.tokEst
          stepEstimatedDelta += dynSchema.tokEst
          schemaRecords.push(registerRecord(dynSchema))
        }
        for (const skill of extractSkillNames(item, knownSkillNames)) {
          if (!allSkills.includes(skill)) {
            allSkills.push(skill)
            const skTok = 1800
            skillTokens += skTok
            stepEstimatedDelta += skTok
            skillRecords.push(registerRecord({
              id: `skill-${skill}-${index}`,
              stepIndex: index,
              tokEst: skTok,
              tag: 'SKILL.md',
              title: `${skill}/SKILL.md`,
              meta: `≈${(skTok / 1000).toFixed(1)}k · ${t('stepTag', { n: index + 1 })}`,
              payload: String(item.output || item.input || `# ${skill} (SKILL.md)`),
            }))
          }
        }
        toolSeq++
        const ioLen = (item.input?.length || 0) + (item.output?.length || 0)
        const itemTok = Math.max(280, Math.min(9000, Math.round(ioLen * 0.48) + 280))
        stepDeltaTools += itemTok
        const parts = []
        if (item.input) parts.push(`--- Input (${item.name || 'tool'}) ---\n${item.input}`)
        if (item.output) parts.push(`--- Output ---\n${item.output}`)
        if (!parts.length) parts.push(item.summary || item.name || 'Tool execution')
        const cleanSum = (item.summary || item.name || 'Tool').replace(/\s+/g, ' ').trim()
        const toolTag = item.name || 'Tool'
        toolRecords.push(registerRecord({
          id: `tool-${toolSeq}`,
          stepIndex: index,
          tokEst: itemTok,
          tag: toolTag,
          title: cleanSum.slice(0, 56),
          meta: `≈${(itemTok / 1000).toFixed(1)}k tok`,
          payload: parts.join('\n\n'),
          ...(item.images?.length ? { images: item.images } : {}),
        }))
        const isSpot = Boolean(item.kind === 'edit' || item.kind === 'skill' || item.stats?.edit || item.stats?.skill)
        rawMontage.push({
          tag: toolTag,
          title: cleanSum.slice(0, 56),
          isSpot,
          speed: isSpot ? '🎯 0.8×' : toolItems.length > 1 ? '⚡ 12×' : '1.0×',
        })
      }
      for (const fr of stepFrames.filter(f => f.who === 'ai')) {
        const alreadyAttached = toolItems.some(it => it.images?.includes(fr.img))
        if (!alreadyAttached) {
          stepDeltaTools += 1200
          toolRecords.push(registerRecord({
            id: `frame-${++toolSeq}`,
            stepIndex: index,
            tag: t('preview'),
            title: `${fr.label}`,
            meta: '≈1.2k tok',
            payload: `Preview frame: ${fr.label}`,
            images: [fr.img],
          }))
        }
        rawMontage.push({
          tag: t('preview'),
          title: `${fr.label}`,
          isSpot: true,
          speed: '🖼',
        })
      }
      for (const doc of stepDocs) {
        rawMontage.push({
          tag: t('draft'),
          title: `${doc.title}`,
          isSpot: true,
          speed: '📄',
        })
      }
      if (rawMontage.length <= 5) {
        montageFrames = rawMontage
      } else {
        const spots = rawMontage.filter(f => f.isSpot).slice(0, 3)
        const others = rawMontage.filter(f => !f.isSpot)
        const stepStride = Math.max(1, Math.floor(others.length / (5 - spots.length)))
        const sampled = others.filter((_, idx) => idx % stepStride === 0).slice(0, 5 - spots.length)
        montageFrames = [...sampled, ...spots].slice(0, 5)
      }
      toolTokens += stepDeltaTools
      stepEstimatedDelta += stepDeltaTools

      const hasEditOrSkill = Boolean(stats.edit || stats.skill || extracted.changes.length)
      const isBulkRead = !hasEditOrSkill && toolItems.length >= 2
      if (!toolItems.length && reasoningItems.length) {
        kind = 'fast-tools'
        primaryCat = 'msg'
        speedLabel = '1.0×'
        dwellMs = 1000
        detailTitle = t.lang === 'en' ? 'Reasoning' : '思考过程'
        detailSnippet = reasoningItems.map(r => r.text).join('\n').slice(0, 260)
        inBrief = t.lang === 'en' ? 'Internal reasoning' : '内部推理思考'
        responseBrief = (reasoningItems[0]?.text || '').replace(/\s+/g, ' ').trim().slice(0, 96)
      } else if (hasEditOrSkill) {
        kind = 'spotlight-change'
        speedLabel = '0.8×'
        dwellMs = 1900
        spotlight = stats.skill && !stats.edit ? 'context-skill' : 'context-tool'
        primaryCat = spotlight === 'context-skill' ? 'skill' : 'tool'
      } else if (isBulkRead) {
        kind = 'fast-tools'
        primaryCat = 'tool'
        speedLabel = '12×'
        dwellMs = 950
      } else {
        kind = 'fast-tools'
        primaryCat = 'tool'
        speedLabel = toolItems.length > 1 ? '12×' : '1.0×'
        dwellMs = 1100
      }
      if (toolItems.length) {
        detailTitle = t('toolCalls', { n: toolItems.length })
        detailSnippet = toolItems.slice(0, 3).map(item => item.summary).join('\n')
        const primaryTool = toolItems[0]?.name || 'tool'
        inBrief = `${primaryTool} · ${toolItems.slice(0, 2).map(i => i.summary).join('；')}`
        responseBrief = describeStats(stats, undefined, t.lang) || t('execToolsFallback')
      }
      const latestReal = group.items.findLast(it => it.contextTokens > 0)?.contextTokens
      if (latestReal > 0) {
        lastRealTotal = latestReal
        uncalibratedDelta = 0
      } else if (lastRealTotal > 0) {
        uncalibratedDelta += stepEstimatedDelta
      }
    }
    if (group.groupType === 'user' && lastRealTotal > 0) {
      uncalibratedDelta += stepEstimatedDelta
    }

    const disp = computeDisplayBuckets()
    prevDisp = disp
    const totalTokens = disp.sys + disp.schema + disp.user + disp.mem + disp.msg + disp.tool + disp.skill
    const deltaTokens = totalTokens - prevTotal
    const capacity = Math.max(windowSpec.tokens, Math.ceil(totalTokens * 1.25))
    const pct = Number(Math.min(99, (totalTokens / capacity) * 100).toFixed(1))
    const capPct = value => (value <= 0 ? 0 : Number((Math.max(0.4, (value / capacity) * 100)).toFixed(2)))
    const kindPct = value => Math.round((value / Math.max(1, totalTokens)) * 100)
    const categories = assembleCategoryList(index, prevCounts, prevToks, disp)

    return {
      index,
      turn: turnCount,
      t: stepTime,
      end: stepEnd,
      kind,
      primaryCat,
      speedLabel,
      dwellMs,
      spotlight,
      summary: group.groupType === 'work'
        ? describeStats(sumStats(group.items), undefined, t.lang) || group.items[0].summary || (group.items[0]?.type === 'reasoning' ? (t.lang === 'en' ? 'Thought process' : '思考过程') : t('execToolsFallback'))
        : (first.text || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      ...(montageFrames.length ? { montageFrames } : {}),
      ...(stepFrames.length ? { frames: stepFrames } : {}),
      ...(stepDocs.length ? { docs: stepDocs } : {}),
      ...(stepSubagents.length ? { subagents: stepSubagents } : {}),
      ...(stepAudios.length ? { audios: stepAudios } : {}),
      ...(compactInfo ? { compactInfo } : {}),
      contextSnapshot: {
        pct,
        windowTokens: windowSpec.tokens,
        windowLabel: windowSpec.label,
        totalTokens,
        deltaTokens,
        segments: {
          sys: capPct(disp.sys),
          schema: capPct(disp.schema),
          user: capPct(disp.user),
          msg: capPct(disp.msg),
          tool: capPct(disp.tool),
          skill: capPct(disp.skill),
          mem: capPct(disp.mem),
        },
        pctByKind: {
          sys: kindPct(disp.sys),
          schema: kindPct(disp.schema),
          user: kindPct(disp.user),
          msg: kindPct(disp.msg),
          tool: kindPct(disp.tool),
          skill: kindPct(disp.skill),
          mem: kindPct(disp.mem),
        },
        tokensByKind: {
          sys: disp.sys,
          schema: disp.schema,
          user: disp.user,
          msg: disp.msg,
          tool: disp.tool,
          skill: disp.skill,
          mem: disp.mem,
        },
        chips: {
          tools: uniqueRecent(allTools, 6),
          skills: uniqueRecent(allSkills, 4),
          memories: uniqueRecent(allMemories, 4),
          changes: uniqueRecent(allChanges, 5),
        },
        detail: {
          title: detailTitle,
          snippet: detailSnippet,
        },
        brief: {
          user: latestUserPrompt || t('sessionStart'),
          in: inBrief,
          response: responseBrief,
        },
        categories,
      },
    }
  })

  return { steps, initialSnapshot, contextRecords }
}

export function timeline(session, { lang = 'zh' } = {}) {
  const t = createTranslator(lang || session.lang || 'zh')
  const start = Date.parse(session.started) || 0
  const at = time => {
    const ms = Date.parse(time)
    return Number.isFinite(ms) && start > 0 ? Math.max(0, Math.round((ms - start) / 100) / 10) : 0
  }
  const end = Math.max(1, at(session.ended))
  const items = (session.items || []).map(item => ({
    ...item,
    t: at(item.time),
    ...(item.done ? { d: Math.min(end, at(item.done)) } : {}),
    ...(item.type === 'tool' ? { k: kindOf(item.stats, item.kind) } : {}),
  }))
  const lanes = items
    .filter(item => item.type === 'tool' && item.agent && item.d !== undefined && (item.kind === 'agent' || item.stats?.agent || item.name === 'followup_task'))
    .map(item => ({ agent: item.agent, s: item.t, e: Math.max(item.t, item.d) }))
  const waits = []
  items.forEach((item, index) => {
    if (index === 0 || item.type !== 'user' || item.t - items[index - 1].t <= waitThreshold) return
    const asked = items.slice(0, index).findLast(entry => entry.type === 'assistant')
    waits.push({ s: items[index - 1].t, e: item.t, asked: Boolean(asked?.question) })
  })
  const bins = Array.from({ length: Math.max(1, Math.ceil(end / binSeconds)) }, () => 0)
  for (const item of items) if (item.type === 'tool') bins[Math.min(bins.length - 1, Math.floor(item.t / binSeconds))]++
  const totals = sumStats(items)
  const frames = (session.frames || []).map(frame => ({ ...frame, t: at(frame.time) }))
  const { steps, initialSnapshot, contextRecords } = buildSteps(
    items,
    end,
    session.tool,
    session.model,
    frames,
    session.started,
    {
      contextWindow: session.contextWindow,
      initialContext: session.initialContext,
    },
    t
  )
  return {
    start: session.started,
    end,
    items,
    lanes,
    waits,
    bins,
    totals,
    frames,
    steps,
    initialSnapshot,
    contextRecords,
    turns: items.filter(item => item.type === 'user').length,
  }
}

export function sumStats(items) {
  const totals = {}
  for (const item of items || []) {
    if (item.stats && Object.keys(item.stats).length) {
      for (const [key, value] of Object.entries(item.stats)) {
        totals[key] = (totals[key] || 0) + value
      }
    } else if (item.kind) {
      totals[item.kind] = (totals[item.kind] || 0) + 1
    }
  }
  return totals
}

export const minutes = seconds => Math.max(1, Math.round(seconds / 60))

const statKeyMap = [
  ['search', 'statSearch'],
  ['open', 'statOpen'],
  ['read', 'statRead'],
  ['find', 'statFind'],
  ['view', 'statView'],
  ['command', 'statCommand'],
  ['code', 'statCode'],
  ['edit', 'statEdit'],
  ['skill', 'statSkill'],
  ['agent', 'statAgent'],
  ['reply', 'statReply'],
  ['other', 'statOther'],
]

export function describeStats(stats, keys = statKeyMap.map(([key]) => key), lang = 'zh') {
  const t = createTranslator(lang)
  return statKeyMap
    .filter(([key]) => keys.includes(key) && stats[key])
    .map(([key, dictKey]) => t(dictKey, { n: stats[key] }))
    .join(t('statSep'))
}
