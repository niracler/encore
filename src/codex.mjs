import {
  attachmentLabel,
  createTranscript,
  describeTool,
  imagesOf,
  isoTime,
  parseArguments,
  shortUrl,
  textOf,
} from './common.mjs'

const injected = /^(# AGENTS\.md instructions|<[a-z][\w-]*[\s>]|The following is the Codex agent history)/
const handoffMarker = 'Another language model started to solve this problem and produced a summary of its thinking process.'

const estTok = text => Math.max(80, Math.round(String(text || '').length * 0.32))
const fmtK = n => `${(n / 1000).toFixed(1)}k`

function splitMarkdownSections(raw, prefixId, tag) {
  const text = String(raw || '').trim()
  if (!text) return []
  const chunks = text.split(/\n(?=# [^\n]+)/)
  if (chunks.length <= 1) {
    const tok = estTok(text)
    return [{ id: `${prefixId}-0`, tag, title: 'Codex Base Instructions', meta: `≈${fmtK(tok)} · 初始挂载`, tokEst: tok, payload: text.slice(0, 12000) }]
  }
  return chunks.map((chunk, idx) => {
    const clean = chunk.trim()
    const heading = clean.match(/^#\s+([^\n]+)/)?.[1]?.trim() || (idx === 0 ? 'Core Identity & Preamble' : `Section ${idx + 1}`)
    const tok = estTok(clean)
    return {
      id: `${prefixId}-${idx}`,
      tag,
      title: heading,
      meta: `≈${fmtK(tok)} · 初始挂载`,
      tokEst: tok,
      payload: clean.slice(0, 12000),
    }
  })
}

function parseCodexSkillsBlock(blockText, seenSkills, skillOut) {
  const lines = String(blockText || '').split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*-\s+([\w:-]+):\s+(.+)$/)
    if (!m) continue
    const [, name, desc] = m
    if (name.startsWith('`') || seenSkills.has(name)) continue
    seenSkills.add(name)
    const cleanDesc = desc.replace(/\s*\(file:\s*[^)]+\)\s*$/, '').trim()
    const tok = Math.max(45, Math.round(line.length * 0.34))
    skillOut.push({
      id: `init-skill-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      tag: 'Catalog',
      title: name,
      meta: `≈${tok} tok · 索引`,
      tokEst: tok,
      payload: `Skill: ${name}\n\n${cleanDesc}`,
    })
  }
}

function flattenCodexTools(toolsList, schemaOut, seenSchemas) {
  for (const entry of toolsList || []) {
    if (entry.type === 'namespace' && Array.isArray(entry.tools)) {
      flattenCodexTools(entry.tools, schemaOut, seenSchemas)
      continue
    }
    const name = entry.name || entry.function?.name
    if (!name || seenSchemas.has(name)) continue
    seenSchemas.add(name)
    const rawJson = JSON.stringify(entry, null, 2)
    const tok = estTok(rawJson)
    schemaOut.push({
      id: `init-schema-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      tag: name.startsWith('mcp__') ? 'MCP' : 'Schema',
      title: name,
      meta: `≈${fmtK(tok)} · 工具定义`,
      tokEst: tok,
      payload: rawJson.slice(0, 10000),
    })
  }
}

function formatReplacementHistory(history = []) {
  const lines = []
  let preservedCount = 0
  for (const entry of history) {
    if (entry.type !== 'message') continue
    const txt = textOf(entry.content).trim()
    if (!txt) continue
    if (entry.role === 'user' && !injected.test(txt)) {
      preservedCount++
      const clean = cleanPrompt(txt).replace(/\s+/g, ' ').trim()
      lines.push(`- [保留用户提问 #${preservedCount}] ${clean.slice(0, 180)}${clean.length > 180 ? '…' : ''}`)
    } else if (entry.role === 'developer') {
      const firstTag = txt.match(/^<([a-z][\w-]*)/i)?.[1] || 'developer_instructions'
      lines.push(`- [保留系统/开发者层] <${firstTag}> (${txt.length} chars)`)
    }
  }
  return { preservedCount, summaryLines: lines }
}

export function cleanPrompt(text) {
  text = String(text || '').replace(/^## My request:\n/, '')
  const wrapped = text.match(/^# Files mentioned by the user:\n([\s\S]*?)\n## My request:\n([\s\S]*)$/)
  const files = wrapped ? [...wrapped[1].matchAll(/^## (.+?): /gm)].map(match => attachmentLabel(match[1])) : []
  const request = (wrapped ? wrapped[2] : text)
    .replace(/<image name=[^>]*>[\s\S]*?<\/image>/g, '')
    .replace(/\[\$([\w:-]+)\]\([^)]*\)/g, '$$$1')
    .replace(/\\\n/g, '\n')
    .replace(/&#x20;/g, ' ')
    .replace(/\\([\\`*_{}[\]()#+\-.!:=|~>])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return [request, ...files].filter(Boolean).join('\n\n')
}

function strings(code, key) {
  const pattern = new RegExp(`["']?\\b${key}["']?\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 'g')
  return [...String(code || '').matchAll(pattern)].map(match => (
    match[2].replace(/\\(["'`\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  ))
}

function describeCodexCode(code) {
  const stats = {}
  const add = (kind, count) => { if (count) stats[kind] = (stats[kind] || 0) + count }
  const queries = strings(code, 'q')
  const pages = strings(code, 'ref_id')
  const urls = pages.filter(url => /^https?:/.test(url))
  const commands = strings(code, 'cmd')
  const files = [...String(code || '').matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\\\n"]+)/g)].map(match => match[1].split(/[/\\]/).pop())
  const calls = [...String(code || '').matchAll(/\btools\.(\w+)\s*\(/g)].map(match => match[1])
  const images = calls.filter(name => name === 'view_image').length
  const others = calls.filter(name => !['web__run', 'exec_command', 'write_stdin', 'apply_patch', 'view_image'].includes(name))
  add('search', queries.length)
  add('open', pages.length)
  add('command', commands.length)
  add('edit', files.length)
  add('view', images)
  add('other', others.length)
  if (!Object.keys(stats).length) add('code', 1)
  const parts = []
  if (queries.length) parts.push(`搜索「${queries[0].trim()}」${queries.length > 1 ? `等 ${queries.length} 项` : ''}`)
  if (urls.length) parts.push(`打开 ${shortUrl(urls[0])}${pages.length > 1 ? ` 等 ${pages.length} 个网页` : ''}`)
  else if (pages.length) parts.push(`点开网页里的 ${pages.length} 个链接`)
  if (commands.length) parts.push(`运行 ${commands[0].trim().split('\n')[0]}${commands.length > 1 ? ` 等 ${commands.length} 条命令` : ''}`)
  if (files.length) parts.push(`写入 ${files.join('、')}`)
  if (images) parts.push(`查看 ${images} 张图片`)
  if (others.length) parts.push(`调用 ${[...new Set(others.map(name => name.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '')))].join('、')}`)
  const summary = parts.join('；') || '运行代码'
  return { name: 'exec', summary: summary.length > 120 ? `${summary.slice(0, 119)}…` : summary, input: code, stats }
}

const normAgentName = value => String(value || '').split('/').filter(Boolean).pop() || String(value || '').trim()

export function readCodex(records, { includeMemory = false } = {}) {
  const transcript = createTranscript()
  const working = new Map()
  let model
  let title
  let tokens
  let contextWindow
  let lastContextTokens = 0
  let compactCount = 0
  let pendingCompact = null

  const initSys = []
  const initSchema = []
  const initMem = []
  const initSkill = []
  const seenSysKeys = new Set()
  const seenMemKeys = new Set()
  const seenSkills = new Set()
  const seenSchemas = new Set()
  let sawFirstUserTurn = false

  const addSys = (key, tag, label, raw) => {
    const clean = String(raw || '').trim()
    if (!clean || seenSysKeys.has(key)) return
    seenSysKeys.add(key)
    const tok = estTok(clean)
    initSys.push({ id: `init-sys-${key}`, tag, title: label, meta: `≈${fmtK(tok)} · 初始挂载`, tokEst: tok, payload: clean.slice(0, 12000) })
  }
  const addMem = (key, tag, label, raw, { redactBody = false } = {}) => {
    const clean = String(raw || '').trim()
    if (!clean || seenMemKeys.has(key)) return
    seenMemKeys.add(key)
    const tok = estTok(clean)
    let payload = clean.slice(0, 12000)
    if (redactBody && !includeMemory) {
      const topHeadings = [...clean.matchAll(/^##\s+([^\n]+)/gm)].map(m => `- ${m[1].trim()}`)
      const lineCount = clean.split('\n').length
      payload = [
        '========= MEMORY_SUMMARY (REDACTED BY DEFAULT) =========',
        `[默认隐私保护：已省略跨会话个人记忆正文（共 ${lineCount} 行，约 ${fmtK(tok)} tokens），仅保留顶层结构。如需导出完整记忆可传入 --include-memory]`,
        ...(topHeadings.length ? ['', '顶层章节：', ...topHeadings] : []),
        '========= MEMORY_SUMMARY ENDS =========',
      ].join('\n')
    }
    initMem.push({ id: `init-mem-${key}`, tag, title: label, meta: `≈${fmtK(tok)} · 初始挂载`, tokEst: tok, payload })
  }

  const harvestInjectedBlocks = rawText => {
    const txt = String(rawText || '')
    const perm = txt.match(/<permissions instructions>[\s\S]*?<\/permissions instructions>/i)?.[0]
    const collab = txt.match(/<collaboration_mode>[\s\S]*?<\/collaboration_mode>/i)?.[0]
    if (perm || collab) addSys('permissions-collab', 'System', 'Permissions & Collaboration Mode', [perm, collab].filter(Boolean).join('\n\n'))
    const appCtx = txt.match(/<app-context>[\s\S]*?<\/app-context>/i)?.[0]
    if (appCtx) addSys('app-context', 'Desktop', 'Codex Desktop App Context (<app-context>)', appCtx)
    if (/You are `\/root`, the primary agent/.test(txt)) addSys('multi-agent-root', 'Agents', 'Multi-Agent Coordinator Instructions (/root)', txt)
    const multiMode = txt.match(/<multi_agent_mode>[\s\S]*?<\/multi_agent_mode>/i)?.[0]
    if (multiMode) addSys('multi-agent-mode', 'Agents', 'Multi-Agent Delegation Policy', multiMode)

    const skillsBlock = txt.match(/<skills_instructions>[\s\S]*?<\/skills_instructions>/i)?.[0]
    if (skillsBlock) parseCodexSkillsBlock(skillsBlock, seenSkills, initSkill)

    const agentsMd = txt.match(/# AGENTS\.md instructions[^\n]*\n[\s\S]*?<\/INSTRUCTIONS>/i)?.[0]
    if (agentsMd) addMem('agents-md', 'AGENTS.md', 'AGENTS.md（工作区与全局协作指令）', agentsMd)
    const memSummary = txt.match(/========= MEMORY_SUMMARY BEGINS =========[\s\S]*?========= MEMORY_SUMMARY ENDS =========/)?.[0]
    if (memSummary) addMem('memory-summary', 'Memory', 'MEMORY_SUMMARY（跨会话长期记忆摘要）', memSummary, { redactBody: true })
    const envBlock = txt.match(/<environment_context>[\s\S]*?<\/environment_context>/i)?.[0]
    if (envBlock) addMem('env-context', 'Env', '<environment_context>（工作区环境与沙箱配置）', envBlock)
    const recPlugins = txt.match(/<recommended_plugins>[\s\S]*?<\/recommended_plugins>/i)?.[0]
    if (recPlugins) addMem('recommended-plugins', 'Plugins', '<recommended_plugins>（可用插件列表）', recPlugins)
  }

  for (const record of records) {
    if (record.type === 'custom-title' && record.customTitle) title = record.customTitle
    if (record.type === 'ai-title' && record.aiTitle && !title) title = record.aiTitle
    const payload = record.payload || {}
    const time = isoTime(record.timestamp)
    if (record.type === 'session_meta') {
      model = model || payload.model
      if (payload.title && !title) title = payload.title
      const baseText = typeof payload.base_instructions === 'string' ? payload.base_instructions : payload.base_instructions?.text
      if (baseText && !seenSysKeys.has('base-0')) {
        seenSysKeys.add('base-0')
        initSys.unshift(...splitMarkdownSections(baseText, 'init-sys-base', 'Core'))
      }
    }
    if (record.type === 'turn_context') model = model || payload.model
    if (record.type === 'world_state' && payload.state?.agents_md?.text) {
      addMem('agents-md', 'AGENTS.md', 'AGENTS.md（工作区与全局协作指令）', payload.state.agents_md.text)
    }
    if (record.type === 'event_msg') {
      if (payload.model_context_window && !contextWindow) contextWindow = payload.model_context_window
      if (payload.type === 'token_count') {
        tokens = payload.info?.total_token_usage?.total_tokens ?? tokens
        if (payload.info?.model_context_window && !contextWindow) contextWindow = payload.info.model_context_window
        const lastUsage = payload.info?.last_token_usage
        if (lastUsage) {
          if (lastUsage.input_tokens > 0 && lastUsage.total_tokens > 0) {
            lastContextTokens = lastUsage.total_tokens
            const target = transcript.items.findLast(it => it.type === 'assistant' || it.type === 'tool')
            if (target) {
              target.contextTokens = lastUsage.total_tokens
              if (lastUsage.cached_input_tokens) target.cachedTokens = lastUsage.cached_input_tokens
            }
          } else if (lastUsage.input_tokens === 0 && lastUsage.total_tokens > 0 && pendingCompact && !pendingCompact.postTokens) {
            pendingCompact.postTokens = lastUsage.total_tokens
            if (pendingCompact.preTokens) {
              pendingCompact.droppedTokens = Math.max(0, pendingCompact.preTokens - pendingCompact.postTokens)
              pendingCompact.summary = `窗口达 ${fmtK(pendingCompact.preTokens)}${contextWindow ? ` / ${fmtK(contextWindow)}` : ''}，自动压缩至 ${fmtK(pendingCompact.postTokens)}（释放 ${fmtK(pendingCompact.droppedTokens)} tokens）`
            }
            lastContextTokens = lastUsage.total_tokens
          }
        }
      }
      continue
    }
    if (record.type === 'compacted') {
      compactCount++
      const preTokens = lastContextTokens || undefined
      const { preservedCount, summaryLines } = formatReplacementHistory(payload.replacement_history || [])
      const winNum = (payload.window_number || compactCount) + 1
      const bodyParts = [
        `# Codex Context Compaction #${compactCount}（进入 Window #${winNum}）`,
        preTokens ? `- 压缩前上下文占用：${preTokens.toLocaleString()} tokens` : '',
        preservedCount ? `- 原样保留关键提问：${preservedCount} 条用户原始指令 + 系统/开发者挂载层` : '',
        '- 折叠释放：此前累积的工具输出、文件读取片段与中间推理链已归档移出活动窗口',
        summaryLines.length ? `\n## 压缩后保留的骨架条目\n${summaryLines.join('\n')}` : '',
        payload.message ? `\n## 压缩摘要\n${payload.message}` : '',
      ].filter(Boolean)
      pendingCompact = transcript.compact({
        seq: compactCount,
        trigger: 'auto',
        windowNumber: winNum,
        preTokens,
        preservedCount: preservedCount || undefined,
        summary: preTokens
          ? `上下文自动压缩 #${compactCount}（压缩前 ${fmtK(preTokens)} tokens）`
          : `上下文自动压缩 #${compactCount}`,
        text: bodyParts.join('\n').slice(0, 24000),
      }, time)
      continue
    }
    if (record.type !== 'response_item') continue

    if (payload.type === 'additional_tools' && !sawFirstUserTurn) {
      flattenCodexTools(payload.tools, initSchema, seenSchemas)
      continue
    }
    if (payload.type === 'message' && payload.role === 'developer') {
      harvestInjectedBlocks(textOf(payload.content))
      continue
    }

    if (payload.type === 'message' && payload.role === 'user') {
      const rawContentText = textOf(payload.content)
      harvestInjectedBlocks(rawContentText)
      if (rawContentText.includes(handoffMarker)) {
        const idx = rawContentText.indexOf(handoffMarker)
        const handoffBody = rawContentText.slice(idx).trim()
        if (pendingCompact) {
          pendingCompact.text = `${pendingCompact.text}\n\n## Handoff Summary\n${handoffBody}`.slice(0, 24000)
        } else {
          compactCount++
          pendingCompact = transcript.compact({
            seq: compactCount,
            trigger: 'handoff',
            preTokens: lastContextTokens || undefined,
            summary: `上下文压缩交接 #${compactCount}（生成 Handoff Summary）`,
            text: handoffBody.slice(0, 24000),
          }, time)
        }
        continue
      }
      const text = rawContentText.replace(/^\s*<([a-z][\w-]*context)\b[^>]*>[\s\S]*?<\/\1>\s*/g, '').trim()
      if (!text) continue
      const reply = text.match(/^<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>$/)
      if (reply) {
        sawFirstUserTurn = true
        pendingCompact = null
        const answers = parseArguments(reply[1])
        transcript.user(Array.isArray(answers) ? answers.map(answer => answer.answer).join('\n') : reply[1], time, { answer: true })
      } else if (!injected.test(text)) {
        sawFirstUserTurn = true
        pendingCompact = null
        transcript.user(cleanPrompt(text), time, { images: imagesOf(payload.content) })
      }
    } else if (payload.type === 'message' && payload.role === 'assistant') {
      transcript.assistant(textOf(payload.content), time)
    } else if (payload.type === 'reasoning') {
      transcript.reasoning((payload.summary || []).map(part => part.text).join('\n\n'), time)
    } else if (payload.type === 'custom_tool_call') {
      transcript.tool(
        payload.call_id,
        payload.name === 'exec'
          ? describeCodexCode(payload.input)
          : { name: payload.name, summary: payload.name, input: payload.input, stats: { other: 1 } },
        time
      )
    } else if (payload.type === 'function_call') {
      const args = parseArguments(payload.arguments)
      if (payload.name === 'request_user_input_async' || payload.name === 'request_user_input') {
        transcript.assistant((args.questions || []).map(question => question.title || question.question).join('\n'), time, { question: true })
      } else if (payload.name === 'spawn_agent' || payload.name === 'collaboration__spawn_agent') {
        const agentKey = normAgentName(args.task_name)
        working.set(agentKey, transcript.tool(payload.call_id, { name: payload.name, summary: `派出子任务 ${args.task_name}`, stats: { agent: 1 }, agent: agentKey }, time))
      } else if (['send_message', 'followup_task', 'collaboration__send_message', 'collaboration__followup_task'].includes(payload.name)) {
        const isFollowup = payload.name.endsWith('followup_task')
        const agentKey = normAgentName(args.target)
        const item = transcript.tool(payload.call_id, { name: payload.name, summary: `${isFollowup ? '给子任务追加任务' : '给子任务发消息'} ${args.target}`, stats: { other: 1 }, agent: agentKey }, time)
        if (isFollowup && agentKey) working.set(agentKey, item)
      } else if (payload.name === 'wait' || payload.name === 'collaboration__wait_agent') {
        transcript.tool(payload.call_id, { name: payload.name, summary: '等待子任务', stats: { other: 1 } }, time)
      } else {
        transcript.tool(payload.call_id, describeTool(payload.name, args), time)
      }
    } else if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
      transcript.result(payload.call_id, textOf(payload.output), time, imagesOf(payload.output))
    } else if (payload.type === 'web_search_call') {
      const query = payload.action?.query || payload.action?.queries?.join('、') || ''
      transcript.tool(null, { name: 'web_search', summary: `搜索「${query}」`, stats: { search: 1 } }, time)
    } else if (payload.type === 'agent_message') {
      const message = textOf(payload.content).match(/^Message Type: (\w+)\n[\s\S]*?Sender: ([^\n]+)\nPayload:\n([\s\S]*)$/)
      if (!message || !message[3].trim()) continue
      const name = normAgentName(message[2])
      transcript.tool(null, { name: 'agent_message', summary: message[1] === 'FINAL_ANSWER' ? `子任务 ${name} 交回结果` : `子任务 ${name} 发来消息`, output: message[3].trim(), stats: { reply: 1 }, agent: name }, time)
      if (message[1] === 'FINAL_ANSWER' && working.has(name)) {
        working.get(name).done = time
        working.delete(name)
      }
    }
  }
  const initialContext = (initSys.length || initSchema.length || initMem.length || initSkill.length)
    ? {
        ...(initSys.length ? { sys: initSys } : {}),
        ...(initSchema.length ? { schema: initSchema } : {}),
        ...(initMem.length ? { mem: initMem } : {}),
        ...(initSkill.length ? { skill: initSkill } : {}),
      }
    : undefined
  return transcript.finish({ tool: 'codex', model, title, tokens, contextWindow, initialContext })
}
