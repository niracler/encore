import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import sharp from 'sharp'
import {
  buildReplay,
  buildStandalonePlayerJs,
  clipSession,
  createSessionPlaybackModel,
  detectInput,
  findLeaks,
  readCodex,
  redactSession,
  renderPlayerWidget,
  scanRecentSessions,
  timeline,
} from '../src/index.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const sampleSession = {
  tool: 'claude-code',
  model: 'claude-opus-4-6',
  title: '重审第一讲幻灯片',
  description: '通过加载 slides-review 技能对第一讲课件逐页审查并修订。',
  started: '2026-10-10T10:00:00.000Z',
  ended: '2026-10-10T10:05:00.000Z',
  tokens: 80000,
  items: [
    { type: 'user', text: '/slides-review 请重审第一讲幻灯片', time: '2026-10-10T10:00:00.000Z' },
    { type: 'tool', name: 'Skill', summary: '加载技能 slides-review', stats: { skill: 1 }, time: '2026-10-10T10:00:10.000Z', done: '2026-10-10T10:00:12.000Z' },
    { type: 'tool', name: 'Read', summary: '读取 课程大纲.md', input: '{"file_path":"course/课程大纲.md"}', output: '# 课程大纲\n内容', stats: { read: 1 }, time: '2026-10-10T10:00:15.000Z', done: '2026-10-10T10:00:18.000Z' },
    { type: 'tool', name: 'Edit', summary: '修改 1.1.md', input: '*** Update File: slides/pages/01/1.1.md\n+新增一行', stats: { edit: 1 }, time: '2026-10-10T10:01:00.000Z', done: '2026-10-10T10:01:10.000Z' },
    { type: 'compact', seq: 1, trigger: 'auto', preTokens: 180000, postTokens: 32000, droppedTokens: 148000, summary: '上下文压缩 #1', text: '## 交接摘要\n已完成前序检查', time: '2026-10-10T10:01:30.000Z' },
    { type: 'assistant', text: '已完成第一讲 **1.1 页**修订。', time: '2026-10-10T10:02:00.000Z' },
  ],
}

test('timeline and renderPlayerWidget support both zh and en bilingual modes', () => {
  const lineZh = timeline(sampleSession, { lang: 'zh' })
  assert.ok(lineZh.steps.length >= 4)
  assert.equal(lineZh.steps[0].contextSnapshot.windowLabel, '1.0M')
  assert.match(lineZh.steps[0].contextSnapshot.categories[0].name, /系统提示词/)

  const htmlZh = renderPlayerWidget(sampleSession, lineZh, { lang: 'zh' })
  assert.match(htmlZh, /上下文快照/)
  assert.match(htmlZh, /上下文压缩 #1/)
  assert.match(htmlZh, /▶ 播放/)
  assert.match(htmlZh, /<strong>1\.1 页<\/strong>/)

  const lineEn = timeline(sampleSession, { lang: 'en' })
  assert.equal(lineEn.steps[0].contextSnapshot.categories[0].name, 'System Prompt')
  const htmlEn = renderPlayerWidget(sampleSession, lineEn, { lang: 'en' })
  assert.match(htmlEn, /Context Snapshot/)
  assert.match(htmlEn, /Context Compaction #1/)
  assert.match(htmlEn, /▶ Play/)
})

test('replies with nested code fences render without blocking playback', () => {
  const text = [
    'Example:',
    '````markdown',
    '```diff',
    '+ <tag>',
    '```',
    '`````',
    '```c++ example',
    'int n;',
    '```',
    '```inline`text',
    'Still here.',
  ].join('\n')
  const session = { ...sampleSession, items: [{ type: 'assistant', text, time: sampleSession.started }] }
  // Interrupt a stalled synchronous parser so a regression fails instead of hanging the suite.
  const html = runInNewContext('renderPlayerWidget(session)', { renderPlayerWidget, session }, { timeout: 2000 })
  assert.ok(html.includes('<pre><code class="language-markdown">```diff\n+ &lt;tag&gt;\n```</code></pre>'))
  assert.ok(html.includes('<pre><code class="language-c++">int n;</code></pre>'))
  assert.ok(html.includes('Still here.</p>'))
})

test('handoffs belong to their exact reply or tool step and legacy files remain at the end', () => {
  const session = structuredClone(sampleSession)
  session.items[2].deliverables = [{ title: 'Sent workbook', href: 'leads.xlsx' }]
  session.items.at(-1).deliverables = [{ title: 'Review copy', href: 'report.pdf' }]
  session.deliverables = [{ title: 'Final copy', href: 'final.pdf' }]
  const line = timeline(session)
  const html = renderPlayerWidget(session, line)
  const tool = line.steps.findIndex(step => step.t === 15)
  assert.ok(tool > 0)
  assert.equal(line.steps[tool + 1].t, 60)
  const sections = [...html.matchAll(/<li class="session-entry session-ai session-files"[^>]*data-for-step="(\d+)"[^>]*>([\s\S]*?)<\/li>/g)]
  assert.deepEqual(sections.map(match => Number(match[1])), [tool, line.steps.length - 1, line.steps.length - 1])
  for (const [i, title] of ['Sent workbook', 'Review copy', 'Final copy'].entries()) assert.ok(sections[i][2].includes(title))
  assert.ok(sections[2][0].includes('data-final-files'))
})

test('export captures external handoffs, verifies only recorded digests, and preserves missing references', async t => {
  const root = mkdtempSync(join(tmpdir(), 'encore-external-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dir = join(root, 'replay')
  const log = join(root, 'workbuddy.jsonl')
  const time = '2026-10-10T15:00:00.000Z'
  const bytes = 'original report'
  const digest = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(join(root, 'report.txt'), bytes)
  const files = [{ path: 'report.txt', sha256: digest }, 'gone.txt']
  const records = [
    { type: 'message', role: 'user', cwd: root, timestamp: time, content: '<user_query>@"' + join(root, 'input.pdf') + '" Review the report</user_query>' },
    { type: 'function_call', callId: 'handoff', name: 'present_files', arguments: JSON.stringify({ files: files.map(f => f.path || f), cwd: root }), timestamp: time },
    { type: 'function_call_result', callId: 'handoff', timestamp: time, output: JSON.stringify({ type: 'present_files_result', files }) },
    { type: 'message', role: 'assistant', cwd: root, timestamp: time, content: '[Report](report.txt)' },
  ]
  writeFileSync(log, records.map(row => JSON.stringify(row)).join('\n'))
  const exported = await buildReplay(log, { tool: 'workbuddy', outDir: dir, assetRoots: [root] })
  const [input, handoff, reply] = exported.session.items
  const [verified, missing] = handoff.deliverables
  assert.equal(input.deliverables[0].availability, 'missing')
  assert.equal(verified.availability, 'verified')
  assert.equal(verified.sessionSha256, digest)
  assert.deepEqual(missing, { title: 'gone.txt', availability: 'missing' })
  assert.equal(reply.deliverables[0].availability, 'export-copy')
  assert.equal(reply.deliverables[0].href, verified.href)
  assert.equal(readFileSync(join(dir, verified.href), 'utf8'), bytes)
  assert.equal(verified.source, undefined)
  const html = renderPlayerWidget(exported.session, undefined, { lang: 'zh' })
  assert.match(html, /<strong>gone\.txt<\/strong><small>未找到原文件，无法回看<\/small>/)
  assert.ok(html.includes('已收录导出时的版本，无法确认是否与会话当时一致'))
  rmSync(join(root, 'report.txt'))
  const rebuilt = await buildReplay(dir)
  assert.equal(rebuilt.session.items[1].deliverables[0].availability, 'verified')
  writeFileSync(join(dir, verified.href), 'changed after export')
  const altered = await buildReplay(dir)
  assert.equal(altered.session.items[1].deliverables[0].availability, 'export-copy')
  assert.ok(renderPlayerWidget(altered.session, undefined, { lang: 'zh' }).includes('与会话记录的校验值不符'))
})

test('workbook previews preserve tab order and compare the requested Excel cell', async t => {
  const { default: xlsx } = await import('node-xlsx')
  const dir = mkdtempSync(join(tmpdir(), 'encore-workbook-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const updatedAt = new Date('2026-10-10T00:00:00.000Z')
  for (const [name, value] of [['before', '经销商'], ['after', '分销商']]) {
    const bytes = xlsx.build([
      {
        name: '名单',
        data: [
          ['公司'],
          ['Example', undefined, undefined, undefined, undefined, value],
          [updatedAt],
        ],
      },
      { name: '说明', data: [[], [undefined, '使用说明']] },
    ])
    writeFileSync(join(dir, name + '.xlsx'), bytes)
  }
  writeFileSync(join(dir, 'corrupt.xlsx'), 'not a workbook')
  const file = { title: '名单', href: 'after.xlsx', revision: { href: 'before.xlsx', label: '公司类型', sheet: '名单', cell: 'F2' } }
  const corrupt = { title: '坏文件', href: 'corrupt.xlsx' }
  writeFileSync(join(dir, 'session.json'), JSON.stringify({ ...sampleSession, deliverables: [file, corrupt] }))
  const { session } = await buildReplay(dir)
  const { preview } = session.deliverables[0]
  assert.deepEqual(preview.change, { before: '经销商', after: '分销商' })
  const sheets = JSON.parse(readFileSync(join(dir, preview.src), 'utf8'))
  assert.deepEqual(sheets.map(sheet => sheet.sheet), ['名单', '说明'])
  assert.equal(sheets[0].data[1][5], '分销商')
  assert.equal(sheets[0].data[2][0], '2026-10-10T00:00:00.000Z')
  assert.equal(sheets[1].data[1][1], '使用说明')
  assert.equal(session.deliverables[1].preview, undefined)
})

test('createSessionPlaybackModel hydrates slim snapshots and steps', () => {
  const line = timeline(sampleSession, { lang: 'zh' })
  const model = createSessionPlaybackModel({
    steps: line.steps,
    initialSnapshot: line.initialSnapshot,
    contextRecords: line.contextRecords,
  })
  const step0 = model.selectStep(0)
  assert.equal(step0.kind, 'prompt')
  assert.ok(step0.typewriterFrames.length > 0)
  assert.ok(step0.contextSnapshot.categories.some(c => c.id === 'user' && c.items.length === 1))
})

test('redactSession masks secrets and findLeaks warns on advisory patterns without throwing', () => {
  const mockOpenAiKey = `${'sk'}-${'1234567890abcdefghijklmnop'}`
  const dirty = {
    tool: 'codex',
    items: [
      {
        type: 'user',
        text: `Check /Users/alice/secret with ${mockOpenAiKey} and user@example.com on 192.168.1.50 plus https://api.corp.internal/v1?token=my_secret_123`,
        time: '2026-10-10T10:00:00.000Z',
      },
    ],
  }
  const cleaned = redactSession(dirty)
  const text = cleaned.items[0].text
  assert.doesNotMatch(text, /\/Users\/alice/)
  assert.doesNotMatch(text, /sk-1234567890/)
  assert.doesNotMatch(text, /user@example\.com/)
  assert.doesNotMatch(text, /192\.168\.1\.50/)
  assert.match(text, /~\/secret/)
  assert.match(text, /\[密钥\]/)
  assert.match(text, /\[邮箱\]/)
  assert.match(text, /\[内网地址\]/)

  const leaks = findLeaks(cleaned)
  assert.ok(leaks.length >= 2, 'should detect internal domain and token query param as non-blocking warnings')
})

test('buildReplay imports raw JSONL with default WebP frame extraction and supports rebuild from edited session.json', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'encore-test-'))
  try {
    // Create a tiny 32x24 PNG base64 image
    const pngBuf = await sharp({
      create: { width: 32, height: 24, channels: 3, background: { r: 65, g: 118, b: 230 } },
    }).png().toBuffer()
    const dataUri = `data:image/png;base64,${pngBuf.toString('base64')}`

    const logPath = join(tmp, 'rollout-sample.jsonl')
    const records = [
      { type: 'session_meta', timestamp: '2026-11-17T10:00:00.000Z', payload: { model: 'gpt-5.4', base_instructions: '# Identity\nYou are Codex.' } },
      {
        type: 'response_item',
        timestamp: '2026-11-17T10:00:02.000Z',
        payload: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: '请帮我设计一张横版架构图' },
            { type: 'input_image', image_url: dataUri },
          ],
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-11-17T10:00:10.000Z',
        payload: {
          type: 'function_call',
          call_id: 'call_1',
          name: 'exec_command',
          arguments: JSON.stringify({ cmd: 'ls -la' }),
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-11-17T10:00:12.000Z',
        payload: {
          type: 'function_call_output',
          call_id: 'call_1',
          output: 'total 8\nREADME.md',
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-11-17T10:00:20.000Z',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '架构图已经生成完毕。' }],
        },
      },
    ]
    writeFileSync(logPath, records.map(r => JSON.stringify(r)).join('\n'), 'utf8')

    const detected = await detectInput(logPath)
    assert.equal(detected.kind, 'raw-log')
    assert.equal(detected.tool, 'codex')

    const outDir = join(tmp, 'out-replay')
    const imported = await buildReplay(logPath, { outDir, lang: 'zh' })
    assert.equal(imported.mode, 'import')
    assert.equal(imported.session.title, '请帮我设计一张横版架构图')
    assert.equal(imported.session.frames?.length, 1, 'should extract embedded image by default')
    assert.equal(imported.session.frames[0].label, '参考画面 #1')
    assert.equal(imported.session.frames[0].w, 32)
    assert.equal(imported.session.frames[0].h, 24)
    assert.ok(existsSync(join(outDir, imported.session.frames[0].img)))
    assert.ok(existsSync(join(outDir, 'index.html')))
    assert.ok(existsSync(join(outDir, 'encore-player.js')))
    assert.ok(existsSync(join(outDir, 'encore-player.css')))

    const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8')
    assert.match(indexHtml, /<div data-encore-player src="\.\/session\.json"/)

    // Simulate curating session.json and re-running buildReplay on the output directory
    const sessionJsonPath = join(outDir, 'session.json')
    const edited = JSON.parse(readFileSync(sessionJsonPath, 'utf8'))
    edited.title = '精修标题：横版架构图设计'
    edited.description = '一段精修后的开场故事导读。'
    edited.frames[0].label = '用户提供的草图参考'
    writeFileSync(sessionJsonPath, JSON.stringify(edited, null, 2), 'utf8')

    const rebuilt = await buildReplay(outDir)
    assert.equal(rebuilt.mode, 'rebuild')
    assert.equal(rebuilt.session.title, '精修标题：横版架构图设计')
    assert.equal(rebuilt.session.frames[0].label, '用户提供的草图参考')
    const updatedHtml = readFileSync(join(outDir, 'index.html'), 'utf8')
    assert.match(updatedHtml, /<title>精修标题：横版架构图设计 · Encore<\/title>/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('buildReplay auto-detects and imports claude-code and claude-ai logs', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'encore-cc-test-'))
  try {
    const ccLog = join(tmp, 'claude-session.jsonl')
    const ccRecords = [
      { type: 'custom-title', customTitle: '修复构建脚本', timestamp: '2026-11-17T08:00:00.000Z' },
      {
        type: 'user',
        timestamp: '2026-11-17T08:00:01.000Z',
        message: { content: [{ type: 'text', text: '请检查 package.json' }] },
      },
      {
        type: 'assistant',
        timestamp: '2026-11-17T08:00:05.000Z',
        message: {
          id: 'msg_1',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 14000 },
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/Users/test/project/package.json' } },
            { type: 'text', text: '已检查完毕。' },
          ],
        },
      },
    ]
    writeFileSync(ccLog, ccRecords.map(r => JSON.stringify(r)).join('\n'), 'utf8')
    const ccOut = join(tmp, 'cc-out')
    const ccResult = await buildReplay(ccLog, { outDir: ccOut, lang: 'en' })
    assert.equal(ccResult.tool, 'claude-code')
    assert.equal(ccResult.session.title, '修复构建脚本')
    assert.equal(ccResult.session.lang, 'en')

    const caiFile = join(tmp, 'claude-ai-export.json')
    const caiData = [
      {
        uuid: 'conv-1',
        name: 'Brainstorming Encore Architecture',
        chat_messages: [
          { uuid: 'm1', sender: 'human', created_at: '2026-11-17T09:00:00.000Z', text: 'How should we structure the player?' },
          { uuid: 'm2', parent_message_uuid: 'm1', sender: 'assistant', created_at: '2026-11-17T09:00:10.000Z', text: 'Use a three-layer architecture like asciinema.' },
        ],
      },
    ]
    writeFileSync(caiFile, JSON.stringify(caiData), 'utf8')
    const caiOut = join(tmp, 'cai-out')
    const caiResult = await buildReplay(caiFile, { outDir: caiOut, lang: 'en' })
    assert.equal(caiResult.tool, 'claude-ai')
    assert.equal(caiResult.session.title, 'Brainstorming Encore Architecture')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('redacts cross-session MEMORY_SUMMARY by default, masks extended secret formats, and tolerates trailing broken JSONL lines', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'encore-privacy-test-'))
  try {
    const mockDbPass = ['my', 'db', 'pass', '987'].join('_')
    const mockJwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'].join('.')
    const logPath = join(tmp, 'rollout-mem.jsonl')
    const memBlock = [
      '========= MEMORY_SUMMARY BEGINS =========',
      '## User Profile',
      '- Secret salary budget 999999 and internal repo acme-core',
      '### acme-core / AcmeCloud',
      '- Private note',
      '========= MEMORY_SUMMARY ENDS =========',
    ].join('\n')
    const lines = [
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-11-17T10:00:00.000Z',
        payload: {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: memBlock }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-11-17T10:00:05.000Z',
        payload: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Test postgres://admin:${mockDbPass}@db.example.com:5432/prod and ${mockJwt} and C:\\Users\\alice\\config.json and API_SECRET="my_top_secret_val"`,
            },
            {
              type: 'input_image',
              image_url: 'data:image/png;base64,NOT_A_VALID_PNG_IMAGE',
            },
          ],
        },
      }),
      '{"type":"response_item","timestamp":"2026-11-17T10:00:06.000Z","payload":{"unterminated',
    ]
    writeFileSync(logPath, lines.join('\n'), 'utf8')

    const outDefault = join(tmp, 'out-default')
    const resDefault = await buildReplay(logPath, { outDir: outDefault })
    const memEntry = resDefault.session.initialContext?.mem?.find(m => m.id === 'init-mem-memory-summary')
    assert.ok(memEntry, 'should capture memory-summary entry')
    assert.match(memEntry.payload, /REDACTED BY DEFAULT/)
    assert.doesNotMatch(memEntry.payload, /acme-core/)
    assert.doesNotMatch(memEntry.payload, /999999/)

    const userText = resDefault.session.items[0].text
    assert.doesNotMatch(userText, new RegExp(mockDbPass))
    assert.doesNotMatch(userText, /dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U/)
    assert.doesNotMatch(userText, /C:\\Users\\alice/)
    assert.doesNotMatch(userText, /my_top_secret_val/)

    const outFull = join(tmp, 'out-full')
    const resFull = await buildReplay(logPath, { outDir: outFull, includeMemory: true })
    const fullMemEntry = resFull.session.initialContext?.mem?.find(m => m.id === 'init-mem-memory-summary')
    assert.match(fullMemEntry.payload, /999999/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('timeline preserves reasoning-only turns, prevents negative token regression after real samples, and renders user reference frame cards', () => {
  const session = {
    tool: 'codex',
    model: 'gpt-5.4',
    started: '2026-11-17T10:00:00.000Z',
    ended: '2026-11-17T10:05:00.000Z',
    frames: [
      { time: '2026-11-17T10:00:00.000Z', img: 'ref1.webp', who: 'you', label: '用户手绘草图', w: 800, h: 600 },
    ],
    items: [
      { type: 'user', text: '看这张图 [附图]', images: ['ref1.webp'], time: '2026-11-17T10:00:00.000Z' },
      { type: 'reasoning', text: '先思考一下整体布局结构，不需要调用外部工具。', time: '2026-11-17T10:00:05.000Z' },
      { type: 'assistant', text: '好的，直接给你方案。', contextTokens: 42000, time: '2026-11-17T10:00:10.000Z' },
      { type: 'user', text: '再改一版文档', time: '2026-11-17T10:01:00.000Z' },
      {
        type: 'tool',
        name: 'apply_patch',
        summary: '修改 design.md',
        input: '*** Begin Patch\n*** Update File: docs/design.md\n@@\n+---\n+title: 架构设计说明\n+---\n+# 核心架构\n+正文内容',
        stats: { edit: 1 },
        time: '2026-11-17T10:01:10.000Z',
        done: '2026-11-17T10:01:15.000Z',
      },
      { type: 'assistant', text: '文档已更新。', time: '2026-11-17T10:01:20.000Z' },
    ],
  }

  const line = timeline(session, { lang: 'zh' })
  assert.equal(line.steps.length, 6, 'should include reasoning-only work group as a step')

  // Check token progression after calibrated step 2 (42000) -> step 3 (user) -> step 4 (tool) -> step 5 (assistant)
  const tok2 = line.steps[2].contextSnapshot.totalTokens
  const tok3 = line.steps[3].contextSnapshot.totalTokens
  const tok4 = line.steps[4].contextSnapshot.totalTokens
  const tok5 = line.steps[5].contextSnapshot.totalTokens
  assert.equal(tok2, 42000)
  assert.ok(tok3 > tok2, `user step after calibrated total should increase tokens (${tok3} > ${tok2})`)
  assert.ok(tok4 > tok3, `uncalibrated work step should add tool tokens instead of regressing (${tok4} > ${tok3})`)
  assert.ok(tok5 > tok4, `uncalibrated assistant step should add reply tokens (${tok5} > ${tok4})`)

  // Check doc extraction from apply_patch + frontmatter
  assert.equal(line.steps[4].docs?.length, 1)
  assert.equal(line.steps[4].docs[0].title, '核心架构')

  const html = renderPlayerWidget(session, line, { lang: 'zh' })
  const stepMatches = [...html.matchAll(/class="session-entry[^"]*"\s+data-step="(\d+)"/g)]
  assert.equal(stepMatches.length, 6, 'DOM data-step count must match line.steps.length')
  assert.match(html, /用户手绘草图/, 'user reference frame label should render as stage card')
  assert.match(html, /<div class="session-tl-track-wrap" data-tl-track>\s*<span class="session-composer-progress"/, 'progress hairline should be inside track wrap for alignment')
})

test('Codex patch previews keep each Markdown document and its modal separate', () => {
  const session = readCodex([{
    type: 'response_item', timestamp: '2026-11-18T10:00:00Z', payload: {
      type: 'custom_tool_call', name: 'apply_patch', call_id: 'patch-1',
      input: [
        '*** Begin Patch',
        '*** Update File: en/README.md', '@@', '-# Old', '+# Hello', ' English body.',
        '*** Update File: src/example.js', '@@', '+// no preview',
        '*** Delete File: obsolete.md',
        '*** Update File: draft.md', '*** Move to: zh/README.md', '@@', '+# 你好', '+中文正文。',
        '*** Add File: notes.md', '+# Notes', '+A separate note.', '*** End Patch',
      ].join('\r\n'),
    },
  }])
  const line = timeline(session)
  const docs = line.steps.flatMap(step => step.docs || [])
  assert.deepEqual(docs.map(doc => [doc.file, doc.content]), [
    ['README.md', '# Hello\nEnglish body.'],
    ['README.md', '# 你好\n中文正文。'],
    ['notes.md', '# Notes\nA separate note.'],
  ])
  assert.equal(new Set(docs.map(doc => doc.id)).size, docs.length)
  const html = renderPlayerWidget(session, line)
  for (const doc of docs) {
    assert.ok(html.includes(`data-doc-open="${doc.id}"`))
    assert.ok(html.includes(`data-doc-html="${doc.id}"`))
  }
})

test('a clipped patch does not attach a later file to the last visible header', () => {
  const input = [
    '*** Begin Patch', '*** Add File: first.md', '+# First', '+' + 'a'.repeat(220),
    '*** Add File: second.md', '+' + 'b'.repeat(220), '+# Second', '+Only in second.', '*** End Patch',
  ].join('\n')
  const session = clipSession({
    tool: 'codex',
    items: [{ type: 'tool', name: 'apply_patch', kind: 'edit', file: 'first.md', time: sampleSession.started, input }],
  }, { input: 240 })
  assert.ok(session.items[0].input.includes('Only in second.'))
  assert.ok(!session.items[0].input.includes('second.md'))
  const docs = timeline(session).steps.flatMap(step => step.docs || [])
  assert.deepEqual(docs.map(doc => doc.title), ['First'])
  assert.doesNotMatch(docs[0].content, /Second|Only in second/)
})

test('buildReplay auto-detects workbuddy logs and scanRecentSessions includes workbuddy projects', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'encore-wb-test-'))
  try {
    const wbProjectDir = join(tmp, 'workbuddy', 'workspace-a')
    const wbLog = join(wbProjectDir, 'wb-session-1.jsonl')
    const wbRecords = [
      { type: 'ai-title', aiTitle: '整理竞品分析报告', timestamp: '2026-11-18T02:00:00.000Z' },
      {
        type: 'message',
        role: 'user',
        timestamp: '2026-11-18T02:00:02.000Z',
        content: [
          {
            type: 'input_text',
            text: '<system-reminder>ignore</system-reminder><user_query>请读取 @"docs/report.pdf" 并使用 @skill:/path/to/hv-analysis/SKILL.md 横纵分析 生成摘要</user_query>',
          },
        ],
      },
      {
        type: 'reasoning',
        timestamp: '2026-11-18T02:00:05.000Z',
        rawContent: [{ type: 'text', text: '先解析用户附带的 PDF 文档并加载 hv-analysis 技能。' }],
      },
      {
        type: 'function_call',
        callId: 'wb_call_1',
        name: 'Read',
        arguments: JSON.stringify({ file_path: 'docs/report.pdf' }),
        timestamp: '2026-11-18T02:00:08.000Z',
      },
      {
        type: 'function_call_result',
        callId: 'wb_call_1',
        output: 'PDF content: 2026 Q4 Market Overview',
        timestamp: '2026-11-18T02:00:11.000Z',
      },
      {
        type: 'message',
        role: 'assistant',
        timestamp: '2026-11-18T02:00:20.000Z',
        providerData: {
          model: 'deepseek-v4',
          messageId: 'msg_wb_1',
          rawUsage: { total_tokens: 48200 },
        },
        content: [{ type: 'output_text', text: '已完成竞品分析报告摘要。' }],
      },
    ]
    mkdirSync(wbProjectDir, { recursive: true })
    writeFileSync(wbLog, wbRecords.map(r => JSON.stringify(r)).join('\n'), 'utf8')

    const detected = await detectInput(wbLog)
    assert.equal(detected.kind, 'raw-log')
    assert.equal(detected.tool, 'workbuddy')

    const codexWithTitleLog = join(tmp, 'codex-with-title.jsonl')
    writeFileSync(
      codexWithTitleLog,
      [
        JSON.stringify({ type: 'ai-title', aiTitle: 'Codex Title First', timestamp: '2026-11-18T02:00:00.000Z' }),
        JSON.stringify({ type: 'session_meta', payload: { id: 'sess_1', model_provider: 'openai' } }),
      ].join('\n'),
      'utf8',
    )
    const detectedCodex = await detectInput(codexWithTitleLog)
    assert.equal(detectedCodex.tool, 'codex', 'shared ai-title record must not misidentify codex logs as workbuddy')

    const wbOut = join(tmp, 'wb-out')
    const wbResult = await buildReplay(wbLog, { outDir: wbOut, lang: 'zh' })
    assert.equal(wbResult.tool, 'workbuddy')
    assert.equal(wbResult.toolLabel, 'WorkBuddy')
    assert.equal(wbResult.session.title, '整理竞品分析报告')
    assert.equal(wbResult.session.model, 'deepseek-v4')
    assert.equal(wbResult.session.tokens, 48200)
    assert.match(wbResult.session.items[0].text, /@hv-analysis 横纵分析/)
    assert.match(wbResult.session.items[0].text, /\[附件：report\.pdf\]/)

    const line = timeline(wbResult.session, { lang: 'zh' })
    const sysCat = line.steps[0].contextSnapshot.categories.find(c => c.id === 'sys')
    assert.ok(sysCat.items.some(item => /WorkBuddy/.test(item.title)))
    const schema = line.steps[0].contextSnapshot.categories.find(c => c.id === 'schema')
    const tools = schema.items.flatMap(item => JSON.parse(item.payload).tools || [])
    assert.deepEqual(tools.sort(), ['Agent', 'edit_file', 'list_dir', 'read_file', 'run_command', 'web_search', 'write_file'])

    const customHtml = renderPlayerWidget(wbResult.session, line, {
      lang: 'zh',
      backHref: '/sessions/00/',
      backLabel: '← 第 0 讲的对话',
    })
    assert.match(customHtml, /<a class="session-back" href="\/sessions\/00\/">← 第 0 讲的对话<\/a>/)
    assert.doesNotMatch(customHtml, /data-encore-lang-toggle/)

    const scanned = await scanRecentSessions({
      codexDir: join(tmp, 'empty-codex'),
      claudeDir: join(tmp, 'empty-claude'),
      workbuddyDir: join(tmp, 'workbuddy'),
    })
    assert.equal(scanned.length, 1)
    assert.equal(scanned[0].tool, 'workbuddy')
    assert.equal(scanned[0].toolLabel, 'WorkBuddy')
    assert.equal(scanned[0].preview, '整理竞品分析报告')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('timeline assigns adaptive playback speeds (1.0x / 12x / 0.8x) and renders sub-agent report cards', () => {
  const richSession = {
    tool: 'codex',
    model: 'gpt-5.4',
    started: '2026-10-10T10:00:00.000Z',
    ended: '2026-10-10T10:10:00.000Z',
    items: [
      { type: 'user', text: '请并行审查全部模块', time: '2026-10-10T10:00:00.000Z' },
      {
        type: 'tool',
        name: 'spawn_agent',
        summary: '派出子任务 security_audit',
        input: 'Audit auth module',
        stats: { agent: 1 },
        agent: 'security_audit',
        time: '2026-10-10T10:00:05.000Z',
        done: '2026-10-10T10:00:25.000Z',
      },
      {
        type: 'tool',
        name: 'agent_message',
        summary: '子任务 security_audit 交回结果',
        output: '## 审计结论\n已完成全部认证与会话模块的静态分析，未发现越权漏洞或敏感凭据硬编码问题。',
        stats: { reply: 1 },
        agent: 'security_audit',
        time: '2026-10-10T10:00:25.000Z',
      },
      ...Array.from({ length: 6 }, (_, idx) => ({
        type: 'tool',
        name: 'Read',
        summary: `读取 mod-${idx + 1}.mjs`,
        input: `{"file_path":"src/mod-${idx + 1}.mjs"}`,
        output: 'x'.repeat(2000),
        stats: { read: 1 },
        time: `2026-10-10T10:00:${String(30 + idx).padStart(2, '0')}.000Z`,
        done: `2026-10-10T10:00:${String(31 + idx).padStart(2, '0')}.000Z`,
      })),
      { type: 'assistant', text: '全部模块审查完毕。', time: '2026-10-10T10:02:00.000Z' },
      { type: 'user', text: '把审计结论写进文档', time: '2026-10-10T10:03:00.000Z' },
      {
        type: 'tool',
        name: 'Edit',
        summary: '修改 README.md',
        input: '*** Update File: README.md\n+审计通过',
        stats: { edit: 1 },
        time: '2026-10-10T10:03:10.000Z',
        done: '2026-10-10T10:03:15.000Z',
      },
    ],
  }

  const line = timeline(richSession, { lang: 'zh' })
  assert.equal(line.steps[0].speedLabel, '1.0×')
  assert.equal(line.steps[1].speedLabel, '12×')
  assert.equal(line.steps[2].speedLabel, '1.0×')
  assert.equal(line.steps[4].speedLabel, '0.8×')
  assert.equal(line.steps[1].subagents?.length, 2)
  assert.equal(line.steps[1].subagents[0].label, 'security_audit')
  assert.equal(line.steps[1].subagents[0].state, 'sent')
  assert.equal(line.steps[1].subagents[1].state, 'done')

  const html = renderPlayerWidget(richSession, line, { lang: 'zh' })
  assert.match(html, /security_audit/)
  assert.match(html, /查看报告/)
  const english = timeline(richSession, { lang: 'en' })
  assert.equal(english.steps[1].subagents[0].badge, 'Dispatched')
  assert.equal(english.steps[1].subagents[1].badge, 'Returned')
})

test('standalone player bundle matches src modules and showcase session passes schema & leak checks', () => {
  const diskBundle = readFileSync(join(repoRoot, 'player', 'encore-player.js'), 'utf8')
  const memoryBundle = buildStandalonePlayerJs({ write: false })
  assert.equal(diskBundle, memoryBundle, 'player/encore-player.js must stay in sync with src modules (run pnpm run build:player)')

  const schema = JSON.parse(readFileSync(join(repoRoot, 'schema', 'session.schema.json'), 'utf8'))
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.ok(schema.properties.tool.enum.includes('workbuddy'))

  for (const id of ['ai-tree-1014', 'ai-tree-1015', 'lesson-00-buyers-codex', 'lesson-00-buyers-workbuddy']) {
    const session = JSON.parse(readFileSync(join(repoRoot, 'site/demos', id, 'session.json'), 'utf8'))
    for (const key of schema.required) assert.ok(session[key] !== undefined, `${id} missing ${key}`)
    assert.equal(findLeaks(session).length, 0, `${id} must have zero privacy leaks`)
  }
})

test('structured tool metadata (kind, file, skill) keeps right-hand context chips and doc previews intact after polishing summary', () => {
  const curatedSession = {
    tool: 'codex',
    model: 'gpt-5.4',
    started: '2026-11-18T10:00:00.000Z',
    ended: '2026-11-18T10:03:00.000Z',
    items: [
      { type: 'user', text: '把第一讲开场页改得更有悬念', time: '2026-11-18T10:00:00.000Z' },
      {
        type: 'tool',
        name: 'Skill',
        kind: 'skill',
        skill: 'slides-review',
        summary: '按章节规范对齐教学节奏',
        stats: { skill: 1 },
        time: '2026-11-18T10:00:05.000Z',
        done: '2026-11-18T10:00:07.000Z',
      },
      {
        type: 'tool',
        name: 'Read',
        kind: 'read',
        file: 'AGENTS.md',
        summary: '核对幻灯片排版红线',
        stats: { read: 1 },
        time: '2026-11-18T10:00:10.000Z',
        done: '2026-11-18T10:00:12.000Z',
      },
      {
        type: 'tool',
        name: 'Edit',
        kind: 'edit',
        file: '1.1.md',
        summary: '润色第一讲开场页叙事钩子',
        input: '# 第一讲：为什么 AI 总在一本正经地胡说八道？\n\n从一次真实的线上事故讲起。',
        stats: { edit: 1 },
        time: '2026-11-18T10:00:20.000Z',
        done: '2026-11-18T10:00:35.000Z',
      },
      { type: 'assistant', text: '已重塑第一讲开场页悬念。', time: '2026-11-18T10:01:00.000Z' },
    ],
  }

  const line = timeline(curatedSession, { lang: 'zh' })
  const workStep = line.steps[1]
  assert.ok(workStep.contextSnapshot.chips.skills.includes('slides-review'))
  assert.ok(workStep.contextSnapshot.chips.memories.includes('AGENTS.md'))
  assert.ok(workStep.contextSnapshot.chips.tools.includes('1.1.md'))
  assert.ok(workStep.contextSnapshot.chips.changes.includes('1.1.md'))
  assert.equal(workStep.docs?.length, 1)
  assert.equal(workStep.docs[0].file, '1.1.md')
  assert.equal(workStep.docs[0].title, '第一讲：为什么 AI 总在一本正经地胡说八道？')
})

test('buildReplay without outDir writes to a unique, private OS temp directory instead of cwd/replays', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'encore-default-out-'))
  const previousCwd = process.cwd()
  const builtDirs = []
  const makeLog = (dir, promptText) => {
    mkdirSync(dir, { recursive: true })
    const logPath = join(dir, 'rollout-shared-name.jsonl')
    const records = [
      { type: 'session_meta', timestamp: '2026-11-19T10:00:00.000Z', payload: { model: 'gpt-5.4' } },
      {
        type: 'response_item',
        timestamp: '2026-11-19T10:00:01.000Z',
        payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: promptText }] },
      },
      {
        type: 'response_item',
        timestamp: '2026-11-19T10:00:02.000Z',
        payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Verified.' }] },
      },
    ]
    writeFileSync(logPath, records.map(row => JSON.stringify(row)).join('\n'), 'utf8')
    return logPath
  }
  try {
    const firstLog = makeLog(join(workspace, 'project-a'), 'First session with shared filename')
    const secondLog = makeLog(join(workspace, 'project-b'), 'Second session with shared filename')
    process.chdir(workspace)

    const first = await buildReplay(firstLog, { images: false })
    builtDirs.push(first.dir)
    const second = await buildReplay(secondLog, { images: false })
    builtDirs.push(second.dir)

    assert.notEqual(first.dir, second.dir)
    assert.equal(existsSync(join(workspace, 'replays')), false)
    for (const result of [first, second]) {
      const relToTmp = relative(resolve(tmpdir()), result.dir)
      assert.ok(relToTmp && !relToTmp.includes(sep) && relToTmp !== '..' && !isAbsolute(relToTmp))
      if (process.platform !== 'win32') {
        assert.equal(statSync(result.dir).mode & 0o777, 0o700)
      }
      assert.ok(existsSync(join(result.dir, 'session.json')))
      assert.ok(existsSync(join(result.dir, 'index.html')))
    }
    assert.match(readFileSync(first.sessionFile, 'utf8'), /First session with shared filename/)
    assert.match(readFileSync(second.sessionFile, 'utf8'), /Second session with shared filename/)
  } finally {
    process.chdir(previousCwd)
    for (const dir of builtDirs) rmSync(dir, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
})
