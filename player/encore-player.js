// Encore Standalone Player (https://github.com/niracler/encore)
;(() => {
// --- i18n.mjs ---
const DICTS = {
  zh: {
    langCode: 'zh-CN',
    toggleLangLabel: 'EN',
    toggleLangTitle: 'Switch to English',
    play: '▶ 播放',
    pause: '⏸ 暂停',
    replay: '↺ 重播',
    playAria: '播放',
    pauseAria: '暂停',
    replayAria: '重新播放',
    prevStep: '上一步',
    nextStep: '下一步',
    sendOrPause: '发送或暂停',
    pausePlayback: '暂停回放',
    sendThisPrompt: '发送本轮提问',
    waitNextStep: '等待下一步',
    composerPlaceholder: '向 Agent 发送消息…',
    composerFinished: '会话已结束 · 点击上方任意消息可回看当时上下文',
    emptyHintStart: '点击左下角 <b>▶ 播放</b>',
    emptyHintOrSend: ' 或输入框蓝色发送键 <b>↑</b>',
    emptyHintEnd: '，体验完整对话与上下文生长',
    activeContext: '当前上下文',
    snapInitial: '快照：启动初始态',
    snapInspect: '回看：第 {step} / {total} 步',
    snapCurrent: '第 {step} / {total} 步',
    usedSuffix: '已用',
    freeSpaceTitle: '剩余窗口 (Free Space)',
    autoCompactTriggerTitle: '自动压缩触发线 (80%)',
    headroomTitle: '压缩预留空间 (Autocompact Headroom)',
    outputReserveTitle: '模型最大输出预留 (Max Output Reserve)',
    legendSys: '系统提示词',
    legendSchema: '工具定义',
    legendUser: '用户消息',
    legendMem: '注入内容',
    legendSkill: '技能注入',
    legendMsg: '助手回复',
    legendTool: '工具输出',
    catSys: '系统提示词（System Prompt）',
    catSchema: '工具定义（Tool Schemas & MCP）',
    catUser: '用户消息（User Messages）',
    catMem: '注入内容（Memory & Rules）',
    catSkill: '技能注入（Skills）',
    catMsg: '助手回复（Assistant Messages）',
    catTool: '工具输出（Tool Outputs）',
    contextInspector: '上下文明细',
    contextInspectorHint: '点击色块或消息定格展开',
    emptyCategory: '当前步骤暂无条目',
    viewFullPayload: '查看完整内容 ↗',
    omittedImages: '（{prefix}{count} 张附图未收录）',
    omittedImagesAlso: '另有 ',
    compactTitle: '上下文压缩 #{seq}',
    compactManual: '手动 /compact',
    compactHandoff: '压缩交接',
    compactAuto: '自动压缩',
    compactFreed: ' · 释放 {tokens}',
    compactDesc: '已归档前序 {count} 条工具输出与历史对话，保留系统提示词、工具定义、规则记忆及结构化交接摘要。',
    compactViewBtn: '查看交接摘要 ↗',
    compactModalTitle: '上下文压缩摘要',
    asksYou: '{tool} 问你',
    deliverablesTitle: '交回的成果',
    subagentReportTitle: '子任务报告 · {label}',
    viewReport: '查看报告',
    refFrameEyebrow: '📎 参考画面',
    aiFrameEyebrow: '🖼 中间过程效果图',
    frameSub: '{time} 产出 · 点击放大查看',
    docEyebrow: '📄 中间文稿产出 · {file}',
    docSub: '{time} 写入 · 约 {kb}k 字 · 点击阅读草稿',
    audioEyebrow: '🔊 过程配音试听（{count} 段）',
    lightboxDefaultTitle: '效果图预览',
    docModalDefaultTitle: '中间文稿预览',
    closePreview: '关闭预览',
    tlAria: '回放时间轴与控制',
    tlControlsAria: '播放控制',
    tlJumpAria: '跳到第 {step} 步：{label}',
    tlStepMeta: '第 {step} 步 · {time}',
    tlCompressPin: '压缩 #{seq}',
    tlCompressTitle: '🗜 上下文压缩 #{seq}（-{dropped}k）',
    tlPromptTitle: '💬 提问 #{turn}：{summary}',
    tlStepFallback: '步骤详情',
    defaultRefFrame: '参考画面 #{n}',
    defaultAiFrame: '过程产出 #{n}',
    defaultAudioClip: '试听片段',
    statSearch: '搜索 {n} 次',
    statOpen: '打开 {n} 个网页',
    statRead: '读 {n} 个文件',
    statFind: '查找 {n} 次',
    statView: '看 {n} 张图',
    statCommand: '运行 {n} 条命令',
    statCode: '运行 {n} 段代码',
    statEdit: '写 {n} 个文件',
    statSkill: '加载 {n} 个技能',
    statAgent: '派出 {n} 个子任务',
    statReply: '收到 {n} 份子任务结果',
    statOther: '其他操作 {n} 次',
    statSep: '，',
    execToolsFallback: '执行工具',
  },
  en: {
    langCode: 'en',
    toggleLangLabel: '中文',
    toggleLangTitle: '切换到中文',
    play: '▶ Play',
    pause: '⏸ Pause',
    replay: '↺ Replay',
    playAria: 'Play',
    pauseAria: 'Pause',
    replayAria: 'Replay',
    prevStep: 'Previous step',
    nextStep: 'Next step',
    sendOrPause: 'Send or pause',
    pausePlayback: 'Pause playback',
    sendThisPrompt: 'Send this prompt',
    waitNextStep: 'Waiting for next step',
    composerPlaceholder: 'Send a message to Agent…',
    composerFinished: 'Session finished · Click any message above to inspect its context snapshot',
    emptyHintStart: 'Click <b>▶ Play</b> at the bottom-left',
    emptyHintOrSend: ' or the blue <b>↑</b> send button',
    emptyHintEnd: ' to replay the conversation and live context growth',
    activeContext: 'Active Context',
    snapInitial: 'Snapshot: Initial Mount',
    snapInspect: 'Inspecting: Step {step} / {total}',
    snapCurrent: 'Step {step} / {total}',
    usedSuffix: 'used',
    freeSpaceTitle: 'Free Context Space',
    autoCompactTriggerTitle: 'Auto-compaction Trigger (80%)',
    headroomTitle: 'Autocompact Headroom (12%)',
    outputReserveTitle: 'Max Output Reserve (8%)',
    legendSys: 'System Prompt',
    legendSchema: 'Tool Schemas',
    legendUser: 'User Prompts',
    legendMem: 'Memory & Rules',
    legendSkill: 'Skills',
    legendMsg: 'Assistant',
    legendTool: 'Tool Outputs',
    catSys: 'System Prompt',
    catSchema: 'Tool Schemas & MCP',
    catUser: 'User Messages',
    catMem: 'Memory & Injected Rules',
    catSkill: 'Skills',
    catMsg: 'Assistant Messages',
    catTool: 'Tool Outputs',
    contextInspector: 'Context Inspector',
    contextInspectorHint: 'Click a bar segment or message to inspect',
    emptyCategory: 'No items at this step',
    viewFullPayload: 'View full payload ↗',
    omittedImages: '({prefix}{count} attached image(s) omitted)',
    omittedImagesAlso: 'plus ',
    compactTitle: 'Context Compaction #{seq}',
    compactManual: 'Manual /compact',
    compactHandoff: 'Handoff',
    compactAuto: 'Auto Compact',
    compactFreed: ' · freed {tokens}',
    compactDesc: 'Archived {count} prior tool outputs & turns; preserved system prompt, schemas, memory rules, and structured handoff summary.',
    compactViewBtn: 'View Summary ↗',
    compactModalTitle: 'Compaction Summary',
    asksYou: '{tool} asks',
    deliverablesTitle: 'Deliverables',
    subagentReportTitle: 'Sub-agent Report · {label}',
    viewReport: 'View Report',
    refFrameEyebrow: '📎 Reference Image',
    aiFrameEyebrow: '🖼 Stage Output',
    frameSub: 'Produced at {time} · Click to enlarge',
    docEyebrow: '📄 Draft Document · {file}',
    docSub: 'Written at {time} · ~{kb}k chars · Click to read',
    audioEyebrow: '🔊 Audio Clips ({count})',
    lightboxDefaultTitle: 'Preview',
    docModalDefaultTitle: 'Document Preview',
    closePreview: 'Close preview',
    tlAria: 'Playback timeline and controls',
    tlControlsAria: 'Playback controls',
    tlJumpAria: 'Jump to step {step}: {label}',
    tlStepMeta: 'Step {step} · {time}',
    tlCompressPin: 'Compact #{seq}',
    tlCompressTitle: '🗜 Compaction #{seq} (-{dropped}k)',
    tlPromptTitle: '💬 Prompt #{turn}: {summary}',
    tlStepFallback: 'Step details',
    defaultRefFrame: 'Reference #{n}',
    defaultAiFrame: 'Stage Output #{n}',
    defaultAudioClip: 'Audio clip',
    statSearch: 'searched {n}x',
    statOpen: 'opened {n} page(s)',
    statRead: 'read {n} file(s)',
    statFind: 'found {n}x',
    statView: 'viewed {n} image(s)',
    statCommand: 'ran {n} command(s)',
    statCode: 'ran {n} script(s)',
    statEdit: 'edited {n} file(s)',
    statSkill: 'loaded {n} skill(s)',
    statAgent: 'spawned {n} sub-agent(s)',
    statReply: 'received {n} sub-agent report(s)',
    statOther: '{n} tool action(s)',
    statSep: ', ',
    execToolsFallback: 'Executed tools',
  },
}

function resolveLang(input) {
  const raw = String(input || '').trim().toLowerCase()
  if (raw.startsWith('en')) return 'en'
  if (raw.startsWith('zh')) return 'zh'
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
  const envLang = typeof process !== 'undefined' ? (process.env.LC_ALL || process.env.LANG || '') : ''
  if (envLang.toLowerCase().startsWith('zh')) return 'zh'
  return 'zh'
}

function createTranslator(lang = 'zh') {
  const resolved = resolveLang(lang)
  const dict = DICTS[resolved] || DICTS.zh
  const t = (key, vars = {}) => {
    let str = dict[key] ?? DICTS.zh[key] ?? key
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v ?? ''))
    }
    return str
  }
  t.lang = resolved
  t.dict = dict
  return t
}

// --- markdown.mjs ---
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch])
}

function renderInline(raw) {
  let text = String(raw ?? '')
  text = text
    .replace(/!\[[^\]]*\]\((?!https?:)[^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1')

  const codeSpans = []
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`
    codeSpans.push(`<code>${escapeHtml(code)}</code>`)
    return token
  })

  const links = []
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const token = `\u0000LINK${links.length}\u0000`
    links.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)
    return token
  })

  text = escapeHtml(text)

  text = text.replace(/(^|[\s(（])(https?:\/\/[^\s<)"'）】]+)/g, (_, pre, url) => (
    `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  ))

  text = text.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')

  text = text.replace(/\u0000LINK(\d+)\u0000/g, (_, idx) => links[Number(idx)] || '')
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)] || '')
  return text
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cell => cell.trim())
}

function isTableSeparator(line) {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  const cells = parseTableRow(trimmed)
  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c))
}

function renderMarkdown(source) {
  const raw = String(source ?? '').replace(/\r\n/g, '\n').trim()
  if (!raw) return ''

  const lines = raw.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    const fence = line.match(/^```([\w-]*)\s*$/)
    if (fence) {
      const lang = fence[1]
      const codeLines = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push('<hr>')
      i++
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      i++
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(line)
      i += 2
      const bodyRows = []
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        bodyRows.push(parseTableRow(lines[i]))
        i++
      }
      const thead = `<thead><tr>${headers.map(h => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`
      const tbody = bodyRows.length
        ? `<tbody>${bodyRows.map(row => `<tr>${headers.map((_, cIdx) => `<td>${renderInline(row[cIdx] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`
        : ''
      out.push(`<div class="ws-md-table"><table>${thead}${tbody}</table></div>`)
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${renderMarkdown(quoteLines.join('\n'))}</blockquote>`)
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, '').trim())}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, '').trim())}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(renderInline(lines[i]))
      i++
    }
    if (paraLines.length) {
      out.push(`<p>${paraLines.join('<br>')}</p>`)
    }
  }

  return out.join('\n')
}

// --- timeline.mjs ---
const kinds = {
  search: 'look', open: 'look', read: 'look', find: 'look', view: 'look',
  command: 'make', code: 'make', edit: 'make', skill: 'make', other: 'make',
  agent: 'send', reply: 'back',
}
const order = ['send', 'back', 'look', 'make']
const waitThreshold = 150
const binSeconds = 30

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

function kindOf(stats = {}) {
  const found = Object.keys(stats).map(key => kinds[key] || 'make')
  return order.find(kind => found.includes(kind)) || 'make'
}

function extractSkillNames(item, knownSkills = new Set()) {
  const names = new Set()
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
  for (const item of work) {
    const summary = String(item.summary || '')
    const input = String(item.input || '')
    for (const match of summary.matchAll(/(?:读取|写入|修改|查看)\s+([^\s，；,]+)/g)) {
      const target = match[1].trim()
      if (!target) continue
      if (/AGENTS\.md|CLAUDE\.md|memory/i.test(target)) memories.push(target)
      else tools.push(target)
      if (summary.startsWith('写入') || summary.startsWith('修改')) changes.push(target)
    }
    for (const match of input.matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\n\\"]+)/g)) {
      const name = match[1].trim().split('/').pop()
      if (name) {
        tools.push(name)
        changes.push(name)
      }
    }
    for (const match of input.matchAll(/"(?:file_path|path)"\s*:\s*"([^"]+)"/g)) {
      const name = match[1].trim().split('/').pop()
      if (!name) continue
      if (/AGENTS\.md|CLAUDE\.md|memory/i.test(name)) memories.push(name)
      else tools.push(name)
      if (item.stats?.edit) changes.push(name)
    }
    if (!tools.length && summary) tools.push(summary.slice(0, 28))
  }
  return { tools, changes, memories }
}

function extractStepDocs(toolItems, stepIndex) {
  const byFile = new Map()
  toolItems.forEach((item, idx) => {
    if (!item.input) return
    const m = String(item.summary || '').match(/^(?:写入|修改|Write|Edit)\s+([^\s、,]+\.md)(?:\s|$)/i)
    if (!m) return
    const file = m[1]
    if (file.startsWith('_') || /^\d{4}-\d{2}-\d{2}\.md$/.test(file)) return
    let content = String(item.input).trim()
    if (/^\*\*\* Begin Patch\b/.test(content)) {
      const bodyLines = content
        .split('\n')
        .filter(line => !/^(\*\*\* (?:Begin Patch|End Patch|Add File:|Update File:|Delete File:|Move to:)|@@)/.test(line) && !line.startsWith('-'))
        .map(line => (line.startsWith('+') || line.startsWith(' ')) ? line.slice(1) : line)
      content = bodyLines.join('\n').trim()
    }
    let bodyWithoutFm = content
    let fmTitle = ''
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (fmMatch) {
      fmTitle = fmMatch[1].match(/^\s*title\s*:\s*['"]?([^\r\n'"]+)['"]?\s*$/m)?.[1]?.trim() || ''
      bodyWithoutFm = fmMatch[2].trim()
    }
    const headingMatch = bodyWithoutFm.match(/^#{1,3}\s+([^\r\n]+)/m)
    if (!headingMatch && !fmTitle) return
    const title = (headingMatch ? headingMatch[1].replace(/^#+\s*/, '').trim() : fmTitle) || file
    byFile.set(file, {
      id: `doc-${stepIndex}-${idx}`,
      file,
      title,
      chars: content.length,
      content: bodyWithoutFm || content,
      t: item.t || 0,
    })
  })
  return [...byFile.values()]
}

function extractStepSubagents(toolItems, stepIndex) {
  const list = []
  toolItems.forEach((item, idx) => {
    const rawSum = String(item.summary || '')
    const isSub = Boolean(
      item.stats?.agent ||
      item.agent ||
      item.name === 'agent_message' ||
      item.name === 'agent-message' ||
      (item.stats?.reply && /Agent\s+"|^子任务/.test(rawSum) && !/Background command/i.test(rawSum))
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
    if (!label || /^给子任务发消息/.test(rawSum)) return
    const combined = `${rawSum}\n${item.output || ''}`
    const isAsyncSpawn = /^(?:spawn_agent|collaboration__spawn_agent|followup_task|collaboration__followup_task)$/.test(item.name || '')
    let state = 'sent'
    let badge = '派出'
    let report = ''
    if (/was stopped|中途打断|已取消/i.test(combined)) {
      state = 'stopped'
      badge = '已叫停'
    } else if (/failed:|terminated early|rate_limit|hit your session limit|^Error:\s*Failed/im.test(combined)) {
      state = 'failed'
      badge = /limit|429/i.test(combined) ? '额度中断' : '失败'
    } else if (item.stats?.reply || (!isAsyncSpawn && item.output && item.output.length > 80 && !item.output.trim().startsWith('{'))) {
      state = 'done'
      badge = '已交回'
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
      work.push(item)
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

  const sysRecords = (initCtx.sys?.length ? initCtx.sys : defaultSystemPrompts(sessionTool)).map(r => registerRecord({ ...r, stepIndex: -1 }))
  const schemaRecords = (initCtx.schema?.length ? initCtx.schema : defaultToolSchemas(sessionTool)).map(r => registerRecord({ ...r, stepIndex: -1 }))
  const schemaIdSet = new Set(schemaRecords.map(r => r.id))
  for (const r of schemaRecords) if (r.title) schemaIdSet.add(`schema-dyn-${String(r.title).replace(/[^a-zA-Z0-9_-]/g, '_')}`)
  const userRecords = []
  let toolRecords = []
  const skillRecords = (initCtx.skill?.length ? initCtx.skill : defaultSkillCatalog()).map(r => registerRecord({ ...r, stepIndex: -1 }))
  const knownSkillNames = new Set(skillRecords.map(r => r.title).filter(Boolean))
  const msgRecords = []
  const memRecords = (initCtx.mem?.length ? initCtx.mem : defaultInjectedContext(sessionTool, sessionStart)).map(r => registerRecord({ ...r, stepIndex: -1 }))

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
  const allMemories = ['AGENTS.md']
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
        count: `${records.length} Items`,
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
        tag: `Turn #${turnCount}`,
        title: cleanPromptText.slice(0, 56) || 'User message',
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
            meta: `≈${(skTok / 1000).toFixed(1)}k · Turn #${turnCount}`,
            payload: `# ${skill} (SKILL.md)\nLoaded into active context.`,
          }))
        }
      }
      kind = 'prompt'
      primaryCat = 'user'
      speedLabel = '1.0×'
      dwellMs = 1500
      detailTitle = `Prompt #${turnCount}`
      detailSnippet = (first.text || '').slice(0, 260)
      inBrief = 'User message appended to context'
      responseBrief = 'Waiting for Agent reasoning & tool calls'
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
      detailTitle = `Context Compaction #${compactInfo.seq}`
      detailSnippet = summaryText.slice(0, 260)
      inBrief = `${(preTokens / 1000).toFixed(1)}k → ${(postTokens / 1000).toFixed(1)}k`
      responseBrief = `Archived ${archivedTools} tool outputs (-${(droppedTokens / 1000).toFixed(1)}k tokens)`
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
        tag: `Reply #${msgSeq}`,
        title: cleanReply.slice(0, 56) || 'Assistant reply',
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
      detailTitle = 'Assistant Response'
      detailSnippet = (first.text || '').slice(0, 260)
      inBrief = allTools.length ? `Synthesizing (${allTools.slice(-2).join(', ')})` : 'Direct response'
      responseBrief = cleanReply.slice(0, 96) || 'Completed response'
    } else {
      const toolItems = group.items.filter(item => item.type === 'tool')
      const reasoningItems = group.items.filter(item => item.type === 'reasoning')
      const stats = sumStats(toolItems)
      const extracted = extractFileChips(toolItems)
      stepDocs = extractStepDocs(toolItems, index)
      stepSubagents = extractStepSubagents(toolItems, index)
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
            tag: 'Rule',
            title: `${memName}`,
            meta: `≈${(memTok / 1000).toFixed(1)}k · Step ${index + 1}`,
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
          tag: 'Thinking',
          title: rItem.text.replace(/\s+/g, ' ').trim().slice(0, 54),
          meta: `≈${(rTok / 1000).toFixed(1)}k · Reasoning`,
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
              meta: `≈${(skTok / 1000).toFixed(1)}k · Step ${index + 1}`,
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
        const isSpot = Boolean(item.stats?.edit || item.stats?.skill)
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
            tag: 'Preview',
            title: `${fr.label}`,
            meta: '≈1.2k tok',
            payload: `Preview frame: ${fr.label}`,
            images: [fr.img],
          }))
        }
        rawMontage.push({
          tag: 'Preview',
          title: `${fr.label}`,
          isSpot: true,
          speed: '🖼',
        })
      }
      for (const doc of stepDocs) {
        rawMontage.push({
          tag: 'Draft',
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
        detailTitle = `Tool Call × ${toolItems.length}`
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
          user: latestUserPrompt || 'Session Start',
          in: inBrief,
          response: responseBrief,
        },
        categories,
      },
    }
  })

  return { steps, initialSnapshot, contextRecords }
}

function timeline(session, { lang = 'zh' } = {}) {
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
    ...(item.type === 'tool' ? { k: kindOf(item.stats) } : {}),
  }))
  const lanes = items
    .filter(item => item.type === 'tool' && item.agent && item.d !== undefined && (item.stats?.agent || item.name === 'followup_task'))
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

function sumStats(items) {
  const totals = {}
  for (const item of items || []) {
    for (const [key, value] of Object.entries(item.stats || {})) {
      totals[key] = (totals[key] || 0) + value
    }
  }
  return totals
}

const minutes = seconds => Math.max(1, Math.round(seconds / 60))

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

function describeStats(stats, keys = statKeyMap.map(([key]) => key), lang = 'zh') {
  const t = createTranslator(lang)
  return statKeyMap
    .filter(([key]) => keys.includes(key) && stats[key])
    .map(([key, dictKey]) => t(dictKey, { n: stats[key] }))
    .join(t('statSep'))
}

// --- render.mjs ---
const escape = escapeHtml



const toolLabels = {
  codex: 'Codex',
  workbuddy: 'WorkBuddy',
  'claude-code': 'Claude Code',
  'claude-ai': 'Claude',
}

const short = (text, length) => {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim()
  return line.length > length ? `${line.slice(0, length)}…` : line
}

const localLinks = text => String(text ?? '')
  .replace(/!\[[^\]]*\]\((?!https?:)[^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1')

const plain = text => localLinks(text)
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/\*\*|__|`/g, '')

const imageMark = /\[(?:附图|图片)\]/g
const unmarked = text => String(text ?? '').replace(imageMark, '').replace(/\n{3,}/g, '\n\n').trim()
const fixed = number => Number(Number(number || 0).toFixed(1))
const validVideo = /\.(mp4|webm|mov)$/i

function wallClock(start, seconds = 0, withSeconds = false) {
  const baseMs = Date.parse(start)
  if (!Number.isFinite(baseMs)) return elapsedClock(seconds)
  return new Date(baseMs + seconds * 1000).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  })
}

function elapsedClock(seconds = 0) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rem = s % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(rem)}` : `${pad(m)}:${pad(rem)}`
}

function resolveAsset(src, baseUrl = '') {
  if (!src) return ''
  if (/^(?:https?:|data:|blob:|\/)/i.test(src)) return src
  if (!baseUrl || baseUrl === '.' || baseUrl === './') return src
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${prefix}${String(src).replace(/^\.\//, '')}`
}

function scrubber(line, idSuffix = 'main') {
  const width = 1040
  const height = 46
  const base = 40
  const end = Math.max(1, line.end || 1)
  const x = seconds => fixed((seconds / end) * width)
  const peak = Math.max(1, ...(line.bins || [1]))
  const id = `scrub-${idSuffix}`
  const marks = [
    `<defs><pattern id="${escape(id)}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" class="sessions-hatch"/></pattern></defs>`,
    ...(line.waits || []).map(wait => `<rect x="${x(wait.s)}" y="${base - 24}" width="${fixed(x(wait.e) - x(wait.s))}" height="24" fill="url(#${escape(id)})"/>`),
    ...(line.bins || []).map((count, index) => {
      const barHeight = count ? fixed(3 + (count / peak) * 21) : 1
      return `<rect x="${fixed(x(index * binSeconds) + 0.5)}" y="${fixed(base - barHeight)}" width="${Math.max(1, fixed(x(binSeconds) - 1.5))}" height="${barHeight}" class="${count ? 'session-busy' : 'session-idle'}"/>`
    }),
    ...(line.items || []).filter(item => item.type === 'user').map(item => `<circle cx="${x(item.t)}" cy="6" r="4" class="sessions-you"/>`),
    `<line x1="0" x2="0" y1="0" y2="${height}" class="session-playhead"/>`,
  ]
  return `<svg class="session-scrubber" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${marks.join('')}</svg>`
}

const isWide = frames => (frames || []).filter(frame => frame.w > frame.h).length * 2 > (frames || []).length

function thumbs(names, baseUrl = '') {
  if (!names?.length) return ''
  return `<span class="session-thumbs">${names.map(name => {
    const url = escape(resolveAsset(name, baseUrl))
    return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="" width="96" loading="lazy"></a>`
  }).join('')}</span>`
}

function clips(audio, baseUrl = '') {
  if (!audio?.length) return ''
  return `<ul class="session-audio">${audio.map(clip => (
    `<li><span>${escape(clip.label)}</span><audio controls preload="none" src="${escape(resolveAsset(clip.src, baseUrl))}"></audio></li>`
  )).join('')}</ul>`
}

function renderStepArtifacts(stepMeta, { skipImages = [], renderMd, t, baseUrl = '' } = {}) {
  const frames = (stepMeta?.frames || []).filter(fr => !skipImages.includes(fr.img))
  const docs = stepMeta?.docs || []
  const subagents = stepMeta?.subagents || []
  const audios = stepMeta?.audios || []
  if (!frames.length && !docs.length && !subagents.length && !audios.length) return ''

  const subagentHtml = subagents.length
    ? `<div class="session-subagent-strip">${subagents.map(sa => {
      const inner = `<span class="session-sub-dot is-${escape(sa.state)}"></span><span class="session-sub-name">${escape(sa.label)}</span><em class="session-sub-badge is-${escape(sa.state)}">${escape(sa.badge)}</em>`
      if (sa.report && renderMd) {
        return `<button type="button" class="session-subagent-pill is-clickable" data-doc-open="${escape(sa.id)}" data-doc-title="${escape(t('subagentReportTitle', { label: sa.label }))}">${inner}<b>${escape(t('viewReport'))}</b></button><template data-doc-html="${escape(sa.id)}">${renderMd(sa.report)}</template>`
      }
      return `<span class="session-subagent-pill">${inner}</span>`
    }).join('')}</div>`
    : ''

  const frameCards = frames.map(fr => {
    const isPortrait = fr.w && fr.h ? fr.h > fr.w : true
    const eyebrow = fr.who === 'you' ? t('refFrameEyebrow') : t('aiFrameEyebrow')
    const imgUrl = escape(resolveAsset(fr.img, baseUrl))
    return `<button type="button" class="session-frame-card${isPortrait ? '' : ' is-wide'}" data-lightbox-src="${imgUrl}" data-lightbox-label="${escape(fr.label)}">
      <span class="session-frame-thumb"><img src="${imgUrl}" alt="${escape(fr.label)}" loading="lazy"></span>
      <span class="session-frame-meta">
        <span class="session-frame-eyebrow">${escape(eyebrow)}</span>
        <b class="session-frame-title">${escape(fr.label)}</b>
        <small class="session-frame-sub">${escape(t('frameSub', { time: elapsedClock(fr.t) }))}</small>
      </span>
    </button>`
  }).join('')

  const docCards = docs.map(doc => {
    const kb = Math.max(0.1, Math.round((doc.chars || 0) / 100) / 10)
    const tpl = renderMd ? `<template data-doc-html="${escape(doc.id)}">${renderMd(doc.content || '')}</template>` : ''
    return `<button type="button" class="session-doc-card" data-doc-open="${escape(doc.id)}" data-doc-title="${escape(doc.title)} (${escape(doc.file)})">
      <span class="session-doc-icon" aria-hidden="true">MD</span>
      <span class="session-frame-meta">
        <span class="session-doc-eyebrow">${escape(t('docEyebrow', { file: doc.file }))}</span>
        <b class="session-frame-title">${escape(doc.title)}</b>
        <small class="session-frame-sub">${escape(t('docSub', { time: elapsedClock(doc.t), kb }))}</small>
      </span>
    </button>${tpl}`
  }).join('')

  const audioCard = audios.length
    ? `<div class="session-audio-card">
      <span class="session-audio-eyebrow">${escape(t('audioEyebrow', { count: audios.length }))}</span>
      <ul class="session-audio-inline">${audios.map(clip => (
        `<li><span>${escape(clip.label)}</span><audio controls preload="none" src="${escape(resolveAsset(clip.src, baseUrl))}"></audio></li>`
      )).join('')}</ul>
    </div>`
    : ''

  const mediaRow = (frameCards || docCards || audioCard)
    ? `<div class="session-artifact-cards">${frameCards}${docCards}${audioCard}</div>`
    : ''

  return `<div class="session-frame-deck" data-frame-deck>${subagentHtml}${mediaRow}</div>`
}

function renderTimelineBar(line, t) {
  const steps = line.steps || []
  const total = steps.length
  const rawPins = []
  steps.forEach((s, idx) => {
    const pct = total > 0 ? ((idx + 0.5) / total) * 100 : 0
    if (s.compactInfo) {
      const droppedK = ((s.compactInfo.droppedTokens || 0) / 1000).toFixed(0)
      rawPins.push({
        idx,
        pct,
        pinType: 'compress',
        label: `${t('tlCompressPin', { seq: s.compactInfo.seq })}${droppedK > 0 ? ` (-${droppedK}k)` : ''}`,
        turn: s.turn,
      })
    } else if (s.frames?.length) {
      const aiFrame = s.frames.find(f => f.who === 'ai') || s.frames[0]
      rawPins.push({ idx, pct, pinType: 'frame', label: aiFrame.label, turn: s.turn })
    } else if (s.docs?.length) {
      rawPins.push({ idx, pct, pinType: 'doc', label: s.docs[0].title, turn: s.turn })
    } else if (s.kind === 'prompt') {
      rawPins.push({ idx, pct, pinType: 'turn', label: `#${s.turn}`, turn: s.turn })
    }
  })

  const occupiedPcts = []
  const canShowText = pct => pct >= 5 && pct <= 95 && occupiedPcts.every(p => Math.abs(p - pct) >= 11)
  for (const pin of rawPins) {
    if (pin.pinType === 'compress' && canShowText(pin.pct)) {
      pin.showText = true
      occupiedPcts.push(pin.pct)
    }
  }
  for (const pin of rawPins) {
    if (pin.pinType === 'frame' && canShowText(pin.pct)) {
      pin.showText = true
      occupiedPcts.push(pin.pct)
    }
  }
  for (const pin of rawPins) {
    if (pin.pinType === 'doc' && canShowText(pin.pct)) {
      pin.showText = true
      occupiedPcts.push(pin.pct)
    }
  }
  if (rawPins.length <= 14) {
    for (const pin of rawPins) {
      if (pin.pinType === 'turn' && canShowText(pin.pct)) {
        pin.showText = true
        occupiedPcts.push(pin.pct)
      }
    }
  }

  const pinsHtml = rawPins.map(pin => {
    const text = pin.pinType === 'compress'
      ? (pin.showText ? `🗜 ${escape(short(pin.label, 11))}` : '🗜')
      : pin.pinType === 'frame'
        ? (pin.showText ? `🖼 ${escape(short(pin.label, 8))}` : '🖼')
        : pin.pinType === 'doc'
          ? (pin.showText ? `📄 ${escape(short(pin.label, 8))}` : '📄')
          : (pin.showText ? `💬 #${pin.turn}` : '')
    const cls = `session-tl-pin is-${pin.pinType}${pin.showText ? ' has-label' : ' is-compact'}`
    return `<button type="button" class="${cls}" style="left:${pin.pct.toFixed(2)}%" data-tl-jump="${pin.idx}" data-tl-hover="${pin.idx}" aria-label="${escape(t('tlJumpAria', { step: pin.idx + 1, label: pin.label }))}">${text}</button>`
  }).join('')

  const segsHtml = steps.map((s, idx) => (
    `<div class="session-tl-seg${s.compactInfo ? ' has-compress' : s.frames?.length ? ' has-frame' : s.docs?.length ? ' has-doc' : ''}" data-tl-step="${idx}" data-tl-hover="${idx}"></div>`
  )).join('')
  const segGap = total > 360 ? '0px' : total > 160 ? '1px' : '2px'

  return `<footer class="session-timeline-bar" data-session-timeline aria-label="${escape(t('tlAria'))}">
    <div class="session-transport" role="group" aria-label="${escape(t('tlControlsAria'))}">
      <button type="button" class="session-nav-btn" data-session-prev disabled aria-label="${escape(t('prevStep'))}">◀</button>
      <button class="session-play" type="button" aria-label="${escape(t('playAria'))}">${escape(t('play'))}</button>
      <button type="button" class="session-nav-btn" data-session-next aria-label="${escape(t('nextStep'))}">▶</button>
      <span class="session-speed-badge" data-session-speed><b>0</b> / ${total} · 00:00</span>
    </div>
    <div class="session-tl-track-wrap" data-tl-track>
      <span class="session-composer-progress" data-session-progress aria-hidden="true"></span>
      <div class="session-tl-pop" data-tl-pop hidden></div>
      <div class="session-tl-pins" data-tl-pins>${pinsHtml}</div>
      <div class="session-tl-segs" style="--tl-gap:${segGap}" data-tl-segs>${segsHtml}</div>
    </div>
  </footer>`
}

function renderBrowserCategories(categories = [], t) {
  return categories.map(cat => {
    const list = cat.items || []
    const isEmpty = list.length === 0
    const deltaCls = String(cat.delta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
    const tokDeltaCls = String(cat.tokDelta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
    const itemsHtml = list.map(item => (
      `<div class="lc-br-elem session-browser-item${item.isNew ? ' is-new' : ''}" data-browser-item="${escape(item.id)}">
        <button type="button" class="lc-br-elem-row session-browser-item-btn" data-browser-item-toggle="${escape(item.id)}" aria-expanded="false">
          <span class="lc-br-chev"></span>
          ${item.tag ? `<span class="lc-br-tag">${escape(item.tag)}</span>` : ''}
          <span class="lc-br-preview session-browser-item-title">${escape(item.title)}</span>
          <span class="session-browser-item-meta"><span class="lc-br-time">${escape(item.meta || '')}</span></span>
        </button>
        <div class="lc-br-content session-browser-payload" hidden></div>
      </div>`
    )).join('')
    return `<div class="lc-br-cat session-browser-cat${isEmpty ? ' is-empty' : ''}" data-browser-cat="${escape(cat.id)}">
      <button type="button" class="lc-br-cat-row session-browser-cat-btn" data-browser-cat-toggle="${escape(cat.id)}" aria-expanded="false"${isEmpty ? ' disabled' : ''}>
        <span class="lc-br-chev"></span>
        <span class="lc-br-count-grp">
          <i class="session-cat-dot is-${escape(cat.color || cat.id)}"></i>
          <span class="lc-br-cat-label">${escape(cat.name)}</span>
          <span class="lc-br-cat-count">${escape(cat.count)}</span>
          ${cat.delta ? `<b class="lc-br-delta ${deltaCls} session-delta-badge">${escape(cat.delta)}</b>` : ''}
        </span>
        <span class="lc-br-tokens-grp">
          ${cat.tokDelta ? `<b class="lc-br-delta ${tokDeltaCls}">${escape(cat.tokDelta)}</b>` : ''}
          <span class="lc-br-tokens">${escape(cat.tok)}</span>
        </span>
      </button>
      <div class="lc-br-body session-browser-items" hidden>${itemsHtml || `<p class="session-ctx-empty">${escape(t('emptyCategory'))}</p>`}</div>
    </div>`
  }).join('')
}

function contextSidebar(line, t) {
  const initial = line.initialSnapshot
  const tok = n => `≈${(Number(n || 0) / 1000).toFixed(1)}k`
  return `<aside class="session-context-aside" aria-label="${escape(t('activeContext'))}" data-session-aside>
    <section class="sp-aside-sec" aria-label="${escape(t('activeContext'))}">
      <div class="sp-sec-head">
        <span class="sp-sec-title">${escape(t('activeContext'))}</span>
        <span class="sp-sec-snap" data-context-snap>${escape(t('snapInitial'))}</span>
      </div>
      <div class="lc-overview-num">
        <b data-context-tot>${escape((initial.totalTokens / 1000).toFixed(1))}k</b>
        <span>/ <span data-context-win>${escape(initial.windowLabel || '1.0M')}</span> tokens</span>
        <span class="lc-overview-pct"><b data-context-pct>${escape(String(initial.pct))}%</b>${escape(t('usedSuffix'))}</span>
      </div>
      <div class="lc-stacked" data-stacked-bar>
        <div class="lc-stacked-seg is-sys" data-seg="sys" data-cat-key="sys" style="width:${initial.segments.sys}%"></div>
        <div class="lc-stacked-seg is-schema" data-seg="schema" data-cat-key="schema" style="width:${initial.segments.schema}%"></div>
        <div class="lc-stacked-seg is-user" data-seg="user" data-cat-key="user" style="width:${initial.segments.user}%"></div>
        <div class="lc-stacked-seg is-mem" data-seg="mem" data-cat-key="mem" style="width:${initial.segments.mem}%"></div>
        <div class="lc-stacked-seg is-skill" data-seg="skill" data-cat-key="skill" style="width:${initial.segments.skill}%"></div>
        <div class="lc-stacked-seg is-msg" data-seg="msg" data-cat-key="msg" style="width:${initial.segments.msg}%"></div>
        <div class="lc-stacked-seg is-tool" data-seg="tool" data-cat-key="tool" style="width:${initial.segments.tool}%"></div>
        <div class="lc-stacked-free" title="${escape(t('freeSpaceTitle'))}"></div>
        <div class="lc-trigger" style="left:80%" title="${escape(t('autoCompactTriggerTitle'))}"></div>
        <div class="lc-reserve lc-reserve-headroom" style="left:80%;width:12%" title="${escape(t('headroomTitle'))}"></div>
        <div class="lc-reserve lc-reserve-output" style="left:92%;width:8%" title="${escape(t('outputReserveTitle'))}"></div>
      </div>
      <div class="lc-legend" data-lc-legend>
        <span class="lc-chip" data-cat-key="sys"><i class="session-cat-dot is-sys"></i><span class="lc-chip-label">${escape(t('legendSys'))}</span><span class="lc-chip-nums" data-pro-tok="sys">${escape(tok(initial.tokensByKind.sys))}</span></span>
        <span class="lc-chip" data-cat-key="schema"><i class="session-cat-dot is-schema"></i><span class="lc-chip-label">${escape(t('legendSchema'))}</span><span class="lc-chip-nums" data-pro-tok="schema">${escape(tok(initial.tokensByKind.schema))}</span></span>
        <span class="lc-chip" data-cat-key="user"><i class="session-cat-dot is-user"></i><span class="lc-chip-label">${escape(t('legendUser'))}</span><span class="lc-chip-nums" data-pro-tok="user">${escape(tok(initial.tokensByKind.user))}</span></span>
        <span class="lc-chip" data-cat-key="mem"><i class="session-cat-dot is-mem"></i><span class="lc-chip-label">${escape(t('legendMem'))}</span><span class="lc-chip-nums" data-pro-tok="mem">${escape(tok(initial.tokensByKind.mem))}</span></span>
        <span class="lc-chip" data-cat-key="skill"><i class="session-cat-dot is-skill"></i><span class="lc-chip-label">${escape(t('legendSkill'))}</span><span class="lc-chip-nums" data-pro-tok="skill">${escape(tok(initial.tokensByKind.skill))}</span></span>
        <span class="lc-chip" data-cat-key="msg"><i class="session-cat-dot is-msg"></i><span class="lc-chip-label">${escape(t('legendMsg'))}</span><span class="lc-chip-nums" data-pro-tok="msg">${escape(tok(initial.tokensByKind.msg))}</span></span>
        <span class="lc-chip" data-cat-key="tool"><i class="session-cat-dot is-tool"></i><span class="lc-chip-label">${escape(t('legendTool'))}</span><span class="lc-chip-nums" data-pro-tok="tool">${escape(tok(initial.tokensByKind.tool))}</span></span>
      </div>
    </section>
    <section class="sp-aside-sec sp-aside-browser" aria-label="${escape(t('contextInspector'))}">
      <div class="sp-sec-head">
        <span class="sp-sec-title">${escape(t('contextInspector'))}</span>
        <span class="sp-sec-hint">${escape(t('contextInspectorHint'))}</span>
      </div>
      <div class="lc-br-cats session-context-browser" data-context-browser>
        ${renderBrowserCategories(initial.categories, t)}
      </div>
    </section>
  </aside>`
}

function renderLog(session, line, { t, baseUrl = '' }) {
  const tool = toolLabels[session.tool] || session.tool || 'Agent'
  const render = text => renderMarkdown(localLinks(text))
  const entries = []
  let shown = -Infinity
  let stepIndex = 0

  const stamp = (seconds, forStep) => {
    if (seconds - shown < 300) return ''
    shown = seconds
    const baseMs = Date.parse(line.start)
    const iso = Number.isFinite(baseMs) ? new Date(baseMs + seconds * 1000).toISOString() : ''
    return `<li class="session-time" data-for-step="${forStep}" data-t="${seconds}"><time${iso ? ` datetime="${escape(iso)}"` : ''}>${escape(wallClock(line.start, seconds))}</time></li>`
  }

  let work = []
  const flush = () => {
    if (!work.length) return
    const stats = sumStats(work)
    const span = Math.max(...work.map(item => (item.agent ? item.t : item.d ?? item.t))) - work[0].t
    const count = work.filter(item => item.type === 'tool').length
    const thinkCount = work.filter(item => item.type === 'reasoning' && String(item.text || '').trim()).length
    const stepsHtml = work.map(item => {
      const time = `<time>${escape(wallClock(line.start, item.t, true))}</time>`
      if (item.type === 'reasoning') {
        const thinkLabel = t.lang === 'en' ? 'Thinking' : '思考'
        return `<li><details class="dsh-proc-row"><summary><span class="dsh-proc-dot is-think"></span><span class="dsh-proc-title">${thinkLabel}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-sum">${escape(short(item.text, 68))}</span>${time}</summary><div class="session-detail">${render(item.text)}</div></details></li>`
      }
      const body = [
        item.input && `<pre>${escape(item.input)}</pre>`,
        item.output && `<pre>${escape(item.output)}</pre>`,
        thumbs(item.images, baseUrl),
        clips(item.audio, baseUrl),
      ].filter(Boolean).join('')
      const toolTitle = escape(item.name || (t.lang === 'en' ? 'Tool' : '工具'))
      return body
        ? `<li><details class="dsh-proc-row"><summary><span class="dsh-proc-dot is-done"></span><span class="dsh-proc-title">${toolTitle}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-sum">${escape(item.summary)}</span>${time}</summary><div class="dsh-proc-io">${body}</div></details></li>`
        : `<li><div class="dsh-proc-row is-static"><span class="dsh-proc-dot is-done"></span><span class="dsh-proc-title">${toolTitle}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-sum">${escape(item.summary)}</span>${time}</div></li>`
    }).join('')

    if (!count && !thinkCount) {
      work = []
      return
    }
    const stepMeta = line.steps[stepIndex++]
    const summaryText = count
      ? (describeStats(stats, undefined, t.lang) || (t.lang === 'en' ? `Ran ${count} step(s)` : `执行了 ${count} 步操作`))
      : (t.lang === 'en' ? 'Thought before replying' : '进行了思考推理')
    const durationText = t.lang === 'en'
      ? (span >= 60 ? `${minutes(span)}m` : `${Math.max(1, Math.round(span))}s`)
      : (span >= 60 ? `${minutes(span)} 分钟` : `${Math.max(1, Math.round(span))} 秒`)
    const stepWord = count
      ? (t.lang === 'en' ? `${count} steps` : `${count} 步`)
      : (t.lang === 'en' ? `${thinkCount} thought(s)` : `${thinkCount} 段思考`)
    const echoCat = escape(stepMeta?.primaryCat || 'tool')
    entries.push(`${stamp(work[0].t, stepIndex - 1)}<li class="session-entry session-work" data-step="${stepIndex - 1}" data-echo-cat="${echoCat}" data-kind="${escape(stepMeta?.kind || 'fast-tools')}" data-t="${work[0].t}"><div class="session-montage-row" data-montage-row hidden></div><details class="session-chip dsh-process-group" data-process-details><summary><span class="dsh-proc-lead"></span><span class="dsh-proc-group-label">${escape(summaryText)}</span><i class="dsh-proc-sep"></i><span class="dsh-proc-dur">${escape(durationText)} · ${escape(stepWord)}</span></summary><div class="session-chip-body"><ol class="session-steps">${stepsHtml}</ol></div></details>${renderStepArtifacts(stepMeta, { renderMd: render, t, baseUrl })}</li>`)
    work = []
  }

  for (const item of line.items) {
    if (item.type === 'tool' || item.type === 'reasoning') {
      work.push(item)
      continue
    }
    flush()
    const stepMeta = line.steps[stepIndex++]
    if (item.type === 'user') {
      const kept = item.images?.length || 0
      const missing = ((item.text || '').match(imageMark) || []).length - kept
      const omittedSuffix = missing > 0
        ? `\n\n${t('omittedImages', { prefix: kept ? t('omittedImagesAlso') : '', count: missing })}`
        : ''
      const text = `${unmarked(item.text)}${omittedSuffix}`
      const hasCuratedFrames = Array.isArray(session.frames) && session.frames.length > 0
      const frameImgs = new Set((stepMeta?.frames || []).map(fr => fr.img))
      const inlineImages = hasCuratedFrames ? [] : (item.images || []).filter(img => !frameImgs.has(img))
      entries.push(`${stamp(item.t, stepIndex - 1)}<li class="session-entry session-you" data-step="${stepIndex - 1}" data-echo-cat="user" data-kind="prompt" data-t="${item.t}"><div class="session-bubble">${render(text)}${thumbs(inlineImages, baseUrl)}</div>${renderStepArtifacts(stepMeta, { renderMd: render, t, baseUrl })}</li>`)
    } else if (item.type === 'compact') {
      const ci = stepMeta?.compactInfo || {}
      const preK = ci.preTokens ? `${(ci.preTokens / 1000).toFixed(1)}k` : ''
      const postK = ci.postTokens ? `${(ci.postTokens / 1000).toFixed(1)}k` : ''
      const dropK = ci.droppedTokens ? `${(ci.droppedTokens / 1000).toFixed(1)}k` : ''
      const tpl = ci.docId && ci.content ? `<template data-doc-html="${escape(ci.docId)}">${render(ci.content)}</template>` : ''
      const badgeText = ci.trigger === 'manual' ? t('compactManual') : ci.trigger === 'handoff' ? t('compactHandoff') : t('compactAuto')
      const freedText = dropK ? t('compactFreed', { tokens: dropK }) : ''
      entries.push(`${stamp(item.t, stepIndex - 1)}<li class="session-entry session-compact" data-step="${stepIndex - 1}" data-echo-cat="tool" data-kind="compact" data-t="${item.t}"><div class="session-compact-card"><span class="session-compact-icon" aria-hidden="true">🗜</span><div class="session-compact-main"><div class="session-compact-head"><b>${escape(t('compactTitle', { seq: ci.seq || 1 }))}</b><span class="session-compact-tag">${escape(badgeText)}</span>${preK && postK ? `<span class="session-compact-meter">${escape(preK)} → ${escape(postK)}${escape(freedText)}</span>` : ''}</div><p class="session-compact-desc">${escape(t('compactDesc', { count: ci.archivedTools || 0 }))}</p></div>${ci.docId ? `<button type="button" class="session-compact-btn" data-doc-open="${escape(ci.docId)}" data-doc-title="${escape(ci.title || t('compactModalTitle'))}">${escape(t('compactViewBtn'))}</button>${tpl}` : ''}</div></li>`)
    } else {
      entries.push(`${stamp(item.t, stepIndex - 1)}<li class="session-entry session-ai" data-step="${stepIndex - 1}" data-echo-cat="msg" data-kind="reply" data-t="${item.t}"><div class="session-bubble">${item.question ? `<span class="session-who">${escape(t('asksYou', { tool }))}</span>` : ''}<div class="session-ai-body">${render(item.text)}</div>${renderStepArtifacts(stepMeta, { renderMd: render, t, baseUrl })}</div></li>`)
    }
  }
  flush()

  const deliverables = session.deliverables || session.files || []
  const filesHtml = deliverables.map(file => {
    const href = escape(resolveAsset(file.href, baseUrl))
    const cover = file.cover ? escape(resolveAsset(file.cover, baseUrl)) : ''
    return validVideo.test(file.href)
      ? `<figure class="session-video"><video controls preload="none" playsinline width="960" height="540"${cover ? ` poster="${cover}"` : ''}><source src="${href}" type="video/mp4"></video><figcaption><b>${escape(file.title)}</b>${file.meta ? `<small>${escape(file.meta)}</small>` : ''}</figcaption></figure>`
      : `<a class="session-file" href="${href}" target="_blank" rel="noopener noreferrer">${cover ? `<img src="${cover}" alt="" width="56" height="79" loading="lazy">` : ''}<span><b>${escape(file.title)}</b>${file.meta ? `<small>${escape(file.meta)}</small>` : ''}</span></a>`
  }).join('')
  if (filesHtml) {
    entries.push(`<li class="session-entry session-ai session-files" data-for-step="${Math.max(0, line.steps.length - 1)}" data-t="${line.end}"><div class="session-bubble"><span class="session-who">${escape(t('deliverablesTitle'))}</span>${filesHtml}</div></li>`)
  }
  return `<ol class="session-log">${entries.join('')}</ol>`
}

function buildPlayerData(session, line, { baseUrl = '' } = {}) {
  const tool = toolLabels[session.tool] || session.tool || 'Agent'
  const items = line.items.filter(item => item.type !== 'reasoning').map(item => {
    const labelText = item.type === 'tool' || item.type === 'compact' ? (item.summary || item.text || '') : plain(unmarked(item.text))
    const compact = { t: item.t, type: item.type, s: short(labelText, item.type === 'user' ? 400 : 120) }
    if (item.question) compact.q = 1
    return compact
  })
  const stripCatItems = snapshot => {
    if (!snapshot?.categories) return snapshot
    return {
      ...snapshot,
      categories: snapshot.categories.map(({ items: _items, ...rest }) => rest),
    }
  }
  const baseSnap = stripCatItems(line.initialSnapshot)
  const baseIdsByCat = Object.fromEntries((baseSnap?.categories || []).map(c => [c.id, (c.itemIds || []).join('\n')]))
  const slimStepSnapshot = snapshot => {
    if (!snapshot?.categories) return snapshot
    return {
      ...snapshot,
      categories: snapshot.categories.map(({ items: _items, name: _n, color: _c, itemIds, newIds, ...rest }) => {
        const sameIds = (itemIds || []).join('\n') === baseIdsByCat[rest.id]
        return {
          ...rest,
          ...(sameIds ? {} : { itemIds }),
          ...(newIds?.length ? { newIds } : {}),
        }
      }),
    }
  }
  const compactSteps = line.steps.map(step => ({
    ...step,
    ...(step.frames ? { frames: step.frames.map(fr => ({ ...fr, img: resolveAsset(fr.img, baseUrl) })) } : {}),
    contextSnapshot: slimStepSnapshot(step.contextSnapshot),
    ...(step.compactInfo ? { compactInfo: (({ content: _cc, ...rest }) => rest)(step.compactInfo) } : {}),
    ...(step.docs ? { docs: step.docs.map(({ content: _c, ...rest }) => rest) } : {}),
    ...(step.subagents ? { subagents: step.subagents.map(({ report: _r, ...rest }) => rest) } : {}),
  }))

  const contextRecords = Object.fromEntries(
    Object.entries(line.contextRecords || {}).map(([id, rec]) => [
      id,
      rec.images?.length
        ? { ...rec, images: rec.images.map(img => resolveAsset(img, baseUrl)) }
        : rec,
    ])
  )

  return {
    start: line.start,
    end: line.end,
    tool,
    items,
    initialSnapshot: baseSnap,
    contextRecords,
    steps: compactSteps,
    lanes: line.lanes.map(lane => ({ a: lane.agent, s: lane.s, e: lane.e })),
    waits: line.waits,
    frames: line.frames.map(frame => ({
      t: frame.t,
      src: resolveAsset(frame.img, baseUrl),
      label: frame.label,
      who: frame.who,
      w: frame.w,
      h: frame.h,
    })),
    wide: isWide(line.frames),
  }
}

function renderPlayerWidget(session, computedTimeline, {
  lang = 'zh',
  baseUrl = '',
  backHref = '',
  backLabel = '',
  showLangToggle = !backHref,
} = {}) {
  const t = createTranslator(lang || session.lang || 'zh')
  const line = computedTimeline || timeline(session, { lang: t.lang })
  const tool = toolLabels[session.tool] || session.tool || 'Agent'
  const title = session.title || session.task || `${tool} Session`
  const description = session.description || ''
  const firstItem = (session.items || [])[0]
  const rawFirstPrompt = firstItem?.type === 'user' ? unmarked(firstItem.text).trim() : ''
  const firstPromptDraft = rawFirstPrompt && rawFirstPrompt !== '（中途打断）' ? rawFirstPrompt : ''
  const hasInitialDraft = Boolean(firstPromptDraft)
  const dataJson = JSON.stringify(buildPlayerData(session, line, { baseUrl })).replace(/</g, '\\u003c')
  const leadBadge = backHref && backLabel
    ? `<a class="session-back" href="${escape(backHref)}">${escape(backLabel)}</a>`
    : `<span class="encore-brand-badge" aria-hidden="true">ENCORE</span>`
  const rightControls = showLangToggle
    ? `<div class="session-topbar-right">
        <button type="button" class="encore-lang-btn" data-encore-lang-toggle title="${escape(t('toggleLangTitle'))}">${escape(t('toggleLangLabel'))}</button>
      </div>`
    : ''

  return `<div class="session-app" data-encore-lang="${escape(t.lang)}">
    <header class="session-topbar">
      <div class="session-topbar-left">
        ${leadBadge}
        <span class="session-topbar-sep" aria-hidden="true">/</span>
        <h1 class="session-title">${escape(title)}</h1>
        <span class="session-model-pill">${escape(tool)}${session.model ? ` · ${escape(session.model)}` : ''}</span>
      </div>
      ${rightControls}
    </header>
    <section class="session-player" aria-label="${escape(t('tlAria'))}" hidden>
      ${scrubber(line)}
    </section>
    <div class="session-stage-grid" data-session-grid>
      <div class="session-chat-pane" data-session-chat>
        <div class="session-chat-scroll" data-session-scroll>
          <div class="dsh-chat-column">
            <div class="session-empty-stage" data-session-empty hidden>
              ${description ? `<p class="session-empty-desc">${escape(description)}</p>` : ''}
              <p class="session-empty-hint">${t('emptyHintStart')}${hasInitialDraft ? t('emptyHintOrSend') : ''}${t('emptyHintEnd')}</p>
            </div>
            ${renderLog(session, line, { t, baseUrl })}
          </div>
        </div>
        <div class="session-dock-wrap">
          <div class="session-composer" data-session-composer>
            <div class="session-composer-editor" data-session-stage-trigger>
              <div class="session-composer-text${hasInitialDraft ? '' : ' is-placeholder'}" data-session-composer-text>${escape(firstPromptDraft || t('composerPlaceholder'))}</div>
            </div>
            <div class="session-composer-bar">
              <span class="session-composer-left">
                <span class="session-composer-plus" aria-hidden="true">+</span>
                <span class="session-composer-perm" data-session-stage-badge>Workspace Write</span>
              </span>
              <span class="session-composer-right">
                <span class="session-composer-model">${escape(session.model || tool)}</span>
                <button type="button" class="session-composer-send${hasInitialDraft ? ' is-ready' : ''}" data-session-send aria-label="${escape(t('sendOrPause'))}"${hasInitialDraft ? '' : ' disabled'}>↑</button>
              </span>
            </div>
          </div>
        </div>
      </div>
      ${contextSidebar(line, t)}
    </div>
    ${renderTimelineBar(line, t)}
    <dialog class="session-lightbox" data-session-lightbox aria-label="${escape(t('lightboxDefaultTitle'))}">
      <div class="session-lightbox-inner">
        <div class="session-lightbox-head">
          <b data-lightbox-title>${escape(t('lightboxDefaultTitle'))}</b>
          <button type="button" class="session-lightbox-close" data-lightbox-close aria-label="${escape(t('closePreview'))}">✕</button>
        </div>
        <div class="session-lightbox-body">
          <img data-lightbox-img alt="">
          <article class="session-lightbox-doc" data-lightbox-doc hidden></article>
        </div>
      </div>
    </dialog>
    <script type="application/json" data-encore-session-data>${dataJson}</script>
  </div>`
}

// --- player-runtime.mjs ---
const shorten = (text, length) => (text.length > length ? `${text.slice(0, length)}…` : text)

function buildTypewriterFrames(text, count = 14) {
  const clean = String(text || '').trim()
  if (!clean) return ['']
  const total = Math.min(count, Math.max(3, clean.length))
  const frames = []
  for (let i = 1; i <= total; i++) {
    frames.push(clean.slice(0, Math.ceil((clean.length * i) / total)))
  }
  return frames
}

function splitReplyChunks(text, chunkSize = 5) {
  const clean = String(text || '')
  if (!clean) return ['']
  const chunks = []
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize))
  }
  return chunks
}

function createSessionPlaybackModel(session) {
  const steps = session.steps || []
  const contextRecords = session.contextRecords || {}
  const initCatMap = Object.fromEntries((session.initialSnapshot?.categories || []).map(c => [c.id, c]))
  let mode = 'overview'
  let currentIndex = Math.max(0, steps.length - 1)

  function hydrateSnapshot(snap) {
    if (!snap || !Array.isArray(snap.categories)) return snap
    return {
      ...snap,
      categories: snap.categories.map(cat => {
        const baseCat = initCatMap[cat.id] || {}
        const merged = {
          ...cat,
          name: cat.name || baseCat.name || cat.id,
          color: cat.color || baseCat.color || cat.id,
          itemIds: cat.itemIds || baseCat.itemIds || [],
        }
        if (Array.isArray(cat.items)) return merged
        const newSet = new Set(cat.newIds || [])
        const items = merged.itemIds
          .map(id => contextRecords[id] && ({ ...contextRecords[id], isNew: newSet.has(id) }))
          .filter(Boolean)
        return { ...merged, items }
      }),
    }
  }

  function decorateStep(index) {
    const clamped = Math.max(0, Math.min(steps.length - 1, index))
    currentIndex = clamped
    const step = steps[clamped]
    return {
      ...step,
      contextSnapshot: hydrateSnapshot(step.contextSnapshot),
      dimChat: step.kind === 'spotlight-change' && step.spotlight !== 'none',
      typewriterFrames: step.kind === 'prompt' ? buildTypewriterFrames(step.summary) : [],
      replyChunks: step.kind === 'reply' ? splitReplyChunks(step.summary) : [],
    }
  }

  return {
    getMode: () => mode,
    setMode: nextMode => {
      if (['overview', 'inspector', 'curve'].includes(nextMode)) mode = nextMode
      return mode
    },
    getSteps: () => steps,
    hydrateSnapshot,
    getCurrentIndex: () => currentIndex,
    selectStep: index => decorateStep(index),
    stepAtTime: time => {
      let idx = steps.findLastIndex(step => step.t <= time)
      if (idx < 0) idx = 0
      return decorateStep(idx)
    },
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.createSessionPlaybackModel = createSessionPlaybackModel
}

function attachPlayerController(containerEl, playerData, { lang = 'zh', initialStep = -1, onToggleLang } = {}) {
  const t = createTranslator(lang)
  const appEl = containerEl.querySelector('.session-app') || containerEl
  const root = containerEl.querySelector('.session-player')
  const play = containerEl.querySelector('.session-play')
  const prevBtn = containerEl.querySelector('[data-session-prev]')
  const nextBtn = containerEl.querySelector('[data-session-next]')
  const speedBadge = containerEl.querySelector('[data-session-speed]')
  const scrubber = root?.querySelector('.session-scrubber')
  const head = scrubber?.querySelector('.session-playhead')
  const width = scrubber?.viewBox?.baseVal?.width || 1040
  const log = containerEl.querySelector('.session-log')
  const chatPane = containerEl.querySelector('[data-session-chat]')
  const chatScroll = containerEl.querySelector('[data-session-scroll]') || chatPane
  const emptyStage = containerEl.querySelector('[data-session-empty]')
  const asidePane = containerEl.querySelector('[data-session-aside]')
  const snapLabel = asidePane?.querySelector('[data-context-snap]')
  const stackedBar = asidePane?.querySelector('[data-stacked-bar]')
  const composer = containerEl.querySelector('[data-session-composer]')
  const stageTrigger = containerEl.querySelector('[data-session-stage-trigger]')
  const composerText = containerEl.querySelector('[data-session-composer-text]')
  const sendBtn = containerEl.querySelector('[data-session-send]')
  const progressBar = containerEl.querySelector('[data-session-progress]')
  const timelineBar = containerEl.querySelector('[data-session-timeline]')
  const tlTrack = timelineBar?.querySelector('[data-tl-track]')
  const tlPop = timelineBar?.querySelector('[data-tl-pop]')
  const tlSegs = timelineBar ? [...timelineBar.querySelectorAll('[data-tl-step]')] : []
  const tlPins = timelineBar ? [...timelineBar.querySelectorAll('[data-tl-jump]')] : []
  const lightbox = containerEl.querySelector('[data-session-lightbox]')
  const lightboxImg = lightbox?.querySelector('[data-lightbox-img]')
  const lightboxDoc = lightbox?.querySelector('[data-lightbox-doc]')
  const lightboxTitle = lightbox?.querySelector('[data-lightbox-title]')
  const lightboxClose = lightbox?.querySelector('[data-lightbox-close]')
  const langToggleBtn = containerEl.querySelector('[data-encore-lang-toggle]')

  const stepEntries = log ? [...log.querySelectorAll('.session-entry[data-step]')].map(entry => ({
    entry,
    stepIndex: Number(entry.dataset.step),
    t: Number(entry.dataset.t),
  })) : []
  const auxEntries = log ? [...log.querySelectorAll('[data-for-step]')].map(entry => ({
    entry,
    forStep: Number(entry.dataset.forStep),
  })) : []

  const calm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }
  const model = createSessionPlaybackModel(playerData)
  const steps = model.getSteps()
  const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
  let curTime = 0
  let playHead = initialStep
  let prevRenderedHead = initialStep
  let selectedIdx = initialStep
  let userClickedInspect = false
  let isInitialMount = true
  let playing = false
  let stepBusy = false
  let follow = false
  let animatedHead = -2
  let animTimers = []
  let activeAnims = []
  let typingRaf = 0
  let activeCleanup = null
  let hoverCat = null
  let openCat = null
  const openItems = new Set()

  const camera = (() => {
    let targetTop = null
    let rafId = 0
    let lastTs = 0
    let userPausedFollow = false
    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
      targetTop = null
      lastTs = 0
    }
    if (chatScroll) {
      const onUserScrollGesture = () => {
        stop()
        const distFromBottom = chatScroll.scrollHeight - chatScroll.clientHeight - chatScroll.scrollTop
        userPausedFollow = distFromBottom > 48
      }
      chatScroll.addEventListener('wheel', onUserScrollGesture, { passive: true })
      chatScroll.addEventListener('touchstart', onUserScrollGesture, { passive: true })
    }
    const tick = ts => {
      if (!chatScroll || targetTop === null) {
        stop()
        return
      }
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60
      lastTs = ts
      const cur = chatScroll.scrollTop
      const maxScroll = Math.max(0, chatScroll.scrollHeight - chatScroll.clientHeight)
      const clampedTarget = Math.max(0, Math.min(maxScroll, targetTop))
      const diff = clampedTarget - cur
      if (Math.abs(diff) < 0.6 || calm.matches) {
        chatScroll.scrollTop = clampedTarget
        stop()
        return
      }
      const alpha = 1 - Math.exp(-14 * dt)
      chatScroll.scrollTop = cur + diff * alpha
      rafId = requestAnimationFrame(tick)
    }
    return {
      stop,
      resumeFollow() {
        userPausedFollow = false
      },
      scrollTo(nextTop) {
        if (!chatScroll) return
        if (calm.matches) {
          chatScroll.scrollTop = Math.max(0, nextTop)
          return
        }
        targetTop = Math.max(0, nextTop)
        if (!rafId) {
          lastTs = 0
          rafId = requestAnimationFrame(tick)
        }
      },
      followBottom() {
        if (!chatScroll || userPausedFollow) return
        const maxScroll = Math.max(0, chatScroll.scrollHeight - chatScroll.clientHeight)
        if (maxScroll - chatScroll.scrollTop > 2) {
          this.scrollTo(maxScroll)
        }
      },
      frameEntry(entry, isForward) {
        if (!chatScroll || !entry) return
        const paneRect = chatScroll.getBoundingClientRect()
        const rect = entry.getBoundingClientRect()
        const entryTop = rect.top - paneRect.top + chatScroll.scrollTop
        const entryBottom = entryTop + rect.height
        const viewTop = chatScroll.scrollTop
        const viewH = chatScroll.clientHeight
        const viewBottom = viewTop + viewH

        if (entryTop >= viewTop + 16 && entryBottom <= viewBottom - 24) return

        if (isForward && entryBottom > viewBottom - 24) {
          if (rect.height <= viewH - 52) {
            this.scrollTo(entryBottom - viewH + 28)
          } else {
            this.scrollTo(entryTop - 20)
          }
        } else if (entryTop < viewTop + 20 || !isForward) {
          this.scrollTo(entryTop - 24)
        }
      },
    }
  })()

  function clearStepAnimations() {
    animTimers.forEach(id => clearTimeout(id))
    animTimers = []
    if (typingRaf) {
      cancelAnimationFrame(typingRaf)
      typingRaf = 0
    }
    if (activeCleanup) {
      const fn = activeCleanup
      activeCleanup = null
      fn()
    }
    activeAnims.forEach(anim => {
      if (anim.playState === 'running') anim.finish()
    })
    activeAnims = []
    stepBusy = false
  }

  function updateProgressHairline(idx = playHead) {
    if (!progressBar) return
    const ratio = steps.length > 0 && idx >= 0 ? Math.max(0, Math.min(1, (idx + 0.5) / steps.length)) : 0
    progressBar.style.opacity = idx >= 0 || playing ? '1' : '0'
    progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`
  }

  function rawPromptTextOf(stepIdx) {
    const step = steps[stepIdx]
    if (!step || step.kind !== 'prompt') return ''
    const entry = stepEntries.find(e => e.stepIndex === stepIdx)?.entry
    const text = (entry?.querySelector('.session-bubble')?.textContent || step.summary || '').trim()
    return text === '（中途打断）' ? '' : text
  }

  function setComposerVisual(state, text = '') {
    if (!composer || !composerText) return
    composer.classList.toggle('is-typing', state === 'typing')
    if (state === 'draft') {
      composerText.className = 'session-composer-text'
      composerText.textContent = text
      if (stageTrigger) stageTrigger.scrollTop = 0
      if (sendBtn) {
        sendBtn.className = 'session-composer-send is-ready'
        sendBtn.textContent = '↑'
        sendBtn.disabled = false
        sendBtn.setAttribute('aria-label', t('sendThisPrompt'))
      }
    } else if (state === 'typing') {
      composerText.className = 'session-composer-text'
      composerText.innerHTML = `${escapeHtml(text)}<span class="session-cursor"></span>`
      if (stageTrigger) stageTrigger.scrollTop = stageTrigger.scrollHeight
      if (sendBtn) {
        sendBtn.className = 'session-composer-send is-ready'
        sendBtn.textContent = '↑'
        sendBtn.disabled = false
        sendBtn.setAttribute('aria-label', t('sendThisPrompt'))
      }
    } else if (state === 'running') {
      composerText.className = 'session-composer-text is-placeholder'
      composerText.textContent = t('composerPlaceholder')
      if (stageTrigger) stageTrigger.scrollTop = 0
      if (sendBtn) {
        sendBtn.className = 'session-composer-send is-stop'
        sendBtn.textContent = '■'
        sendBtn.disabled = false
        sendBtn.setAttribute('aria-label', t('pausePlayback'))
      }
    } else {
      const finished = playHead >= steps.length - 1
      composerText.className = 'session-composer-text is-placeholder'
      composerText.textContent = finished ? t('composerFinished') : t('composerPlaceholder')
      if (stageTrigger) stageTrigger.scrollTop = 0
      if (sendBtn) {
        sendBtn.className = 'session-composer-send'
        sendBtn.textContent = '↑'
        sendBtn.disabled = true
        sendBtn.setAttribute('aria-label', t('waitNextStep'))
      }
    }
  }

  function buildPrePromptStep() {
    if (playerData.initialSnapshot) {
      return {
        index: -1,
        turn: 0,
        t: 0,
        kind: 'pre-prompt',
        primaryCat: null,
        speedLabel: '1.0×',
        dwellMs: 1200,
        dimChat: false,
        summary: '',
        typewriterFrames: [],
        replyChunks: [],
        contextSnapshot: model.hydrateSnapshot(playerData.initialSnapshot),
      }
    }
    return model.selectStep(0)
  }

  function stateForIndex(idx) {
    return idx < 0 ? buildPrePromptStep() : model.selectStep(idx)
  }

  function currentSelectedState() {
    return stateForIndex(selectedIdx)
  }

  if (play) play.hidden = false
  if (log) log.classList.add('is-staged')
  if (scrubber) {
    scrubber.classList.add('is-ready')
    scrubber.removeAttribute('aria-hidden')
    Object.entries({
      role: 'slider',
      tabindex: '0',
      'aria-label': t('tlAria'),
      'aria-valuemin': '0',
      'aria-valuemax': String(Math.round(playerData.end || 1)),
    }).forEach(([key, value]) => scrubber.setAttribute(key, value))
  }

  function applyEchoHighlight() {
    if (!asidePane) return
    const activeKey = hoverCat || (userClickedInspect ? openCat : null)
    stackedBar?.classList.toggle('lc-stacked-dim', Boolean(activeKey))
    asidePane.querySelectorAll('[data-cat-key]').forEach(el => {
      const match = activeKey && el.dataset.catKey === activeKey
      el.classList.toggle('lc-stacked-seg-on', Boolean(match && el.classList.contains('lc-stacked-seg')))
      el.classList.toggle('lc-chip-on', Boolean(match && el.classList.contains('lc-chip')))
    })
    asidePane.querySelectorAll('[data-browser-cat]').forEach(el => {
      el.classList.toggle('is-echo', Boolean(hoverCat && el.dataset.browserCat === hoverCat))
    })
  }

  stepEntries.forEach(({ entry, stepIndex }) => {
    entry.addEventListener('click', event => {
      const lbBtn = event.target.closest('[data-lightbox-src]')
      if (lbBtn && lightbox && lightboxImg) {
        event.stopPropagation()
        if (playing) setPlaying(false)
        lightbox.classList.remove('is-doc')
        if (lightboxDoc) {
          lightboxDoc.hidden = true
          lightboxDoc.innerHTML = ''
        }
        lightboxImg.hidden = false
        lightboxImg.src = lbBtn.dataset.lightboxSrc
        lightboxImg.alt = lbBtn.dataset.lightboxLabel || ''
        if (lightboxTitle) lightboxTitle.textContent = lbBtn.dataset.lightboxLabel || t('lightboxDefaultTitle')
        if (typeof lightbox.showModal === 'function') lightbox.showModal()
        else lightbox.setAttribute('open', '')
        return
      }
      const docBtn = event.target.closest('[data-doc-open]')
      if (docBtn && lightbox && lightboxDoc) {
        event.stopPropagation()
        const tpl = entry.querySelector(`template[data-doc-html="${docBtn.dataset.docOpen}"]`)
        if (tpl) {
          if (playing) setPlaying(false)
          lightbox.classList.add('is-doc')
          if (lightboxImg) {
            lightboxImg.hidden = true
            lightboxImg.removeAttribute('src')
          }
          lightboxDoc.innerHTML = tpl.innerHTML
          lightboxDoc.hidden = false
          if (lightboxTitle) lightboxTitle.textContent = docBtn.dataset.docTitle || t('docModalDefaultTitle')
          if (typeof lightbox.showModal === 'function') lightbox.showModal()
          else lightbox.setAttribute('open', '')
          if (lightboxDoc.parentElement) lightboxDoc.parentElement.scrollTop = 0
        }
        return
      }
      if (event.target.closest('a, audio, video, summary, button')) return
      if (stepIndex > playHead) return
      if (playing) setPlaying(false)
      const step = steps[stepIndex]
      selectedIdx = stepIndex
      userClickedInspect = true
      openCat = step?.primaryCat || null
      follow = false
      render()
      if (openCat) {
        requestAnimationFrame(() => {
          asidePane?.querySelector(`[data-browser-cat="${openCat}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      }
    })
    entry.addEventListener('mouseenter', () => {
      if (stepIndex > playHead) return
      hoverCat = entry.dataset.echoCat || null
      applyEchoHighlight()
    })
    entry.addEventListener('mouseleave', () => {
      if (hoverCat) {
        hoverCat = null
        applyEchoHighlight()
      }
    })
  })

  function renderContextSidebar(stepState) {
    if (!asidePane || !stepState) return
    const snap = stepState.contextSnapshot
    if (snapLabel) {
      if (stepState.index < 0) {
        snapLabel.textContent = t('snapInitial')
      } else if (selectedIdx < playHead) {
        snapLabel.textContent = t('snapInspect', { step: stepState.index + 1, total: steps.length })
      } else {
        snapLabel.textContent = t('snapCurrent', { step: stepState.index + 1, total: steps.length })
      }
    }
    const totEl = asidePane.querySelector('[data-context-tot]')
    if (totEl) totEl.textContent = `${(snap.totalTokens / 1000).toFixed(1)}k`
    const winEl = asidePane.querySelector('[data-context-win]')
    if (winEl && snap.windowLabel) winEl.textContent = snap.windowLabel
    const pctEl = asidePane.querySelector('[data-context-pct]')
    if (pctEl) pctEl.textContent = `${snap.pct}%`

    for (const [key, val] of Object.entries(snap.segments || {})) {
      const seg = asidePane.querySelector(`[data-seg="${key}"]`)
      if (seg) seg.style.width = `${val}%`
    }

    for (const [key, val] of Object.entries(snap.tokensByKind || {})) {
      const tokEl = asidePane.querySelector(`[data-pro-tok="${key}"]`)
      if (tokEl) tokEl.textContent = `≈${(val / 1000).toFixed(1)}k`
    }

    const browserBox = asidePane.querySelector('[data-context-browser]')
    if (browserBox && Array.isArray(snap.categories)) {
      browserBox.innerHTML = snap.categories.map(cat => {
        const list = cat.items || []
        const isEmpty = list.length === 0
        const isCatOpen = !isEmpty && openCat === cat.id
        const deltaCls = String(cat.delta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
        const tokDeltaCls = String(cat.tokDelta || '').startsWith('-') ? 'lc-br-delta-down' : 'lc-br-delta-up'
        const itemsHtml = isCatOpen ? list.map(item => {
          const isItemOpen = openItems.has(item.id)
          let payloadHtml = ''
          if (isItemOpen) {
            const rawPayload = String(item.payload || '')
            const expandBtn = rawPayload.length > 220
              ? `<div class="sp-payload-bar"><span>${rawPayload.length.toLocaleString()} chars · ${escapeHtml(item.meta || '')}</span><button type="button" class="sp-payload-expand" data-ctx-modal="${escapeHtml(item.id)}">${escapeHtml(t('viewFullPayload'))}</button></div>`
              : ''
            const thumbsHtml = item.images?.length
              ? `<span class="session-thumbs">${item.images.map(name => `<a href="${escapeHtml(name)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(name)}" alt="" width="88" loading="lazy"></a>`).join('')}</span>`
              : ''
            payloadHtml = `<div class="lc-br-content session-browser-payload">${expandBtn}<pre class="sp-payload-pre">${escapeHtml(rawPayload)}</pre>${thumbsHtml}</div>`
          }
          return `<div class="lc-br-elem session-browser-item${isItemOpen ? ' lc-br-elem-on' : ''}${item.isNew ? ' is-new' : ''}" data-browser-item="${escapeHtml(item.id)}">
            <button type="button" class="lc-br-elem-row session-browser-item-btn" data-browser-item-toggle="${escapeHtml(item.id)}" aria-expanded="${isItemOpen ? 'true' : 'false'}">
              <span class="lc-br-chev${isItemOpen ? ' lc-br-chev-on' : ''}"></span>
              ${item.tag ? `<span class="lc-br-tag">${escapeHtml(item.tag)}</span>` : ''}
              <span class="lc-br-preview session-browser-item-title">${escapeHtml(item.title)}</span>
              <span class="session-browser-item-meta"><span class="lc-br-time">${escapeHtml(item.meta || '')}</span></span>
            </button>
            ${payloadHtml}
          </div>`
        }).join('') : ''
        return `<div class="lc-br-cat session-browser-cat${isEmpty ? ' is-empty' : ''}${hoverCat === cat.id ? ' is-echo' : ''}" data-browser-cat="${escapeHtml(cat.id)}">
          <button type="button" class="lc-br-cat-row${isCatOpen ? ' lc-br-cat-open' : ''} session-browser-cat-btn" data-browser-cat-toggle="${escapeHtml(cat.id)}" aria-expanded="${isCatOpen ? 'true' : 'false'}"${isEmpty ? ' disabled' : ''}>
            <span class="lc-br-chev${isCatOpen ? ' lc-br-chev-on' : ''}"></span>
            <span class="lc-br-count-grp">
              <i class="session-cat-dot is-${escapeHtml(cat.color || cat.id)}"></i>
              <span class="lc-br-cat-label">${escapeHtml(cat.name)}</span>
              <span class="lc-br-cat-count">${escapeHtml(cat.count)}</span>
              ${cat.delta ? `<b class="lc-br-delta ${deltaCls} session-delta-badge">${escapeHtml(cat.delta)}</b>` : ''}
            </span>
            <span class="lc-br-tokens-grp">
              ${cat.tokDelta ? `<b class="lc-br-delta ${tokDeltaCls}">${escapeHtml(cat.tokDelta)}</b>` : ''}
              <span class="lc-br-tokens">${escapeHtml(cat.tok)}</span>
            </span>
          </button>
          <div class="lc-br-body session-browser-items"${isCatOpen ? '' : ' hidden'}>
            ${isCatOpen ? (itemsHtml || `<p class="session-ctx-empty">${escapeHtml(t('emptyCategory'))}</p>`) : ''}
          </div>
        </div>`
      }).join('')
    }
    applyEchoHighlight()
  }

  asidePane?.addEventListener('mouseover', event => {
    const catEl = event.target.closest('[data-cat-key], [data-browser-cat]')
    const nextKey = catEl ? (catEl.dataset.catKey || catEl.dataset.browserCat) : null
    if (nextKey !== hoverCat) {
      hoverCat = nextKey
      applyEchoHighlight()
    }
  })
  asidePane?.addEventListener('mouseleave', () => {
    if (hoverCat) {
      hoverCat = null
      applyEchoHighlight()
    }
  })

  const closeLightbox = () => {
    if (!lightbox) return
    if (typeof lightbox.close === 'function' && lightbox.open) lightbox.close()
    else lightbox.removeAttribute('open')
  }
  lightboxClose?.addEventListener('click', closeLightbox)
  lightbox?.addEventListener('click', event => {
    if (event.target === lightbox) closeLightbox()
  })

  function renderTimelineHover(idx) {
    if (!tlPop) return
    if (idx === null || idx < 0 || idx >= steps.length) {
      tlPop.hidden = true
      return
    }
    const s = steps[idx]
    const pct = steps.length > 0 ? Math.min(88, Math.max(12, ((idx + 0.5) / steps.length) * 100)) : 50
    const frame = s.frames?.[0]
    const doc = s.docs?.[0]
    const ci = s.compactInfo
    const thumbHtml = frame
      ? `<span class="session-tl-pop-thumb"><img src="${escapeHtml(frame.img)}" alt=""></span>`
      : ''
    const headTitle = ci
      ? t('tlCompressTitle', { seq: ci.seq, dropped: ((ci.droppedTokens || 0) / 1000).toFixed(0) })
      : frame
        ? `🖼 ${frame.label}`
        : doc
          ? `📄 ${doc.title}`
          : s.kind === 'prompt'
            ? t('tlPromptTitle', { turn: s.turn, summary: shorten(s.summary || '', 20) })
            : shorten(s.summary || t('tlStepFallback'), 24)
    const tokStr = `${((s.contextSnapshot?.totalTokens || 0) / 1000).toFixed(1)}k`
    tlPop.style.left = `${pct.toFixed(1)}%`
    tlPop.innerHTML = `${thumbHtml}<span class="session-tl-pop-meta"><small>${escapeHtml(t('tlStepMeta', { step: idx + 1, time: elapsedClock(s.t) }))}</small><b>${escapeHtml(headTitle)}</b><span>Context ≈${escapeHtml(tokStr)}</span></span>`
    tlPop.hidden = false
  }

  function jumpViaTimeline(idx) {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx))
    if (playing) setPlaying(false)
    activate()
    if (clamped > playHead) {
      clearStepAnimations()
      playHead = clamped
      prevRenderedHead = clamped
      animatedHead = clamped
      selectedIdx = clamped
      userClickedInspect = false
      openCat = steps[clamped]?.primaryCat || null
      const next = steps[playHead + 1]
      const nextDraft = next?.kind === 'prompt' ? rawPromptTextOf(next.index) : ''
      if (nextDraft) setComposerVisual('draft', nextDraft)
      else setComposerVisual('idle')
      follow = true
      render()
    } else {
      selectedIdx = clamped
      userClickedInspect = clamped < playHead
      openCat = steps[clamped]?.primaryCat || null
      follow = false
      render()
      const targetEntry = stepEntries.find(e => e.stepIndex === clamped)?.entry
      if (targetEntry) camera.frameEntry(targetEntry, false)
    }
  }

  tlTrack?.addEventListener('mouseover', event => {
    const h = event.target.closest('[data-tl-hover]')
    renderTimelineHover(h ? Number(h.dataset.tlHover) : null)
  })
  tlTrack?.addEventListener('mouseleave', () => renderTimelineHover(null))
  tlTrack?.addEventListener('click', event => {
    const el = event.target.closest('[data-tl-jump], [data-tl-step]')
    if (!el) return
    const idx = Number(el.dataset.tlJump ?? el.dataset.tlStep)
    if (Number.isFinite(idx)) jumpViaTimeline(idx)
  })

  asidePane?.addEventListener('click', event => {
    const modalBtn = event.target.closest('[data-ctx-modal]')
    if (modalBtn && lightbox && lightboxDoc) {
      const rec = (playerData.contextRecords || {})[modalBtn.dataset.ctxModal]
      if (rec) {
        if (playing) setPlaying(false)
        lightbox.classList.add('is-doc')
        if (lightboxImg) {
          lightboxImg.hidden = true
          lightboxImg.removeAttribute('src')
        }
        const imgs = rec.images?.length
          ? `<div class="session-thumbs">${rec.images.map(src => `<img src="${escapeHtml(src)}" alt="" style="max-width:100%;border-radius:6px">`).join('')}</div>`
          : ''
        lightboxDoc.innerHTML = `<pre class="sp-modal-pre">${escapeHtml(String(rec.payload || ''))}</pre>${imgs}`
        lightboxDoc.hidden = false
        if (lightboxTitle) lightboxTitle.textContent = `${rec.tag ? `[${rec.tag}] ` : ''}${rec.title}`
        if (typeof lightbox.showModal === 'function') lightbox.showModal()
        else lightbox.setAttribute('open', '')
        if (lightboxDoc.parentElement) lightboxDoc.parentElement.scrollTop = 0
      }
      return
    }
    const chipOrSeg = event.target.closest('[data-cat-key]')
    if (chipOrSeg) {
      const catId = chipOrSeg.dataset.catKey
      openCat = openCat === catId ? null : catId
      renderContextSidebar(currentSelectedState())
      asidePane.querySelector(`[data-browser-cat="${catId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    const catBtn = event.target.closest('[data-browser-cat-toggle]')
    if (catBtn && !catBtn.disabled) {
      const catId = catBtn.dataset.browserCatToggle
      openCat = openCat === catId ? null : catId
      renderContextSidebar(currentSelectedState())
      return
    }
    const itemBtn = event.target.closest('[data-browser-item-toggle]')
    if (itemBtn) {
      const itemId = itemBtn.dataset.browserItemToggle
      if (openItems.has(itemId)) openItems.delete(itemId)
      else openItems.add(itemId)
      renderContextSidebar(currentSelectedState())
    }
  })

  function typeComposerDraft(text, onDone) {
    const clean = String(text || '').trim()
    if (!clean || calm.matches) {
      setComposerVisual('draft', clean)
      if (onDone) onDone()
      return
    }
    stepBusy = true
    const charsPerSec = clean.length > 120 ? Math.min(95, 48 + (clean.length - 120) * 0.22) : 44
    let idx = 0
    activeCleanup = () => {
      setComposerVisual('draft', clean)
    }
    const stepChar = () => {
      idx = Math.min(clean.length, idx + 1)
      if (idx < clean.length) {
        setComposerVisual('typing', clean.slice(0, idx))
        const ch = clean[idx - 1] || ''
        const pause = clean.length <= 160 ? (ch === '。' || ch === '？' || ch === '\n' ? 75 : ch === '，' || ch === '：' ? 32 : 0) : 0
        animTimers.push(setTimeout(stepChar, 1000 / charsPerSec + pause))
      } else {
        activeCleanup = null
        stepBusy = false
        setComposerVisual('draft', clean)
        if (onDone) onDone()
      }
    }
    stepChar()
  }

  function runToolMontage(headState, headEntry, onDone) {
    const montageEl = headEntry?.querySelector('[data-montage-row]')
    const detailsEl = headEntry?.querySelector('[data-process-details]')
    const frameDeckEl = headEntry?.querySelector('[data-frame-deck]')
    const frames = headState.montageFrames || []
    if (!montageEl || !detailsEl || !frames.length || calm.matches) {
      if (onDone) onDone()
      return
    }
    stepBusy = true
    setComposerVisual('running')
    detailsEl.hidden = true
    if (frameDeckEl) frameDeckEl.hidden = true
    montageEl.hidden = false
    activeCleanup = () => {
      montageEl.hidden = true
      montageEl.innerHTML = ''
      detailsEl.hidden = false
      if (frameDeckEl) frameDeckEl.hidden = false
    }
    let idx = 0
    const nextCut = () => {
      if (idx < frames.length) {
        const f = frames[idx++]
        montageEl.innerHTML = `<span class="dsh-proc-dot is-live"></span><span class="session-montage-speed${f.isSpot ? ' is-spot' : ''}">${escapeHtml(f.speed)}</span><span class="dsh-shimmer-text">${escapeHtml(f.tag)} · ${escapeHtml(f.title)}</span>`
        camera.followBottom()
        animTimers.push(setTimeout(nextCut, f.isSpot ? 620 : 250))
      } else {
        activeCleanup = null
        stepBusy = false
        montageEl.hidden = true
        montageEl.innerHTML = ''
        detailsEl.hidden = false
        if (frameDeckEl) {
          frameDeckEl.hidden = false
          if (typeof frameDeckEl.animate === 'function') {
            activeAnims.push(frameDeckEl.animate(
              [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 260, easing: EASE_OUT }
            ))
          }
          camera.followBottom()
        }
        if (onDone) onDone()
      }
    }
    nextCut()
  }

  function streamRichReply(headEntry, onDone) {
    const body = headEntry?.querySelector('.session-ai-body')
    if (!body || calm.matches) {
      if (onDone) onDone()
      return
    }
    const fullHtml = body.dataset.fullHtml || (body.dataset.fullHtml = body.innerHTML)
    body.innerHTML = fullHtml

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    const segs = []
    let totalChars = 0
    let node
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue || ''
      if (!txt.trim() && !txt.includes(' ')) continue
      const ancestors = []
      for (let el = node.parentElement; el && el !== body; el = el.parentElement) {
        ancestors.push(el)
      }
      segs.push({ node, full: txt, start: totalChars, end: totalChars + txt.length, ancestors, revealed: false })
      totalChars += txt.length
    }
    if (totalChars < 2) {
      if (onDone) onDone()
      return
    }

    stepBusy = true
    setComposerVisual('running')
    const hiddenEls = new Set()
    for (const seg of segs) {
      seg.node.nodeValue = ''
      for (const el of seg.ancestors) {
        if (!hiddenEls.has(el)) {
          hiddenEls.add(el)
          el.style.display = 'none'
        }
      }
    }
    const leadSpan = document.createElement('span')
    leadSpan.className = 'session-soft-lead'

    activeCleanup = () => {
      leadSpan.remove()
      body.innerHTML = fullHtml
    }

    const baseCps = totalChars > 480 ? Math.min(115, 48 + (totalChars - 480) * 0.09) : 44
    const stride = totalChars > 700 ? 2 : 1
    let cursor = 0
    let segPtr = 0

    const tickStream = () => {
      cursor = Math.min(totalChars, cursor + stride)
      while (segPtr < segs.length && segs[segPtr].end < cursor) {
        const doneSeg = segs[segPtr]
        if (!doneSeg.revealed) {
          doneSeg.revealed = true
          for (const el of doneSeg.ancestors) el.style.display = ''
        }
        doneSeg.node.nodeValue = doneSeg.full
        segPtr++
      }
      let lastChar = ''
      if (segPtr < segs.length && cursor > segs[segPtr].start) {
        const curSeg = segs[segPtr]
        if (!curSeg.revealed) {
          curSeg.revealed = true
          for (const el of curSeg.ancestors) el.style.display = ''
        }
        const localLen = cursor - curSeg.start
        const slice = curSeg.full.slice(0, localLen)
        lastChar = slice[slice.length - 1] || ''
        if (cursor < totalChars && slice.length >= 2) {
          const tailLen = Math.min(3, slice.length)
          curSeg.node.nodeValue = slice.slice(0, slice.length - tailLen)
          leadSpan.textContent = slice.slice(slice.length - tailLen)
          if (curSeg.node.nextSibling !== leadSpan) {
            curSeg.node.parentNode?.insertBefore(leadSpan, curSeg.node.nextSibling)
          }
        } else {
          curSeg.node.nodeValue = slice
        }
      }
      camera.followBottom()
      if (cursor < totalChars) {
        const pause = totalChars <= 600
          ? (lastChar === '。' || lastChar === '！' || lastChar === '？' || lastChar === '\n' ? 95 : lastChar === '，' || lastChar === '、' || lastChar === '：' ? 38 : 0)
          : 0
        animTimers.push(setTimeout(tickStream, (1000 / baseCps) * stride + pause))
      } else {
        activeCleanup = null
        stepBusy = false
        leadSpan.remove()
        body.innerHTML = fullHtml
        camera.followBottom()
        if (onDone) onDone()
      }
    }
    tickStream()
  }

  function preparePostStepComposerAndContinue() {
    const immediateNext = steps[playHead + 1]
    if (!immediateNext) {
      setComposerVisual('idle')
      if (playing) setPlaying(false)
      return
    }
    if (immediateNext.kind === 'prompt') {
      const draft = rawPromptTextOf(immediateNext.index)
      if (!draft) {
        setComposerVisual('idle')
        if (playing) {
          animTimers.push(setTimeout(() => {
            if (playing) goToStage(playHead + 1, true)
          }, 260))
        }
        return
      }
      if (isInitialMount) {
        setComposerVisual('draft', draft)
        return
      }
      const beat = playHead < 0 ? 0 : 380
      animTimers.push(setTimeout(() => {
        typeComposerDraft(draft, () => {
          if (playing) {
            animTimers.push(setTimeout(() => {
              if (playing) goToStage(playHead + 1, true)
            }, 240))
          }
        })
      }, beat))
      return
    }
    setComposerVisual(playing ? 'running' : 'idle')
    if (playing) {
      animTimers.push(setTimeout(() => {
        if (playing) goToStage(playHead + 1, true)
      }, 360))
    }
  }

  function runHeadChoreography(headState, headEntry, animateNewStep, steppedForwardOne) {
    updateProgressHairline()
    if (!animateNewStep) return
    clearStepAnimations()

    if (playHead < 0) {
      preparePostStepComposerAndContinue()
      return
    }

    if (!steppedForwardOne) {
      const next = steps[playHead + 1]
      const nextDraft = next?.kind === 'prompt' ? rawPromptTextOf(next.index) : ''
      if (nextDraft) setComposerVisual('draft', nextDraft)
      else setComposerVisual('idle')
      return
    }

    if (headState.kind === 'prompt') {
      setComposerVisual(steps[playHead + 1] && steps[playHead + 1].kind !== 'prompt' ? 'running' : 'idle')
      if (headEntry && !calm.matches && typeof headEntry.animate === 'function') {
        const bubble = headEntry.querySelector('.session-bubble') || headEntry
        activeAnims.push(bubble.animate(
          [
            { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 260, easing: EASE_OUT }
        ))
      }
      camera.followBottom()
      preparePostStepComposerAndContinue()
      return
    }

    if (headState.kind === 'fast-tools' || headState.kind === 'spotlight-change') {
      runToolMontage(headState, headEntry, () => {
        preparePostStepComposerAndContinue()
      })
      return
    }

    if (headState.kind === 'compact') {
      setComposerVisual('running')
      openCat = 'tool'
      renderContextSidebar(currentSelectedState())
      if (headEntry && !calm.matches && typeof headEntry.animate === 'function') {
        activeAnims.push(headEntry.animate(
          [
            { opacity: 0, transform: 'translateY(8px) scale(0.99)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 320, easing: EASE_OUT }
        ))
      }
      camera.followBottom()
      animTimers.push(setTimeout(() => {
        preparePostStepComposerAndContinue()
      }, 900))
      return
    }

    if (headState.kind === 'reply') {
      streamRichReply(headEntry, () => {
        preparePostStepComposerAndContinue()
      })
      return
    }

    preparePostStepComposerAndContinue()
  }

  function render() {
    const headState = stateForIndex(playHead)
    const selectedState = currentSelectedState()
    curTime = headState.index < 0 ? 0 : headState.t
    const x = (playerData.end > 0 ? ((curTime / playerData.end) * width) : 0).toFixed(1)
    if (head) {
      head.setAttribute('x1', x)
      head.setAttribute('x2', x)
    }
    if (scrubber) {
      scrubber.setAttribute('aria-valuenow', String(Math.round(curTime)))
      scrubber.setAttribute('aria-valuetext', wallClock(playerData.start, curTime))
    }

    if (emptyStage) emptyStage.hidden = playHead >= 0
    if (prevBtn) prevBtn.disabled = playHead <= -1
    if (nextBtn) nextBtn.disabled = playHead >= steps.length - 1
    if (play && !playing) {
      const atEnd = playHead >= steps.length - 1
      play.textContent = atEnd ? t('replay') : t('play')
      play.setAttribute('aria-label', atEnd ? t('replayAria') : t('playAria'))
    }

    renderContextSidebar(selectedState)
    const shownIdx = userClickedInspect && selectedIdx >= 0 ? selectedIdx : playHead
    const shownTime = shownIdx < 0 ? 0 : (steps[shownIdx]?.t || 0)
    updateProgressHairline(shownIdx)
    if (speedBadge) {
      speedBadge.innerHTML = `<b>${Math.max(0, shownIdx + 1)}</b> / ${steps.length} · ${elapsedClock(shownTime)}`
    }
    tlSegs.forEach((seg, idx) => {
      seg.classList.toggle('is-past', idx <= playHead && idx !== shownIdx)
      seg.classList.toggle('is-active', idx === shownIdx && shownIdx >= 0)
    })
    tlPins.forEach(pin => {
      const pIdx = Number(pin.dataset.tlJump)
      pin.classList.toggle('is-on', pIdx === shownIdx && shownIdx >= 0)
      pin.classList.toggle('is-reached', pIdx <= playHead)
    })

    let latestVisibleEntry
    for (const item of stepEntries) {
      const future = item.stepIndex > playHead
      item.entry.classList.toggle('is-future', future)
      const isInspectSelected = !future && userClickedInspect && item.stepIndex === selectedIdx
      item.entry.classList.toggle('is-selected', isInspectSelected)

      let tag = item.entry.querySelector('.session-inspect-tag')
      if (isInspectSelected) {
        if (!tag) {
          tag = document.createElement('span')
          tag.className = 'session-inspect-tag'
          item.entry.prepend(tag)
        }
        const stTime = steps[selectedIdx]?.t || 0
        tag.textContent = t.lang === 'en'
          ? `Snapshot #${selectedIdx + 1} · ${elapsedClock(stTime)}`
          : `快照 #${selectedIdx + 1} · ${elapsedClock(stTime)}`
      } else if (tag) {
        tag.remove()
      }

      if (!future) latestVisibleEntry = item.entry
    }
    for (const aux of auxEntries) {
      aux.entry.classList.toggle('is-future', aux.forStep > playHead)
    }

    const steppedForwardOne = !isInitialMount && playHead === prevRenderedHead + 1 && playHead >= 0
    const isForwardMove = playHead >= prevRenderedHead
    prevRenderedHead = playHead

    const isNewHead = playHead !== animatedHead
    if (isNewHead) animatedHead = playHead
    const headEntry = stepEntries.find(item => item.stepIndex === playHead)?.entry
    runHeadChoreography(headState, headEntry, isNewHead, steppedForwardOne)

    if (latestVisibleEntry && (playing || follow)) {
      camera.frameEntry(latestVisibleEntry, isForwardMove)
    } else if (playHead < 0 && chatScroll && follow) {
      camera.scrollTo(0)
    }
    follow = false
  }

  function activate() {
    root?.classList.add('is-active')
  }
  function goToStage(nextIdx, shouldScroll = true) {
    activate()
    if (shouldScroll) camera.resumeFollow()
    playHead = Math.max(-1, Math.min(steps.length - 1, nextIdx))
    selectedIdx = playHead
    userClickedInspect = false
    openCat = playHead < 0 ? null : (steps[playHead]?.primaryCat || null)
    follow = shouldScroll
    animatedHead = -2
    render()
  }
  function seek(time, shouldScroll = true) {
    const idx = steps.findLastIndex(step => step.t <= time)
    goToStage(idx < 0 ? 0 : idx, shouldScroll)
  }
  function setPlaying(value) {
    playing = value
    const atEnd = playHead >= steps.length - 1
    if (play) {
      play.textContent = playing ? t('pause') : atEnd ? t('replay') : t('play')
      play.setAttribute('aria-label', playing ? t('pauseAria') : atEnd ? t('replayAria') : t('playAria'))
    }
    if (!playing) {
      camera.stop()
      clearStepAnimations()
      const next = steps[playHead + 1]
      const nextDraft = next?.kind === 'prompt' ? rawPromptTextOf(next.index) : ''
      if (nextDraft) setComposerVisual('draft', nextDraft)
      else setComposerVisual('idle')
      updateProgressHairline()
      return
    }
    activate()
    camera.resumeFollow()
    if (playHead >= steps.length - 1) {
      clearStepAnimations()
      playHead = -1
      prevRenderedHead = -1
      selectedIdx = -1
      userClickedInspect = false
      openCat = null
      follow = true
      animatedHead = -1
      render()
    }
    if (selectedIdx < playHead) {
      selectedIdx = playHead
      userClickedInspect = false
      openCat = steps[playHead]?.primaryCat || null
      render()
    }
    if (!stepBusy) {
      if (playHead < 0) {
        const firstDraft = steps[0]?.kind === 'prompt' ? rawPromptTextOf(0) : ''
        if (firstDraft) {
          typeComposerDraft(firstDraft, () => {
            if (playing) {
              animTimers.push(setTimeout(() => {
                if (playing) goToStage(0, true)
              }, 220))
            }
          })
        } else {
          goToStage(0, true)
        }
      } else {
        goToStage(playHead + 1, true)
      }
    }
  }

  play?.addEventListener('click', () => setPlaying(!playing))
  prevBtn?.addEventListener('click', () => {
    setPlaying(false)
    goToStage(playHead - 1, true)
  })
  nextBtn?.addEventListener('click', () => {
    setPlaying(false)
    goToStage(playHead + 1, true)
  })
  sendBtn?.addEventListener('click', event => {
    event.stopPropagation()
    if (playing || stepBusy) {
      setPlaying(false)
      return
    }
    if (playHead + 1 < steps.length) {
      goToStage(playHead + 1, true)
    }
  })
  stageTrigger?.addEventListener('click', () => {
    if (playing || stepBusy) return
    if (steps[playHead + 1]?.kind === 'prompt') {
      goToStage(playHead + 1, true)
    }
  })
  langToggleBtn?.addEventListener('click', () => {
    setPlaying(false)
    if (onToggleLang) {
      onToggleLang(t.lang === 'zh' ? 'en' : 'zh', playHead)
    }
  })

  const onKeyDown = event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest('input, textarea, select, a, audio, video, summary, [contenteditable]')) return
    if (event.key === ' ' && event.target.closest('button')) return
    if (event.key === 'ArrowLeft') {
      setPlaying(false)
      goToStage(playHead - 1, true)
    } else if (event.key === 'ArrowRight') {
      setPlaying(false)
      goToStage(playHead + 1, true)
    } else if (event.key === ' ') {
      setPlaying(!playing)
    } else {
      return
    }
    event.preventDefault()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeyDown)
  }

  if (scrubber) {
    const fromPointer = event => {
      const box = scrubber.getBoundingClientRect()
      seek(((event.clientX - box.left) / box.width) * playerData.end)
    }
    scrubber.addEventListener('pointerdown', event => {
      scrubber.setPointerCapture(event.pointerId)
      fromPointer(event)
    })
    scrubber.addEventListener('pointermove', event => {
      if (scrubber.hasPointerCapture(event.pointerId)) fromPointer(event)
    })
  }

  if (steps.length) {
    goToStage(initialStep, initialStep >= 0)
    isInitialMount = false
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => appEl?.classList.add('is-ready'))
    } else {
      appEl?.classList.add('is-ready')
    }
  }

  return {
    destroy() {
      clearStepAnimations()
      camera.stop()
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', onKeyDown)
      }
    },
    goToStage,
    setPlaying,
    getPlayHead: () => playHead,
  }
}

async function createEncorePlayer(targetEl, sourceOrSession, options = {}) {
  const el = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl
  if (!el) throw new Error('Target element for EncorePlayer not found')

  let session = sourceOrSession
  let baseUrl = options.baseUrl || ''
  if (!session && el.getAttribute('src')) {
    sourceOrSession = el.getAttribute('src')
  }
  const preRenderedData = !session && !sourceOrSession
    ? el.querySelector('[data-encore-session-data], #session-data')
    : null
  if (preRenderedData) {
    document.documentElement.classList.add('js-session')
    el.classList.add('session-wrap')
    const appNode = el.querySelector('.session-app')
    const activeLang = resolveLang(options.lang || el.dataset.lang || appNode?.dataset.encoreLang || 'zh')
    const playerData = JSON.parse(preRenderedData.textContent)
    const activeController = attachPlayerController(el, playerData, {
      lang: activeLang,
      initialStep: options.initialStep ?? -1,
    })
    return {
      setLang: () => {},
      getController: () => activeController,
    }
  }
  if (typeof sourceOrSession === 'string') {
    const srcUrl = sourceOrSession
    if (!baseUrl) {
      const slashIdx = srcUrl.lastIndexOf('/')
      baseUrl = slashIdx >= 0 ? srcUrl.slice(0, slashIdx + 1) : './'
    }
    let loaded = null
    try {
      const res = await fetch(srcUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      loaded = await res.json()
    } catch (err) {
      const fallbackScript = document.getElementById('encore-session-fallback') || el.querySelector('[data-encore-fallback]')
      if (fallbackScript) {
        loaded = JSON.parse(fallbackScript.textContent)
      } else {
        throw err
      }
    }
    session = loaded
  }

  document.documentElement.classList.add('js-session')
  el.classList.add('session-wrap')

  const attrLang = el.dataset.lang && el.dataset.lang !== 'auto' ? el.dataset.lang : undefined
  let activeLang = resolveLang(options.lang || attrLang || session.lang)
  let activeController = null

  const mountWithLang = (lang, preserveStep = -1) => {
    if (activeController) activeController.destroy()
    activeLang = resolveLang(lang)
    const line = timeline(session, { lang: activeLang })
    el.innerHTML = renderPlayerWidget(session, line, { lang: activeLang, baseUrl })
    if (session.title && document.querySelectorAll('[data-encore-player]').length <= 1) {
      document.title = `${session.title} · Encore`
    }
    const dataScript = el.querySelector('[data-encore-session-data]')
    const playerData = dataScript ? JSON.parse(dataScript.textContent) : buildPlayerData(session, line, { baseUrl })
    activeController = attachPlayerController(el, playerData, {
      lang: activeLang,
      initialStep: preserveStep,
      onToggleLang: (nextLang, curStep) => mountWithLang(nextLang, curStep),
    })
  }

  mountWithLang(activeLang, options.initialStep ?? -1)
  return {
    setLang: nextLang => mountWithLang(nextLang, activeController ? activeController.getPlayHead() : -1),
    getController: () => activeController,
  }
}

async function autoMountEncorePlayers() {
  if (typeof document === 'undefined') return
  const nodes = [...document.querySelectorAll('[data-encore-player]')]
  for (const node of nodes) {
    if (node.dataset.encoreMounted) continue
    node.dataset.encoreMounted = '1'
    try {
      await createEncorePlayer(node)
    } catch (err) {
      node.innerHTML = `<div class="encore-load-error">Failed to load session replay: ${escapeHtml(err.message || String(err))}</div>`
    }
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.createSessionPlaybackModel = createSessionPlaybackModel
  globalThis.EncorePlayer = {
    create: createEncorePlayer,
    attach: attachPlayerController,
    mountAll: autoMountEncorePlayers,
    createSessionPlaybackModel,
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoMountEncorePlayers())
  } else {
    autoMountEncorePlayers()
  }
}
})()
