import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { buildReplay, elapsedClock, formatDuration, renderPlayerWidget, timeline } from '../src/index.mjs'
import { createSessionCatalog } from '../src/detect.mjs'
import { pickSession } from '../src/session-picker.mjs'

function sandbox(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'encore-anti-')))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

function log(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n'))
}

function step(step_index, type, fields) {
  return { step_index, created_at: new Date(1760000000000 + step_index * 1000).toISOString(), type,
    source: type === 'USER_INPUT' ? 'USER_EXPLICIT' : 'MODEL', status: 'DONE', ...fields }
}

test('imports exactly the specified Antigravity transcript with portable step media and review files', async t => {
  const root = sandbox(t)
  const store = join(root, '.gemini', 'antigravity', 'brain', 'test-id')
  const full = join(store, '.system_generated', 'logs', 'transcript_full.jsonl')
  const slim = join(dirname(full), 'transcript.jsonl')
  const detached = join(root, 'shared.jsonl')
  const env = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
  const original = process.env[env]
  process.env[env] = root
  t.after(() => { if (original === undefined) delete process.env[env]; else process.env[env] = original })
  mkdirSync(store, { recursive: true })
  const media = async (name, color) => {
    const path = join(store, name)
    await sharp({ create: { width: 16, height: 12, channels: 3, background: color } }).png().toFile(path)
    return { mime_type: 'image/png', uri: pathToFileURL(path).href }
  }
  const ref = await media('reference.png', 'green')
  const screen = await media('screenshot.png', 'red')
  const report = join(store, 'walkthrough.md')
  writeFileSync(report, '# Finished')
  const rows = [
    step(0, 'USER_INPUT', { content: '<USER_REQUEST>Review this</USER_REQUEST><ADDITIONAL_METADATA>noise</ADDITIONAL_METADATA>', media: [ref] }),
    step(1, 'PLANNER_RESPONSE', { thinking: 'Inspect the result', input_tokens: 45, cache_read_tokens: 100, output_tokens: 5, tool_calls: [
      { name: 'read_file', args: { Path: 'index.html' } }, { name: 'webview_browser', args: { intention: 'check rendered page' } },
    ] }),
    step(2, 'GENERIC', { content: 'file contents' }),
    step(3, 'GENERIC', { content: 'screenshot', media: [screen] }),
    step(4, 'PLANNER_RESPONSE', { tool_calls: [{ name: 'exit_plan_mode', args: { plan: '# Plan\nReview layout.' } }] }),
    step(5, 'GENERIC', { content: 'plan submitted' }),
    step(6, 'PLANNER_RESPONSE', { tool_calls: [{ name: 'notify_user', args: { PathsToReview: [report] } }] }),
    step(7, 'GENERIC', { content: 'submitted for review' }),
    step(8, 'PLANNER_RESPONSE', { content: 'Full answer' }),
  ]
  log(full, rows)
  log(slim, [rows[0], step(8, 'PLANNER_RESPONSE', { content: 'Short answer' })])
  log(detached, rows)
  const replay = await buildReplay(full, { outDir: join(root, 'replay') })
  assert.equal(replay.session.tool, 'antigravity-app')
  assert.equal(replay.session.items[0].text, 'Review this')
  assert.equal(replay.session.items.at(-1).text, 'Full answer')
  const tools = replay.session.items.filter(item => item.type === 'tool')
  assert.equal(replay.session.tokens, 150)
  assert.equal(tools[0].contextTokens, 145)
  assert.equal(tools[0].output, 'file contents')
  assert.equal(tools[1].output, 'screenshot')
  assert.equal(replay.session.frames.length, 2)
  for (const [item, who] of [[replay.session.items[0], 'you'], [tools[1], 'ai']]) {
    const frame = replay.session.frames.find(frame => frame.who === who)
    assert.ok(item.images.includes(frame.img))
    assert.equal((await sharp(readFileSync(join(replay.dir, frame.img))).metadata()).format, 'webp')
  }
  assert.equal(tools[2].deliverables, undefined)
  assert.equal(tools[2].file, 'implementation_plan.md')
  assert.equal(tools[2].input, '# Plan\nReview layout.')
  assert.equal(tools[3].deliverables.length, 1)
  assert.equal(readFileSync(join(replay.dir, tools[3].deliverables[0].href), 'utf8'), '# Finished')
  const replayLine = timeline(replay.session)
  const planDoc = replayLine.steps.flatMap(s => s.docs || []).find(d => d.file === 'implementation_plan.md')
  assert.equal(planDoc?.title, 'Review layout.')
  assert.equal(planDoc?.content, '# Plan\nReview layout.')
  assert.doesNotMatch(JSON.stringify(replayLine.initialSnapshot), /Codex System/)
  const short = await buildReplay(slim, { outDir: join(root, 'short'), images: false })
  assert.equal(short.session.items.at(-1).text, 'Short answer')
  assert.equal(short.session.frames, undefined)
  const copy = await buildReplay(detached, { outDir: join(root, 'copy') })
  assert.equal(copy.tool, 'antigravity')
  assert.equal(copy.session.frames, undefined)
  assert.equal(copy.session.items.find(item => item.name === 'notify_user').deliverables[0].unavailableReason, 'outside-root')
})

test('catalog groups App and CLI copies, prefers full logs and searches archived titles and complete first prompts', async t => {
  const dir = sandbox(t)
  const dirs = { codexDir: join(dir, 'codex', 'sessions'), claudeDir: join(dir, 'claude'),
    workbuddyDir: join(dir, 'workbuddy'), antigravityAppDir: join(dir, 'app', 'brain'), antigravityCliDir: join(dir, 'cli', 'brain') }
  const r = [step(0, 'USER_INPUT', { content: 'x'.repeat(100) + ' Needle' }), step(1, 'PLANNER_RESPONSE', { content: 'hidden from search' })]
  for (const root of [dirs.antigravityAppDir, dirs.antigravityCliDir]) {
    const logs = join(root, 'same-id', '.system_generated', 'logs')
    log(join(logs, 'transcript.jsonl'), r)
    if (root === dirs.antigravityAppDir) log(join(logs, 'transcript_full.jsonl'), r)
    const annotations = join(dirname(root), 'annotations')
    mkdirSync(annotations)
    writeFileSync(join(annotations, 'same-id.pbtxt'), 'title: "Review design"')
  }
  const id = '00000000-0000-4000-8000-000000000001'
  log(join(dir, 'codex', 'archived_sessions', 'rollout-' + id + '.jsonl'), [{ type: 'response_item', payload: { type: 'message', role: 'user', content: 'Needle in archive' } }])
  log(join(dir, 'codex', 'session_index.jsonl'), [{ id, thread_name: 'Renamed discussion' }])
  const list = createSessionCatalog(dirs)
  async function rows(options) {
    const result = []
    for await (const entry of list(options)) result.push(entry)
    return result
  }
  assert.equal((await rows()).length, 2)
  const matches = await rows({ group: 'antigravity', query: 'needle' })
  assert.deepEqual(matches.map(x => x.toolLabel).sort(), ['Antigravity App', 'Antigravity CLI'])
  assert.ok(matches.find(x => x.tool === 'antigravity-app').file.endsWith('transcript_full.jsonl'))
  assert.ok(matches.find(x => x.tool === 'antigravity-cli').file.endsWith('transcript.jsonl'))
  assert.equal((await rows({ query: 'review design' })).length, 2)
  assert.equal((await rows({ query: 'hidden from search' })).length, 0)
  const archived = await rows({ query: 'renamed discussion' })
  assert.equal(archived.length, 1)
  assert.equal(archived[0].archived, true)
})

test('Escape restores the original tab, page and selection after search', async () => {
  const input = Object.assign(new EventEmitter(), { setRawMode() {}, pause() {} })
  const output = { columns: 100, rows: 24, write() {} }
  async function* list({ group, query }) {
    for (let i = 0; i < 25; i++) yield { toolLabel: group || 'Codex', timeLabel: '', preview: query ?? 'recent', file: String(i) }
  }
  const result = pickSession({ input, output, list })
  async function key(name, str, shift = false) {
    input.emit('keypress', str, { name, shift })
    await new Promise(resolve => setImmediate(resolve))
  }
  await key('tab', '\t', true)
  await key('right')
  await key('down')
  await key('/', '/')
  await key('x', 'x')
  await key('escape')
  await key('return')
  assert.deepEqual(await result, { toolLabel: 'antigravity', timeLabel: '', preview: 'recent', file: '11' })
})

test('native App metadata supplies the title, last activity and archive flag', { skip: !process.getBuiltinModule?.('node:sqlite') }, async t => {
  const dir = sandbox(t)
  const root = join(dir, 'app', 'brain')
  const dirs = { antigravityAppDir: root, antigravityCliDir: join(dir, 'cli'), codexDir: join(dir, 'sessions'),
    workbuddyDir: join(dir, 'workbuddy'), claudeDir: join(dir, 'claude') }
  const rows = [step(0, 'USER_INPUT', { content: 'First prompt' })]
  for (const id of ['old', 'active']) log(join(root, id, '.system_generated', 'logs', 'transcript.jsonl'), rows)
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
  const db = new DatabaseSync(join(dirname(root), 'conversation_summaries.db'))
  db.exec(`CREATE TABLE conversation_summaries(conversation_id TEXT, title TEXT, last_modified_time TEXT, workspace_uris TEXT);
    CREATE TABLE conversations_fts(conversation_id TEXT, archived INTEGER);
    INSERT INTO conversation_summaries VALUES ('old','Archived design','2026-02-01 00:00:00+00:00','[]'),('active','Active design','2026-01-01 00:00:00+00:00','[]');
    INSERT INTO conversations_fts VALUES ('old',1),('active',0);`)
  db.close()
  const list = createSessionCatalog(dirs)
  const visible = []
  for await (const item of list()) visible.push(item.preview)
  assert.deepEqual(visible, ['Active design'])
  const matches = []
  for await (const item of list({ query: 'design' })) matches.push([item.preview, !!item.archived])
  assert.deepEqual(matches, [['Archived design', true], ['Active design', false]])
})

test('unmetered Antigravity usage and capacity stay unknown until a recorded sample', () => {
  const session = { tool: 'antigravity-cli', model: 'Claude', items: [
    { type: 'user', text: 'Hello' }, { type: 'assistant', text: 'Hi', contextTokens: 16471 },
  ] }
  const line = timeline(session)
  assert.equal(line.initialSnapshot.totalTokens, null)
  assert.equal(line.steps[0].contextSnapshot.totalTokens, null)
  assert.equal(line.steps[1].contextSnapshot.totalTokens, 16471)
  for (const snap of [line.initialSnapshot, ...line.steps.map(step => step.contextSnapshot)]) {
    assert.equal(snap.windowTokens, null)
    assert.equal(snap.pct, null)
  }
  const html = renderPlayerWidget(session, line, { lang: 'zh' })
  assert.match(html, /data-context-tot>初始用量未记录</)
  assert.match(html, /data-context-win>上限未知</)
  assert.match(html, /class="lc-overview-pct" hidden/)
  assert.match(html, /data-stacked-bar hidden/)
  assert.doesNotMatch(html, /null%|NaN%/)
  const measured = timeline({ ...session, contextWindow: 512000, initialContext: { estimatedTokens: 0 } })
  assert.equal(measured.initialSnapshot.totalTokens, 0)
  assert.equal(measured.initialSnapshot.pct, 0)
  assert.equal(measured.steps[1].contextSnapshot.pct, 3.2)
})

test('long titles leave the file size visible in All, agent tabs and archived search results', async () => {
  const input = Object.assign(new EventEmitter(), { setRawMode() {}, pause() {} })
  let screen = ''
  const output = { columns: 75, rows: 12, write(text) { if (text.includes('\n')) screen = text } }
  async function* list({ query }) {
    yield { toolLabel: 'Antigravity CLI', timeLabel: '2026-11-26 12:00', sizeKB: 4132,
      preview: '很长的标题'.repeat(50), archived: query !== undefined }
  }
  const picker = pickSession({ lang: 'zh', input, output, list })
  const repaint = () => new Promise(resolve => setImmediate(resolve))
  try {
    await repaint()
    assert.match(screen, /4132 KB/)
    input.emit('keypress', '\t', { name: 'tab', shift: true })
    await repaint()
    assert.match(screen, /\[Antigravity\]/)
    assert.match(screen, /4132 KB/)
    input.emit('keypress', '/', { name: '/' })
    await repaint()
    assert.match(screen, /已归档/)
    assert.match(screen, /4132 KB/)
    assert.match(screen, /标题|很长/)
  } finally {
    input.emit('keypress', '', { name: 'c', ctrl: true })
    await picker
  }
})

test('the native first request restores mounted context without counting the user or later tools', { skip: !process.getBuiltinModule?.('node:sqlite') }, async t => {
  const { default: protobuf } = await import('protobufjs')
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
  const { readAntigravityContext } = await import('../src/antigravity-context.mjs')
  const { fileURLToPath } = await import('node:url')
  const generation = protobuf.loadSync(fileURLToPath(new URL('../src/antigravity-context.proto', import.meta.url))).lookupType('CortexStepGeneratorMetadata')
  const root = sandbox(t)
  const native = { id: 'fixture', root: join(root, 'brain', 'fixture') }
  mkdirSync(join(root, 'conversations'))
  const db = new DatabaseSync(join(root, 'conversations', 'fixture.db'))
  db.exec('CREATE TABLE gen_metadata(idx INTEGER PRIMARY KEY, data BLOB)')
  const insert = db.prepare('INSERT INTO gen_metadata VALUES (?,?)')
  function batch(idx, stepIndex, limit, tools, groups) {
    insert.run(idx, generation.encode({ stepIndices: [stepIndex], chatModel: {
      promptSections: [{ title: 'identity', content: 'Recorded system instruction', tokenType: 1 }, { title: 'user_rules', content: 'private rules', tokenType: 3 }],
      tools: tools.map(name => ({ name, description: 'Read a local file', jsonSchemaString: '{"type":"object"}' })),
      chatStartMetadata: { contextWindowMetadata: { maxContextTokens: limit, tokenBreakdown: { totalTokens: 900, groups } } },
    } }).finish())
  }
  const groups = [
    { name: 'System Prompt', type: 1, source: 1, numTokens: 380, children: [{ name: 'identity', numTokens: 380 }] },
    { name: 'Tools', type: 2, source: 1, numTokens: 200, children: [{ name: 'read_file', numTokens: 200 }] },
    { name: 'Rules', type: 3, source: 1, numTokens: 20, children: [{ name: 'user_rules', numTokens: 20 }] },
    { name: 'Chat Messages', type: 7, numTokens: 300 },
  ]
  batch(0, 1, 512000, ['read_file'], groups)
  batch(1, 3, 256000, ['new_tool'], groups)
  insert.run(2, Buffer.from([0x0a, 0x7f]))
  db.close()
  const rows = [step(0, 'USER_INPUT', {}), step(1, 'PLANNER_RESPONSE', {}), step(3, 'PLANNER_RESPONSE', {})]
  const { initialContext, contextWindow, windows } = readAntigravityContext(native, rows)
  assert.equal(contextWindow, 512000)
  assert.deepEqual([...windows], [[1, 512000], [3, 256000]])
  assert.equal(initialContext.estimatedTokens, 600)
  assert.equal(initialContext.sys[0].payload, 'Recorded system instruction')
  assert.deepEqual(initialContext.schema.map(r => [r.title, r.tokEst]), [['read_file', 200]])
  assert.match(initialContext.schema[0].payload, /"type":"object"/)
  assert.doesNotMatch(JSON.stringify(initialContext), /private rules|new_tool/)
  assert.equal(readAntigravityContext(native, rows, true).initialContext.mem[0].payload, 'private rules')
  assert.equal(readAntigravityContext(native, rows.slice(-1)).initialContext, undefined)
  const line = timeline({ tool: 'antigravity-app', initialContext, contextWindow, items: [
    { type: 'user', text: 'First prompt' }, { type: 'assistant', text: 'A', contextWindow: 512000, contextTokens: 2120 },
    { type: 'assistant', text: 'B', contextWindow: 256000, contextTokens: 2400 },
    { type: 'assistant', text: 'Unknown limit', contextWindow: 0, contextTokens: 2500 },
  ] })
  assert.equal(line.initialSnapshot.totalTokens, 600)
  assert.equal(line.initialSnapshot.estimated, true)
  assert.deepEqual(line.steps.map(s => s.contextSnapshot.windowTokens), [512000, 512000, 256000, null])
})

test('only completed Antigravity checkpoints mark compaction and recover pruned opening context', async t => {
  const dir = sandbox(t)
  const file = join(dir, 'transcript.jsonl')
  const checkpoint = step(4, 'CHECKPOINT', { source: 'SYSTEM', content: '<summary>Recorded summary</summary>', input_tokens: 999 })
  log(file, [
    step(0, 'USER_INPUT', { content: 'Review the file' }),
    step(1, 'PLANNER_RESPONSE', { content: 'First', input_tokens: 15000 }),
    step(2, 'CHECKPOINT', { status: 'RUNNING' }),
    step(3, 'PLANNER_RESPONSE', { content: 'Second', input_tokens: 10000 }),
    checkpoint, step(5, 'USER_INPUT', { content: 'Continue' }),
    step(6, 'PLANNER_RESPONSE', { content: 'Third', input_tokens: 5000 }),
  ])
  const {session} = await buildReplay(file, {outDir: join(dir,'replay')})
  const line = timeline(session)
  const checkpoints = line.steps.filter(s => s.compactInfo)
  assert.equal(checkpoints.length, 1)
  assert.equal(session.items.find(item => item.type === 'compact').time, checkpoint.created_at)
  const [cp] = checkpoints
  assert.equal(cp.compactInfo.content, 'Recorded summary')
  assert.equal(cp.compactInfo.trigger, undefined)
  assert.equal(cp.compactInfo.preTokens, 10000)
  assert.equal(cp.compactInfo.postTokens, 5000)
  assert.equal(cp.compactInfo.droppedTokens, 5000)
  assert.equal(cp.contextSnapshot.totalTokens, 5000)
  assert.equal(line.steps[cp.index + 1].contextSnapshot.totalTokens, 5180)
  assert.equal(line.steps.at(-1).contextSnapshot.totalTokens, 5000)
  assert.equal(cp.contextSnapshot.categories.find(c => c.id === 'tool').itemCount, 0)
  const html = renderPlayerWidget(session, line, { lang: 'zh' })
  assert.match(html, /上下文压缩 #1/)
  assert.match(html, /10\.0k → 5\.0k/)
  assert.ok(html.includes('datetime="' + checkpoint.created_at + '"'))
  assert.doesNotMatch(html, /自动压缩|lc-trigger|lc-reserve/)
})

test('Antigravity replays calibrate 7-color context, pair sub-agent replies, filter transient retries, and recover pruned DB baselines', { skip: !process.getBuiltinModule?.('node:sqlite') }, async t => {
  const { default: protobuf } = await import('protobufjs')
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
  const { readAntigravityContext } = await import('../src/antigravity-context.mjs')
  const { fileURLToPath } = await import('node:url')
  const generation = protobuf.loadSync(fileURLToPath(new URL('../src/antigravity-context.proto', import.meta.url))).lookupType('CortexStepGeneratorMetadata')

  // Verify fallback recovery when Antigravity prunes promptSections/tools/tokenBreakdown from idx=0.
  const dbRoot = sandbox(t)
  const native = { id: 'pruned', root: join(dbRoot, 'brain', 'pruned') }
  mkdirSync(join(dbRoot, 'conversations'))
  const db = new DatabaseSync(join(dbRoot, 'conversations', 'pruned.db'))
  db.exec('CREATE TABLE gen_metadata(idx INTEGER PRIMARY KEY, data BLOB)')
  const insert = db.prepare('INSERT INTO gen_metadata VALUES (?,?)')
  insert.run(0, generation.encode({ stepIndices: [1], chatModel: {
    chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 512000 } },
  } }).finish())
  insert.run(5, generation.encode({ stepIndices: [9], chatModel: {
    promptSections: [
      { title: 'identity', content: 'You are Antigravity.', tokenType: 1 },
      { title: 'skills', content: 'Available skills:\n- encore (/a/encore/SKILL.md): Replay sessions\n- slidev (/a/slidev/SKILL.md): Build decks', tokenType: 5 },
    ],
    tools: [{ name: 'read_file', description: 'Read file', jsonSchemaString: '{}' }],
    chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 512000, tokenBreakdown: {
      totalTokens: 1500,
      groups: [
        { name: 'System Prompt', type: 1, source: 1, numTokens: 300, children: [{ name: 'identity', numTokens: 300 }] },
        { name: 'Tools', type: 2, source: 1, numTokens: 400, children: [{ name: 'read_file', numTokens: 400 }] },
        { name: 'Skills', type: 5, source: 1, numTokens: 500, children: [{ name: 'skills', numTokens: 500 }] },
        { name: 'Chat Messages', type: 7, source: 0, numTokens: 300 },
      ],
    } } },
  } }).finish())
  db.close()
  const recovered = readAntigravityContext(native, [step(0, 'USER_INPUT', {}), step(1, 'PLANNER_RESPONSE', {}), step(9, 'PLANNER_RESPONSE', {})])
  assert.equal(recovered.initialContext.estimatedTokens, 1200)
  assert.equal(recovered.initialContext.sys[0].tag, 'Core')
  assert.deepEqual(recovered.initialContext.skill.map(s => s.title), ['encore', 'slidev'])
  assert.equal(recovered.initialContext.skill.reduce((n, s) => n + s.tokEst, 0), 500)

  const dir = sandbox(t)
  const file = join(dir, 'transcript.jsonl')
  const note = join(dir, 'outside.md')
  writeFileSync(note, '# External note')
  const subUuid = 'b8533277-34b9-4e68-89bc-f15d5cfa5d07'
  log(file, [
    step(0, 'USER_INPUT', { content: '<USER_REQUEST>Start work</USER_REQUEST>' }),
    step(1, 'PLANNER_RESPONSE', {
      input_tokens: 300000,
      cache_read_tokens: 8861,
      tool_calls: [
        { name: 'update_focus', args: { focus: 'Working' } },
        { name: 'update_steps', args: { steps: [{ title: 'Step 1', status: 'in_progress' }] } },
        { name: 'invoke_subagent', args: { TypeName: 'browser', Role: 'Slide Previewer', Prompt: 'Inspect slide 14' } },
      ],
    }),
    step(2, 'GENERIC', { content: 'OK' }),
    step(3, 'GENERIC', { content: 'OK' }),
    step(4, 'GENERIC', { content: `Created the following subagent:\n{"conversationId":"${subUuid}"}` }),
    step(5, 'SYSTEM_MESSAGE', {
      source: 'SYSTEM',
      content: `The following is a <SYSTEM_MESSAGE> not actually sent by the user.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=2026-11-24T06:33:07Z sender=${subUuid} priority=MESSAGE_PRIORITY_HIGH content=COMPLETED / TASK_COMPLETED\n\nVerified slide 14 renders cleanly with zero layout overflow.\n</SYSTEM_MESSAGE>`,
    }),
    step(6, 'ERROR_MESSAGE', {
      source: 'SYSTEM',
      error: 'API error (attempt 1): request failed: Post "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse": EOF',
    }),
    step(7, 'PLANNER_RESPONSE', { content: `Reviewed [outside.md](${pathToFileURL(note).href}) and finished.`, input_tokens: 308861 }),
    step(8, 'USER_INPUT', { content: '<USER_REQUEST>Next turn without new token sample</USER_REQUEST>' }),
    step(9, 'CHECKPOINT', { source: 'SYSTEM', content: '<summary>Final checkpoint without post sample</summary>' }),
  ])
  const { session } = await buildReplay(file, { outDir: join(dir, 'replay'), images: false })
  const toolItems = session.items.filter(item => item.type === 'tool')
  assert.deepEqual(toolItems.map(item => item.name), ['invoke_subagent', 'agent-message'])
  assert.equal(toolItems[0].agent, 'Slide Previewer')
  assert.equal(toolItems[1].agent, 'Slide Previewer')
  assert.match(toolItems[1].output, /^Verified slide 14 renders cleanly/)
  const replies = session.items.filter(item => item.type === 'assistant')
  assert.equal(replies.length, 1, 'transient API retry errors should not render as assistant replies')
  assert.equal(replies[0].deliverables, undefined, 'Antigravity prose file:// links should not spam deliverables')

  const line = timeline({ ...session, contextWindow: 512000, initialContext: recovered.initialContext }, { lang: 'zh' })
  const workStep = line.steps.find(s => s.subagents?.length)
  assert.ok(workStep, 'invoke_subagent and its reply should render as sub-agent pills')
  assert.equal(workStep.subagents[0].label, 'Slide Previewer')
  assert.equal(workStep.subagents[0].state, 'sent')
  assert.equal(workStep.subagents[1].label, 'Slide Previewer')
  assert.equal(workStep.subagents[1].state, 'done')
  assert.match(workStep.subagents[1].report, /Verified slide 14/)
  assert.ok(workStep.contextSnapshot.segments.tool > 0, 'Antigravity should render 7-color calibrated segments')
  assert.equal(workStep.contextSnapshot.totalTokens, 308861)

  const secondUser = line.steps.find(s => s.kind === 'prompt' && s.turn === 2)
  assert.ok(secondUser.contextSnapshot.totalTokens > 308861, 'subsequent user turns should add estimated prompt delta on top of last recorded sample')
  assert.equal(secondUser.contextSnapshot.pct, 60.4)

  const trailingCompact = line.steps.find(s => s.compactInfo)
  assert.equal(trailingCompact.compactInfo.droppedTokens, undefined, 'checkpoint without a post-compaction sample must not invent droppedTokens')
  assert.equal(trailingCompact.compactInfo.archivedTools, 2)
  assert.equal(trailingCompact.contextSnapshot.categories.find(c => c.id === 'tool').itemCount, 0)

  const html = renderPlayerWidget({ ...session, contextWindow: 512000, initialContext: recovered.initialContext }, line, { lang: 'zh' })
  assert.doesNotMatch(html, /data-lc-legend hidden/, '7-chip legend should be visible when context baseline exists')
  assert.match(html, /data-seg="sys"/)
  assert.match(html, /查看报告/)
  assert.equal(elapsedClock(210452), '2d 10:27:32')
  assert.equal(formatDuration(210452, 'zh'), '2 天 10 小时')
  assert.equal(formatDuration(210452, 'en'), '2d 10h')
  assert.equal(formatDuration(1560, 'zh'), '26 分钟')
})
