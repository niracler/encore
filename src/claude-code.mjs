import {
  createTranscript,
  describeTool,
  imagesOf,
  isoTime,
  mentions,
  stripInjected,
  textOf,
} from './common.mjs'

const estTok = text => Math.max(60, Math.round(String(text || '').length * 0.32))
const fmtK = n => `${(n / 1000).toFixed(1)}k`

function splitSystemBlocks(blocks) {
  const joined = (blocks || []).map(b => (typeof b === 'string' ? b : b?.text || '')).join('\n').trim()
  if (!joined) return []
  const sections = joined.split(/\n(?=# [^\n]+)/)
  return sections.map((sec, idx) => {
    const clean = sec.trim()
    const heading = clean.match(/^#\s+([^\n]+)/)?.[1]?.trim() || (idx === 0 ? 'Claude Code Core Identity' : `System Section ${idx + 1}`)
    const tok = estTok(clean)
    return {
      id: `init-sys-cc-${idx}`,
      tag: idx === 0 ? 'Core' : 'System',
      title: heading,
      meta: `≈${fmtK(tok)} · 初始挂载`,
      tokEst: tok,
      payload: clean.slice(0, 12000),
    }
  })
}

function parseSkillListing(content, seenSkills, skillOut) {
  for (const line of String(content || '').split('\n')) {
    const m = line.match(/^\s*-\s+([\w:-]+):\s+(.+)$/)
    if (!m) continue
    const [, name, desc] = m
    if (seenSkills.has(name)) continue
    seenSkills.add(name)
    const tok = Math.max(45, Math.round(line.length * 0.34))
    skillOut.push({
      id: `init-skill-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      tag: 'Catalog',
      title: name,
      meta: `≈${tok} tok · 索引`,
      tokEst: tok,
      payload: `Skill: ${name}\n\n${desc.trim()}`,
    })
  }
}

export function userText(text) {
  const command = String(text || '').match(/<command-name>([^<]*)<\/command-name>/)
  if (command) {
    const args = String(text || '').match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1].trim()
    return [command[1].trim(), args].filter(Boolean).join(' ')
  }
  if (/^\s*\[Request interrupted by user[^\]]*\]\s*$/.test(text)) return '（中途打断）'
  return mentions(stripInjected(String(text || '').replace(/<command-message>[\s\S]*?<\/command-message>/g, '')))
}

const field = (text, name) => String(text || '').match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1].trim()

function handBack(text) {
  const match = String(text || '').match(/^\s*(?:Another Claude session sent a message:\s*)?<agent-message from="([^"]+)">[\s\S]*?The report follows:\n([\s\S]*?)<\/agent-message>/)
  return match && { from: match[1], report: match[2].replace(/^ {2}/gm, '').trim() }
}

export function readClaudeCode(records, { includeMemory = false } = {}) {
  const transcript = createTranscript()
  const usage = new Map()
  const waiting = new Map()
  let model
  let title
  let compactCount = 0
  let pendingCompact = null
  let lastContextTokens = 0

  const initSys = []
  const initSchema = []
  const initMem = []
  const initSkill = []
  const seenSys = new Set()
  const seenSchemas = new Set()
  const seenMem = new Set()
  const seenSkills = new Set()
  let capturedInitialShape = false
  let assistantStarted = false

  const notified = (text, time) => {
    const toolUseId = field(text, 'tool-use-id')
    if (toolUseId) transcript.result(toolUseId, undefined, time)
    const summary = `子任务交回结果：${field(text, 'summary') || ''}`.replace(/：$/, '')
    const agent = field(text, 'summary')?.match(/^Agent "(.+?)"/)?.[1]
    const result = field(text, 'result')
    const from = result?.match(/delivered to you as a message from "(.+?)"/)?.[1]
    if (from && waiting.has(from)) {
      Object.assign(waiting.get(from), { summary, agent })
      waiting.delete(from)
      return
    }
    const item = transcript.tool(null, { name: 'task-notification', summary, output: from ? undefined : result, stats: { reply: 1 }, agent }, time)
    if (from) waiting.set(from, item)
  }
  const reported = ({ from, report }, time) => {
    if (waiting.has(from)) {
      waiting.get(from).output = report
      waiting.delete(from)
      return
    }
    waiting.set(from, transcript.tool(null, { name: 'agent-message', summary: `子任务交回结果：${from}`, output: report, stats: { reply: 1 } }, time))
  }

  for (const record of records) {
    if (record.type === 'custom-title' && record.customTitle) title = record.customTitle
    if (record.type === 'ai-title' && record.aiTitle && !title) title = record.aiTitle
    if (record.type === 'summary' && record.summary && !title) title = record.summary
    const time = isoTime(record.timestamp)

    if (record.type === 'api-request-shape') {
      const shape = record.shape || {}
      if (!capturedInitialShape) {
        capturedInitialShape = true
        if (Array.isArray(shape.system) && !seenSys.has('shape-sys')) {
          seenSys.add('shape-sys')
          initSys.unshift(...splitSystemBlocks(shape.system))
        }
        for (const tool of shape.tools || []) {
          if (!tool?.name || seenSchemas.has(tool.name)) continue
          seenSchemas.add(tool.name)
          const rawJson = JSON.stringify({ name: tool.name, description: tool.description, input_schema: tool.input_schema }, null, 2)
          const tok = estTok(rawJson)
          initSchema.push({
            id: `init-schema-${tool.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            tag: tool.name.startsWith('mcp__') ? 'MCP' : 'Schema',
            title: tool.name,
            meta: `≈${fmtK(tok)} · 工具定义`,
            tokEst: tok,
            payload: rawJson.slice(0, 10000),
          })
        }
      }
      continue
    }

    if (record.type === 'system' && record.subtype === 'compact_boundary') {
      compactCount++
      const meta = record.compactMetadata || {}
      const preTokens = meta.preTokens || lastContextTokens || undefined
      const postTokens = meta.postTokens || undefined
      const droppedTokens = meta.cumulativeDroppedTokens || (preTokens && postTokens ? Math.max(0, preTokens - postTokens) : undefined)
      const summary = preTokens && postTokens
        ? `窗口达 ${fmtK(preTokens)} / 1.0M，压缩至 ${fmtK(postTokens)}（释放 ${fmtK(droppedTokens || (preTokens - postTokens))} tokens）`
        : `上下文压缩 #${compactCount}`
      const header = [
        `# Claude Code Context Compaction #${compactCount}（trigger: ${meta.trigger || 'auto'}）`,
        preTokens ? `- 压缩前占用：${preTokens.toLocaleString()} tokens` : '',
        postTokens ? `- 压缩后骨架：${postTokens.toLocaleString()} tokens（释放 ${(droppedTokens || 0).toLocaleString()} tokens）` : '',
        meta.preCompactDiscoveredTools?.length ? `- 保留已发现延迟工具：${meta.preCompactDiscoveredTools.join(', ')}` : '',
      ].filter(Boolean).join('\n')
      pendingCompact = transcript.compact({
        seq: compactCount,
        trigger: meta.trigger || 'auto',
        preTokens,
        postTokens,
        droppedTokens,
        discoveredTools: meta.preCompactDiscoveredTools,
        summary,
        text: header,
      }, time)
      if (postTokens) lastContextTokens = postTokens
      continue
    }

    if (record.type === 'attachment') {
      const att = record.attachment || {}
      if (att.type === 'compact_file_reference' && pendingCompact) {
        const refPath = att.filename || att.displayPath || att.filePath || JSON.stringify(att).slice(0, 160)
        pendingCompact.text = `${pendingCompact.text}\n- [压缩后自动重挂载关键文件] ${refPath}`.slice(0, 24000)
        continue
      }
      if (!assistantStarted) {
        if (att.type === 'prompt_snapshot' && Array.isArray(att.systemPrompt) && !seenSys.has('shape-sys')) {
          seenSys.add('shape-sys')
          initSys.unshift(...splitSystemBlocks(att.systemPrompt))
        } else if (att.type === 'output_style_instructions' && att.style?.prompt && !seenSys.has('output-style')) {
          seenSys.add('output-style')
          const tok = estTok(att.style.prompt)
          initSys.push({
            id: 'init-sys-output-style',
            tag: 'Style',
            title: `Output Style: ${att.style.name || 'Custom'}`,
            meta: `≈${fmtK(tok)} · 输出风格指令`,
            tokEst: tok,
            payload: att.style.prompt.slice(0, 10000),
          })
        } else if (att.type === 'model' && att.text && !seenSys.has('model-id')) {
          seenSys.add('model-id')
          const tok = estTok(att.text)
          initSys.push({
            id: 'init-sys-model',
            tag: 'Model',
            title: `Model Identity (${att.identity?.marketingName || att.identity?.modelId || 'Claude'})`,
            meta: `≈${tok} tok · 模型声明`,
            tokEst: tok,
            payload: att.text,
          })
        } else if (att.type === 'deferred_tools_delta' && att.addedNames?.length && !seenSchemas.has('__deferred__')) {
          seenSchemas.add('__deferred__')
          const body = (att.addedLines || att.addedNames).join('\n')
          const tok = estTok(body)
          initSchema.push({
            id: 'init-schema-deferred-catalog',
            tag: 'Deferred',
            title: `Deferred Tools（按需延迟加载工具目录 · ${att.addedNames.length} 项）`,
            meta: `≈${fmtK(tok)} · ToolSearch 索引`,
            tokEst: tok,
            payload: body.slice(0, 10000),
          })
        } else if (att.type === 'skill_listing' && att.content) {
          parseSkillListing(att.content, seenSkills, initSkill)
        } else if (att.type === 'instructions' && Array.isArray(att.files)) {
          for (const f of att.files) {
            const name = String(f.path || 'CLAUDE.md').split(/[/\\]/).slice(-2).join('/')
            if (!f.content || seenMem.has(name)) continue
            seenMem.add(name)
            const tok = estTok(f.content)
            const isUserGlobal = f.type === 'User'
            const lineCount = String(f.content).split('\n').length
            const payload = isUserGlobal && !includeMemory
              ? `[默认隐私保护：已省略用户全局指令 ${name} 正文（共 ${lineCount} 行，约 ${fmtK(tok)} tokens）。如需导出完整内容可传入 --include-memory]`
              : String(f.content).slice(0, 12000)
            initMem.push({
              id: `init-mem-${initMem.length + 1}`,
              tag: isUserGlobal ? 'CLAUDE.md' : 'AGENTS.md',
              title: `${name}（${isUserGlobal ? '用户全局指令' : '项目协作规则'}）`,
              meta: `≈${fmtK(tok)} · 初始挂载`,
              tokEst: tok,
              payload,
            })
          }
        } else if (att.type === 'environment' && att.snapshot && !seenMem.has('env')) {
          seenMem.add('env')
          const rawEnv = JSON.stringify(att.snapshot, null, 2)
          const tok = estTok(rawEnv)
          initMem.push({
            id: 'init-mem-env',
            tag: 'Env',
            title: '<env>（工作目录、平台与 Git 状态快照）',
            meta: `≈${tok} tok · 初始挂载`,
            tokEst: tok,
            payload: rawEnv,
          })
        } else if (att.type === 'mcp_instructions_delta' && att.addedBlocks?.length && !seenMem.has('mcp-inst')) {
          seenMem.add('mcp-inst')
          const body = att.addedBlocks.join('\n\n')
          const tok = estTok(body)
          initMem.push({
            id: 'init-mem-mcp',
            tag: 'MCP',
            title: `MCP Server Instructions（${(att.addedNames || []).length} 个连接器说明）`,
            meta: `≈${fmtK(tok)} · 初始挂载`,
            tokEst: tok,
            payload: body.slice(0, 10000),
          })
        } else if (att.type === 'agent_listing_delta' && att.addedLines?.length && !seenMem.has('agents-list')) {
          seenMem.add('agents-list')
          const body = att.addedLines.join('\n')
          const tok = estTok(body)
          initMem.push({
            id: 'init-mem-agents-fleet',
            tag: 'Subagents',
            title: `Available Sub-agents（${(att.addedTypes || []).length} 类子代理定义）`,
            meta: `≈${fmtK(tok)} · 初始挂载`,
            tokEst: tok,
            payload: body.slice(0, 10000),
          })
        } else if (att.type === 'file' && att.filename && !seenMem.has(`file:${att.filename}`)) {
          seenMem.add(`file:${att.filename}`)
          const fname = String(att.filename).split(/[/\\]/).pop()
          const sizeKb = att.content?.file?.originalSize ? `${Math.round(att.content.file.originalSize / 1024)} KB` : '附件'
          const tok = att.content?.file?.originalSize ? Math.min(18000, Math.max(800, Math.round(att.content.file.originalSize / 120))) : 1200
          initMem.push({
            id: `init-mem-file-${initMem.length + 1}`,
            tag: 'Attachment',
            title: `@${fname}（初始随附参考文件 · ${sizeKb}）`,
            meta: `≈${fmtK(tok)} · 附件挂载`,
            tokEst: tok,
            payload: `File Attachment: ${fname}\nType: ${att.content?.type || 'document'}\nSize: ${sizeKb}`,
          })
        }
      }
      if (record.attachment?.type !== 'queued_command') continue
      const { prompt } = record.attachment
      const text = textOf(prompt)
      const back = handBack(text)
      if (back) reported(back, time)
      else if (/^\s*<task-notification>/.test(text)) notified(text, time)
      else transcript.user(userText(text), time, { images: typeof prompt === 'string' ? [] : imagesOf(prompt) })
      continue
    }
    if (!['user', 'assistant'].includes(record.type) || record.isApiErrorMessage) continue
    const message = record.message || {}
    const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content || []
    if (record.type === 'user' && record.isCompactSummary) {
      const summaryBody = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      if (summaryBody) {
        if (pendingCompact) {
          pendingCompact.text = `${pendingCompact.text}\n\n## Compact Summary（压缩生成的交接摘要全文）\n${summaryBody}`.slice(0, 24000)
        } else {
          compactCount++
          pendingCompact = transcript.compact({
            seq: compactCount,
            trigger: 'auto',
            preTokens: lastContextTokens || undefined,
            summary: `上下文压缩 #${compactCount}（生成结构化交接摘要）`,
            text: summaryBody.slice(0, 24000),
          }, time)
        }
      }
      continue
    }
    if (record.type === 'user') {
      const back = handBack(blocks.filter(block => block.type === 'text').map(block => block.text).join('\n'))
      if (back) {
        reported(back, time)
        continue
      }
    }
    if (record.isMeta) continue

    if (record.type === 'assistant') {
      assistantStarted = true
      if (message.model && message.model !== '<synthetic>') model = model || message.model
      let ctxTokens = 0
      let cachedTokens = 0
      if (message.id && message.usage) {
        const { input_tokens = 0, output_tokens = 0, cache_read_input_tokens = 0, cache_creation_input_tokens = 0 } = message.usage
        usage.set(message.id, input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens)
        ctxTokens = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
        cachedTokens = cache_read_input_tokens
        if (ctxTokens > 0) lastContextTokens = ctxTokens
      }
      for (const block of blocks) {
        if (block.type === 'text' && block.text !== '(no content)') transcript.assistant(block.text, time, { key: message.id })
        else if (block.type === 'thinking') transcript.reasoning(block.thinking, time)
        else if (block.type === 'tool_use') transcript.tool(block.id, describeTool(block.name, block.input), time)
      }
      if (ctxTokens > 0) {
        const target = transcript.items.findLast(it => it.type === 'assistant' || it.type === 'tool')
        if (target) {
          target.contextTokens = ctxTokens
          if (cachedTokens > 0) target.cachedTokens = cachedTokens
        }
      }
      continue
    }

    const said = []
    const pictures = []
    for (const block of blocks) {
      if (block.type === 'text' && /^\s*<task-notification>/.test(block.text)) {
        notified(block.text, time)
      } else if (block.type === 'tool_result') {
        const output = stripInjected(textOf(block.content))
        transcript.result(block.tool_use_id, /^Async agent launched successfully/.test(output) ? undefined : output, time, imagesOf(block.content))
      } else if (block.type === 'text') {
        const cleaned = userText(block.text)
        if (/^The context window filled up while you were working, so the conversation was compacted\./i.test(cleaned)) continue
        said.push(cleaned)
      } else if (block.type === 'image') {
        pictures.push(...imagesOf(block))
      }
    }
    const joinedSaid = said.filter(Boolean).join('\n\n')
    if (joinedSaid && joinedSaid !== '/compact') pendingCompact = null
    transcript.user(joinedSaid, time, { images: pictures })
  }
  const tokens = [...usage.values()].reduce((sum, value) => sum + value, 0) || undefined
  const initialContext = (initSys.length || initSchema.length || initMem.length || initSkill.length)
    ? {
        ...(initSys.length ? { sys: initSys } : {}),
        ...(initSchema.length ? { schema: initSchema } : {}),
        ...(initMem.length ? { mem: initMem } : {}),
        ...(initSkill.length ? { skill: initSkill } : {}),
      }
    : undefined
  return transcript.finish({ tool: 'claude-code', model, title, tokens, contextWindow: 1000000, initialContext })
}
