import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { tools } from '../src/common.mjs'
import { buildReplay, findLeaks, renderPlayerWidget, timeline } from '../src/index.mjs'

const CAPABILITIES = [
  'initialContext',
  'contextTokens',
  'compaction',
  'subagents',
  'markdownDocs',
  'media',
  'memoryRedaction',
]

const MEMORY_SENTINEL = 'TOP_SECRET_MEMORY_SENTINEL_9421'
const FAKE_SECRET = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456'
const FAKE_HOME_PATH = '/Users/private-tester/secret-project/notes.md'

const SCHEMA_PATH = fileURLToPath(new URL('../schema/session.schema.json', import.meta.url))
const SESSION_SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
const README_EN_PATH = fileURLToPath(new URL('../README.md', import.meta.url))
const README_ZH_PATH = fileURLToPath(new URL('../README.zh-CN.md', import.meta.url))

const MATRIX_LABELS = {
  en: {
    headers: ['Agent', 'Opening context', 'Token & 7-color bar', 'Compaction', 'Sub-agent reports', 'Markdown drafts', 'Media frames', 'Memory redaction'],
    adapters: {
      codex: 'Codex',
      'claude-code': 'Claude Code',
      antigravity: 'Antigravity (App / CLI)',
      workbuddy: 'WorkBuddy',
      'claude-ai': 'Claude.ai',
    },
  },
  zh: {
    headers: ['Agent', '初始上下文', 'Token 与 7 色条', '上下文压缩', '子 Agent 报告', 'Markdown 草稿卡', '过程画面', '隐私记忆脱敏'],
    adapters: {
      codex: 'Codex',
      'claude-code': 'Claude Code',
      antigravity: 'Antigravity（App / CLI）',
      workbuddy: 'WorkBuddy',
      'claude-ai': 'Claude.ai',
    },
  },
}

function renderCapabilityMatrix(lang) {
  const { headers, adapters } = MATRIX_LABELS[lang]
  const sep = `| --- | ${CAPABILITIES.map(() => ':---:').join(' | ')} |`
  const rows = Object.entries(ADAPTER_CONTRACT).map(([id, spec]) => {
    const label = adapters[id]
    assert.ok(label, `missing ${lang} display label in MATRIX_LABELS for adapter "${id}"`)
    const cells = CAPABILITIES.map(cap => (spec.capabilities[cap] ? '✅' : '—'))
    return `| ${label} | ${cells.join(' | ')} |`
  })
  return [`| ${headers.join(' | ')} |`, sep, ...rows].join('\n')
}

function sandbox(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'encore-conform-')))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

function isoAt(sec) {
  return new Date(1760000000000 + sec * 1000).toISOString()
}

function writeJsonl(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
}

async function tinyPng(file) {
  mkdirSync(dirname(file), { recursive: true })
  const buf = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#3b82f6' } }).png().toBuffer()
  writeFileSync(file, buf)
  return { file, base64: buf.toString('base64'), dataUri: `data:image/png;base64,${buf.toString('base64')}` }
}

/**
 * Single-source conformance matrix for every supported Encore adapter.
 * Adding a new tool to `src/common.mjs` or `schema/session.schema.json` requires
 * registering it here with explicit capability flags (plus a reason for every
 * `false` capability) and a minimal fixture covering every `true` capability.
 */
export const ADAPTER_CONTRACT = {
  codex: {
    expectedTool: 'codex',
    aliases: [],
    capabilities: {
      initialContext: true,
      contextTokens: true,
      compaction: true,
      subagents: true,
      markdownDocs: true,
      media: true,
      memoryRedaction: true,
    },
    unsupportedReasons: {},
    async fixture(root) {
      const img = await tinyPng(join(root, 'codex-img.png'))
      const file = join(root, 'rollout-2026-11-27T00-00-00-codex.jsonl')
      writeJsonl(file, [
        {
          type: 'session_meta',
          timestamp: isoAt(0),
          payload: {
            cwd: root,
            model: 'gpt-5-codex',
            base_instructions: '# Core\nYou are Codex.\n\n# Safety\nVerify changes.',
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(1),
          payload: {
            type: 'additional_tools',
            tools: [{ name: 'apply_patch', description: 'Patch files' }],
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(2),
          payload: {
            type: 'message',
            role: 'developer',
            content: [
              {
                type: 'input_text',
                text: `<skills_instructions>\n- encore: Export replays\n</skills_instructions>\n========= MEMORY_SUMMARY BEGINS =========\n## Personal\n${MEMORY_SENTINEL}\n========= MEMORY_SUMMARY ENDS =========`,
              },
            ],
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(5),
          payload: {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: `Draft design doc and check ${FAKE_HOME_PATH} (key ${FAKE_SECRET})` },
              { type: 'input_image', image_url: img.dataUri },
            ],
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(10),
          payload: {
            type: 'custom_tool_call',
            call_id: 'c1',
            name: 'apply_patch',
            input: '*** Begin Patch\n*** Add File: design.md\n+# Design Spec\n+Conformance details.\n*** End Patch',
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(12),
          payload: { type: 'custom_tool_call_output', call_id: 'c1', output: 'Success.' },
        },
        {
          type: 'response_item',
          timestamp: isoAt(15),
          payload: {
            type: 'function_call',
            call_id: 'c2',
            name: 'spawn_agent',
            arguments: JSON.stringify({ task_name: 'reviewer', prompt: 'Check design.md' }),
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(20),
          payload: {
            type: 'agent_message',
            content: 'Message Type: FINAL_ANSWER\nSender: /root/reviewer\nPayload:\nReviewed design.md and verified all constraints cleanly with zero issues.',
          },
        },
        {
          type: 'event_msg',
          timestamp: isoAt(21),
          payload: {
            type: 'token_count',
            info: {
              model_context_window: 200000,
              total_token_usage: { total_tokens: 185000 },
              last_token_usage: { input_tokens: 180000, total_tokens: 185000 },
            },
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(25),
          payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Drafted design.md.' }] },
        },
        {
          type: 'response_item',
          timestamp: isoAt(30),
          payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Continue with compaction check' }] },
        },
        {
          type: 'compacted',
          timestamp: isoAt(35),
          payload: { window_number: 1, message: 'Archived earlier context cleanly.', replacement_history: [] },
        },
        {
          type: 'event_msg',
          timestamp: isoAt(36),
          payload: {
            type: 'token_count',
            info: {
              model_context_window: 200000,
              total_token_usage: { total_tokens: 210000 },
              last_token_usage: { input_tokens: 0, total_tokens: 24000 },
            },
          },
        },
        {
          type: 'response_item',
          timestamp: isoAt(40),
          payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Resumed after compaction.' }] },
        },
      ])
      return { input: file }
    },
  },

  'claude-code': {
    expectedTool: 'claude-code',
    aliases: [],
    capabilities: {
      initialContext: true,
      contextTokens: true,
      compaction: true,
      subagents: true,
      markdownDocs: true,
      media: true,
      memoryRedaction: true,
    },
    unsupportedReasons: {},
    async fixture(root) {
      const img = await tinyPng(join(root, 'cc-img.png'))
      const file = join(root, 'claude-session.jsonl')
      writeJsonl(file, [
        {
          type: 'api-request-shape',
          timestamp: isoAt(0),
          shape: {
            system: ['# Claude Core\nYou are Claude Code.'],
            tools: [{ name: 'Write', description: 'Write file', input_schema: { type: 'object' } }],
          },
        },
        {
          type: 'attachment',
          timestamp: isoAt(1),
          attachment: {
            type: 'instructions',
            files: [{ path: '/Users/dev/.claude/CLAUDE.md', type: 'User', content: `Personal note: ${MEMORY_SENTINEL}` }],
          },
        },
        {
          type: 'attachment',
          timestamp: isoAt(2),
          attachment: {
            type: 'skill_listing',
            content: '- encore: Export session replays',
          },
        },
        {
          type: 'user',
          timestamp: isoAt(5),
          cwd: root,
          message: {
            role: 'user',
            content: [
              { type: 'text', text: `Write spec from ${FAKE_HOME_PATH} with token ${FAKE_SECRET}` },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img.base64 } },
            ],
          },
        },
        {
          type: 'assistant',
          timestamp: isoAt(10),
          cwd: root,
          message: {
            id: 'msg-1',
            model: 'claude-opus-4-6',
            usage: { input_tokens: 10000, cache_read_input_tokens: 850000, output_tokens: 400 },
            content: [
              { type: 'tool_use', id: 'tu-1', name: 'Write', input: { file_path: join(root, 'spec.md'), content: '# Spec\nDetails.' } },
              { type: 'tool_use', id: 'tu-2', name: 'Agent', input: { description: 'Verifier', prompt: 'Check spec.md' } },
            ],
          },
        },
        {
          type: 'user',
          timestamp: isoAt(15),
          cwd: root,
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'tu-1', content: 'Wrote spec.md' },
              { type: 'tool_result', tool_use_id: 'tu-2', content: 'Async agent launched successfully' },
            ],
          },
        },
        {
          type: 'user',
          timestamp: isoAt(20),
          cwd: root,
          message: {
            role: 'user',
            content: '<agent-message from="Verifier">\nThe report follows:\nVerified spec.md structure and confirmed all invariants pass with zero errors.\n</agent-message>',
          },
        },
        {
          type: 'assistant',
          timestamp: isoAt(25),
          cwd: root,
          message: {
            id: 'msg-2',
            model: 'claude-opus-4-6',
            usage: { input_tokens: 15000, cache_read_input_tokens: 870000, output_tokens: 300 },
            content: [{ type: 'text', text: 'Spec verified.' }],
          },
        },
        {
          type: 'user',
          timestamp: isoAt(30),
          cwd: root,
          message: { role: 'user', content: 'Compact and continue' },
        },
        {
          type: 'system',
          subtype: 'compact_boundary',
          timestamp: isoAt(35),
          compactMetadata: { trigger: 'auto', preTokens: 885000, postTokens: 32000, cumulativeDroppedTokens: 853000 },
        },
        {
          type: 'user',
          isCompactSummary: true,
          timestamp: isoAt(36),
          message: { role: 'user', content: 'Compaction handoff summary.' },
        },
        {
          type: 'assistant',
          timestamp: isoAt(40),
          cwd: root,
          message: {
            id: 'msg-3',
            model: 'claude-opus-4-6',
            usage: { input_tokens: 32000, output_tokens: 200 },
            content: [{ type: 'text', text: 'Continued cleanly.' }],
          },
        },
      ])
      return { input: file }
    },
  },

  antigravity: {
    expectedTool: 'antigravity-app',
    aliases: ['antigravity-app', 'antigravity-cli'],
    capabilities: {
      initialContext: true,
      contextTokens: true,
      compaction: true,
      subagents: true,
      markdownDocs: true,
      media: true,
      memoryRedaction: true,
    },
    unsupportedReasons: {},
    skipReason: !process.getBuiltinModule?.('node:sqlite') ? 'node:sqlite required to construct Antigravity DB fixture' : undefined,
    async fixture(root) {
      const { default: protobuf } = await import('protobufjs')
      const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
      const generation = protobuf
        .loadSync(fileURLToPath(new URL('../src/antigravity-context.proto', import.meta.url)))
        .lookupType('CortexStepGeneratorMetadata')

      const home = join(root, 'home')
      const convId = 'conform-agy-session'
      const store = join(home, '.gemini', 'antigravity', 'brain', convId)
      const file = join(store, '.system_generated', 'logs', 'transcript_full.jsonl')
      const img = await tinyPng(join(store, 'frame.png'))
      mkdirSync(join(home, '.gemini', 'antigravity', 'conversations'), { recursive: true })
      const db = new DatabaseSync(join(home, '.gemini', 'antigravity', 'conversations', `${convId}.db`))
      db.exec('CREATE TABLE gen_metadata(idx INTEGER PRIMARY KEY, data BLOB)')
      const insert = db.prepare('INSERT INTO gen_metadata VALUES (?,?)')
      // Simulate real Antigravity DB pruning on idx=0, keeping full baseline on latest row.
      insert.run(0, generation.encode({
        stepIndices: [1],
        chatModel: { chatStartMetadata: { contextWindowMetadata: { maxContextTokens: 100000 } } },
      }).finish())
      insert.run(3, generation.encode({
        stepIndices: [9],
        chatModel: {
          promptSections: [
            { title: 'identity', content: 'You are Antigravity.', tokenType: 1 },
            { title: 'user_rules', content: `Rules: ${MEMORY_SENTINEL}`, tokenType: 3 },
            { title: 'skills', content: 'Available skills:\n- encore (/a/encore/SKILL.md): Replay sessions\n- slidev (/a/slidev/SKILL.md): Build decks', tokenType: 5 },
          ],
          tools: [{ name: 'read_file', description: 'Read file', jsonSchemaString: '{"type":"object"}' }],
          chatStartMetadata: {
            contextWindowMetadata: {
              maxContextTokens: 100000,
              tokenBreakdown: {
                totalTokens: 12000,
                groups: [
                  { name: 'System Prompt', type: 1, source: 1, numTokens: 3000, children: [{ name: 'identity', numTokens: 3000 }] },
                  { name: 'Tools', type: 2, source: 1, numTokens: 4000, children: [{ name: 'read_file', numTokens: 4000 }] },
                  { name: 'Rules', type: 3, source: 1, numTokens: 1000, children: [{ name: 'user_rules', numTokens: 1000 }] },
                  { name: 'Skills', type: 5, source: 1, numTokens: 2000, children: [{ name: 'skills', numTokens: 2000 }] },
                  { name: 'Chat Messages', type: 7, source: 0, numTokens: 2000 },
                ],
              },
            },
          },
        },
      }).finish())
      db.close()

      const subUuid = 'b8533277-34b9-4e68-89bc-f15d5cfa5d07'
      const step = (step_index, type, fields) => ({
        step_index,
        created_at: isoAt(step_index * 5),
        type,
        source: type === 'USER_INPUT' ? 'USER_EXPLICIT' : 'MODEL',
        status: 'DONE',
        ...fields,
      })
      writeJsonl(file, [
        step(0, 'USER_INPUT', {
          content: `<USER_REQUEST>Plan refactor near ${FAKE_HOME_PATH} (${FAKE_SECRET})</USER_REQUEST>`,
          media: [{ mime_type: 'image/png', uri: pathToFileURL(img.file).href }],
        }),
        step(1, 'PLANNER_RESPONSE', {
          model: 'gemini-4',
          input_tokens: 15000,
          cache_read_tokens: 75000,
          output_tokens: 300,
          tool_calls: [
            { name: 'mcp_ide-tools_exit_plan_mode', args: { plan: '# Refactor Plan\nKeep interfaces narrow.' } },
            { name: 'invoke_subagent', args: { TypeName: 'browser', Role: 'UI Verifier', Prompt: 'Check page' } },
          ],
        }),
        step(2, 'GENERIC', { content: 'plan approved' }),
        step(3, 'GENERIC', { content: `Created the following subagent:\n{"conversationId":"${subUuid}"}` }),
        step(4, 'SYSTEM_MESSAGE', {
          source: 'SYSTEM',
          content: `The following is a <SYSTEM_MESSAGE> not actually sent by the user.\n\n<SYSTEM_MESSAGE>\n[Message] timestamp=${isoAt(20)} sender=${subUuid} priority=MESSAGE_PRIORITY_HIGH content=COMPLETED / TASK_COMPLETED\n\nVerified rendered layout cleanly with zero console errors or clipping.\n</SYSTEM_MESSAGE>`,
        }),
        step(5, 'ERROR_MESSAGE', {
          source: 'SYSTEM',
          error: 'API error (attempt 1): request failed: Post "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent": EOF',
        }),
        step(6, 'PLANNER_RESPONSE', { model: 'gemini-4', input_tokens: 92000, output_tokens: 200, content: 'Plan verified.' }),
        step(7, 'USER_INPUT', { content: '<USER_REQUEST>Proceed to compaction</USER_REQUEST>' }),
        step(8, 'CHECKPOINT', { source: 'SYSTEM', content: '<summary>Checkpoint summary.</summary>' }),
        step(9, 'PLANNER_RESPONSE', { model: 'gemini-4', input_tokens: 18000, output_tokens: 150, content: 'Resumed after checkpoint.' }),
      ])
      return { input: file, home }
    },
  },

  workbuddy: {
    expectedTool: 'workbuddy',
    aliases: [],
    capabilities: {
      initialContext: false,
      contextTokens: false,
      compaction: false,
      subagents: false,
      markdownDocs: true,
      media: true,
      memoryRedaction: false,
    },
    unsupportedReasons: {
      initialContext: 'WorkBuddy JSONL omits mounted system prompts and tool schemas',
      contextTokens: 'WorkBuddy rawUsage tracks aggregate counts without window capacity',
      compaction: 'WorkBuddy JSONL does not record compaction boundaries',
      subagents: 'WorkBuddy JSONL does not record sub-agent handoffs',
      memoryRedaction: 'WorkBuddy JSONL does not inline personal memory blocks',
    },
    async fixture(root) {
      const img = await tinyPng(join(root, 'wb-img.png'))
      const file = join(root, 'workbuddy.jsonl')
      writeJsonl(file, [
        { type: 'ai-title', timestamp: isoAt(0), aiTitle: 'WorkBuddy Conformance' },
        {
          type: 'message',
          role: 'user',
          timestamp: isoAt(5),
          cwd: root,
          content: [{ type: 'input_text', text: `<user_query>Draft brief for ${FAKE_HOME_PATH} (${FAKE_SECRET})</user_query>` }],
        },
        {
          type: 'function_call',
          timestamp: isoAt(10),
          callId: 'wb-1',
          name: 'write_file',
          arguments: JSON.stringify({ path: join(root, 'brief.md'), content: '# Project Brief\nOverview.' }),
        },
        {
          type: 'function_call_result',
          timestamp: isoAt(12),
          callId: 'wb-1',
          cwd: root,
          output: [
            { type: 'text', text: 'Saved brief.md' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img.base64 } },
          ],
        },
        {
          type: 'message',
          role: 'assistant',
          timestamp: isoAt(15),
          cwd: root,
          providerData: { model: 'workbuddy-pro', messageId: 'm1', rawUsage: { total_tokens: 1200 } },
          content: [{ type: 'output_text', text: 'Saved brief.md with preview.' }],
        },
      ])
      return { input: file }
    },
  },

  'claude-ai': {
    expectedTool: 'claude-ai',
    aliases: [],
    capabilities: {
      initialContext: false,
      contextTokens: false,
      compaction: false,
      subagents: false,
      markdownDocs: false,
      media: false,
      memoryRedaction: false,
    },
    unsupportedReasons: {
      initialContext: 'Claude.ai web exports omit system prompts and tool definitions',
      contextTokens: 'Claude.ai web exports omit token counts and context limits',
      compaction: 'Claude.ai web exports contain no compaction events',
      subagents: 'Claude.ai web exports contain no sub-agent delegation events',
      markdownDocs: 'Claude.ai web exports have no local workspace file-write tools',
      media: 'Claude.ai web JSON stores attachment names only, not binary image payloads',
      memoryRedaction: 'Claude.ai web exports contain no injected memory summary blocks',
    },
    async fixture(root) {
      const file = join(root, 'conversations.json')
      writeFileSync(file, JSON.stringify([{
        uuid: 'conv-1',
        name: 'Claude Web Conformance',
        chat_messages: [
          {
            uuid: 'm1',
            sender: 'human',
            created_at: isoAt(5),
            content: [{ type: 'text', text: `Summarize ${FAKE_HOME_PATH} without exposing ${FAKE_SECRET}` }],
          },
          {
            uuid: 'm2',
            parent_message_uuid: 'm1',
            sender: 'assistant',
            created_at: isoAt(10),
            content: [
              { type: 'thinking', thinking: 'Checking key points.' },
              { type: 'text', text: 'Summary ready.' },
            ],
          },
        ],
      }], null, 2))
      return { input: file }
    },
  },
}

function assertSessionSchema(session) {
  assert.ok(SESSION_SCHEMA.properties.tool.enum.includes(session.tool), `tool "${session.tool}" must be in session.schema.json enum`)
  assert.equal(typeof session.title, 'string')
  assert.ok(session.title.trim().length > 0, 'session.title must be non-empty')
  assert.ok(Array.isArray(session.items) && session.items.length > 0, 'session.items must be a non-empty array')
  for (const field of ['started', 'ended']) {
    if (session[field] !== undefined) {
      assert.ok(Number.isFinite(Date.parse(session[field])), `${field} must be valid ISO date-time`)
    }
  }
  const allowedItemTypes = new Set(['user', 'assistant', 'reasoning', 'tool', 'compact'])
  for (const item of session.items) {
    assert.ok(allowedItemTypes.has(item.type), `unexpected item.type: ${item.type}`)
  }
  if (session.initialContext) {
    const allowedCtxKeys = new Set(Object.keys(SESSION_SCHEMA.properties.initialContext.properties))
    for (const key of Object.keys(session.initialContext)) {
      assert.ok(allowedCtxKeys.has(key), `unexpected initialContext key: ${key}`)
    }
  }
}

test('every tool in src/common.mjs and schema/session.schema.json is registered in ADAPTER_CONTRACT', () => {
  const toolKeys = Object.keys(tools).sort()
  const schemaEnum = [...SESSION_SCHEMA.properties.tool.enum].sort()
  assert.deepEqual(toolKeys, schemaEnum, 'src/common.mjs tools and schema/session.schema.json tool enum must stay in sync')

  const covered = new Set()
  for (const [adapter, spec] of Object.entries(ADAPTER_CONTRACT)) {
    covered.add(adapter)
    for (const alias of spec.aliases || []) covered.add(alias)
    for (const cap of CAPABILITIES) {
      assert.equal(typeof spec.capabilities[cap], 'boolean', `${adapter}.capabilities.${cap} must be boolean`)
      if (!spec.capabilities[cap]) {
        assert.ok(spec.unsupportedReasons?.[cap]?.trim(), `${adapter} must explain why capabilities.${cap} is false`)
      }
    }
  }
  for (const tool of toolKeys) {
    assert.ok(covered.has(tool), `tool "${tool}" must be registered in ADAPTER_CONTRACT (add its capabilities and fixture)`)
  }
})

test('README.md and README.zh-CN.md capability matrices match ADAPTER_CONTRACT', () => {
  const blockPattern = /<!-- adapter-matrix:start -->\r?\n([\s\S]*?)\r?\n<!-- adapter-matrix:end -->/
  for (const [lang, path, fileName] of [
    ['en', README_EN_PATH, 'README.md'],
    ['zh', README_ZH_PATH, 'README.zh-CN.md'],
  ]) {
    const content = readFileSync(path, 'utf8')
    const match = content.match(blockPattern)
    assert.ok(match, `${fileName} must contain <!-- adapter-matrix:start --> ... <!-- adapter-matrix:end --> block`)
    assert.equal(
      match[1].replace(/\r\n/g, '\n').trim(),
      renderCapabilityMatrix(lang),
      `${fileName} capability matrix is out of sync with ADAPTER_CONTRACT`
    )
  }
})

for (const [adapter, spec] of Object.entries(ADAPTER_CONTRACT)) {
  test(`adapter conformance: ${adapter}`, { skip: spec.skipReason }, async t => {
    const root = sandbox(t)
    const { input, home } = await spec.fixture(root)
    const homeEnv = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
    const prevHome = process.env[homeEnv]
    if (home) {
      process.env[homeEnv] = home
      t.after(() => {
        if (prevHome === undefined) delete process.env[homeEnv]
        else process.env[homeEnv] = prevHome
      })
    }

    const outDir = join(root, 'replay')
    const replay = await buildReplay(input, { outDir })
    const { session } = replay

    // Universal invariants
    assert.equal(session.tool, spec.expectedTool)
    assertSessionSchema(session)
    assert.deepEqual(findLeaks(session), [], `${adapter} export must have zero privacy leaks`)
    assert.doesNotMatch(JSON.stringify(session), new RegExp(FAKE_SECRET), `${adapter} must redact API keys`)
    assert.doesNotMatch(JSON.stringify(session), /\/Users\/private-tester\//, `${adapter} must redact home paths`)

    const zhLine = timeline(session, { lang: 'zh' })
    const enLine = timeline(session, { lang: 'en' })
    const zhHtml = renderPlayerWidget(session, zhLine, { lang: 'zh' })
    const enHtml = renderPlayerWidget(session, enLine, { lang: 'en' })
    for (const [lang, html] of [['zh', zhHtml], ['en', enHtml]]) {
      assert.doesNotMatch(html, /\bNaN\b|null%|\bundefined\b/, `${adapter} (${lang}) HTML must not contain NaN/null%/undefined`)
      assert.match(html, /data-tl-range/, `${adapter} (${lang}) HTML must include timeline slider`)
      assert.match(html, /data-context-browser/, `${adapter} (${lang}) HTML must include context inspector`)
    }

    // Once real contextTokens are recorded, subsequent user prompts must not flicker back to null.
    let sawMeasured = false
    for (const step of zhLine.steps) {
      if (step.compactInfo) {
        sawMeasured = step.contextSnapshot.totalTokens != null
        continue
      }
      if (step.kind === 'prompt' && sawMeasured) {
        assert.notEqual(step.contextSnapshot.totalTokens, null, `${adapter} user turn must not flicker totalTokens back to null`)
      }
      if (step.contextSnapshot.totalTokens != null && step.kind !== 'prompt') sawMeasured = true
      if (session.contextWindow && step.contextSnapshot.windowTokens && step.contextSnapshot.totalTokens != null) {
        const trueRatio = step.contextSnapshot.totalTokens / step.contextSnapshot.windowTokens
        if (trueRatio > 0.85 && session.tool.startsWith('antigravity')) {
          assert.ok(step.contextSnapshot.pct > 85, `${adapter} must not cap >85% usage at 80%`)
        }
      }
    }

    // Declared capability invariants
    if (spec.capabilities.initialContext) {
      assert.ok(session.initialContext?.sys?.length > 0, `${adapter} must capture initialContext.sys`)
      assert.ok(session.initialContext?.schema?.length > 0, `${adapter} must capture initialContext.schema`)
      if (adapter !== 'codex') {
        assert.doesNotMatch(JSON.stringify(zhLine.initialSnapshot), /Codex System/, `${adapter} must not fall back to Codex default prompts`)
      }
    }

    if (spec.capabilities.contextTokens) {
      const coloredStep = zhLine.steps.find(step => Object.values(step.contextSnapshot.segments || {}).filter(w => w > 0).length >= 2)
      assert.ok(coloredStep, `${adapter} must render multi-segment 7-color context bars`)
      assert.ok(Object.values(coloredStep.contextSnapshot.tokensByKind || {}).every(v => v != null), `${adapter} must populate 7-category token breakdown`)
      assert.doesNotMatch(zhHtml, /data-lc-legend hidden/, `${adapter} must display 7-chip legend when context tokens exist`)
    }

    if (spec.capabilities.compaction) {
      const cp = zhLine.steps.find(step => step.compactInfo)
      assert.ok(cp, `${adapter} must emit a compaction step`)
      assert.ok(cp.compactInfo.preTokens > cp.compactInfo.postTokens, `${adapter} compaction must report preTokens > postTokens`)
      assert.equal(cp.compactInfo.droppedTokens, cp.compactInfo.preTokens - cp.compactInfo.postTokens)
      assert.ok(cp.compactInfo.archivedTools >= 1, `${adapter} compaction must report archivedTools`)
      assert.equal(cp.contextSnapshot.categories.find(c => c.id === 'tool').itemCount, 0, `${adapter} compaction must archive toolRecords to 0`)
      assert.match(zhHtml, /session-compact-card/)
    }

    if (spec.capabilities.subagents) {
      const allSubs = zhLine.steps.flatMap(step => step.subagents || [])
      assert.ok(allSubs.some(s => s.state === 'sent'), `${adapter} must surface sub-agent dispatch pills`)
      assert.ok(allSubs.some(s => s.state === 'done' && s.report), `${adapter} must pair sub-agent completion reports`)
      assert.match(zhHtml, /session-subagent-pill is-clickable/)
    }

    if (spec.capabilities.markdownDocs) {
      const allDocs = zhLine.steps.flatMap(step => step.docs || [])
      assert.ok(allDocs.some(d => d.title && d.content), `${adapter} must extract inline Markdown doc cards`)
      assert.match(zhHtml, /session-doc-card/)
    }

    if (spec.capabilities.media) {
      assert.ok(session.frames?.length >= 1, `${adapter} must extract at least one WebP frame`)
      for (const frame of session.frames) {
        assert.match(frame.img, /\.webp$/)
        assert.ok(existsSync(join(replay.dir, frame.img)), `${adapter} frame file ${frame.img} must exist in replay dir`)
      }
    }

    if (spec.capabilities.memoryRedaction) {
      assert.doesNotMatch(JSON.stringify(session), new RegExp(MEMORY_SENTINEL), `${adapter} must redact personal memory by default`)
      const withMemory = await buildReplay(input, { outDir: join(root, 'replay-mem'), includeMemory: true })
      assert.match(JSON.stringify(withMemory.session), new RegExp(MEMORY_SENTINEL), `${adapter} must preserve personal memory when includeMemory: true`)
    }
  })
}
