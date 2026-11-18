import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  buildReplay,
  createSessionPlaybackModel,
  detectInput,
  findLeaks,
  redactSession,
  renderPlayerWidget,
  timeline,
} from '../src/index.mjs'

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
  assert.match(htmlZh, /当前上下文/)
  assert.match(htmlZh, /上下文压缩 #1/)
  assert.match(htmlZh, /▶ 播放/)
  assert.match(htmlZh, /<strong>1\.1 页<\/strong>/)

  const lineEn = timeline(sampleSession, { lang: 'en' })
  assert.equal(lineEn.steps[0].contextSnapshot.categories[0].name, 'System Prompt')
  const htmlEn = renderPlayerWidget(sampleSession, lineEn, { lang: 'en' })
  assert.match(htmlEn, /Active Context/)
  assert.match(htmlEn, /Context Compaction #1/)
  assert.match(htmlEn, /▶ Play/)
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
  const dirty = {
    tool: 'codex',
    items: [
      {
        type: 'user',
        text: 'Check /Users/alice/secret with sk-1234567890abcdefghijklmnop and user@example.com on 192.168.1.50 plus https://api.corp.internal/v1?token=my_secret_123',
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
              text: 'Test postgres://admin:super_secret_pw@db.example.com:5432/prod and JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U and C:\\Users\\alice\\config.json and API_SECRET="my_top_secret_val"',
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
    assert.doesNotMatch(userText, /super_secret_pw/)
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
