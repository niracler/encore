import { readAntigravityDatabase, readAntigravityContext } from './antigravity-context.mjs'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createTranscript, describeTool } from './common.mjs'
import { fileReferences, within } from './external-files.mjs'

export const antigravityStores = () => ({
  'antigravity-app': join(homedir(), '.gemini', 'antigravity', 'brain'),
  'antigravity-cli': join(homedir(), '.gemini', 'antigravity-cli', 'brain'),
})

export function nativeAntigravityLog(file) {
  const path = realpathSync.native(file)
  for (const [tool, store] of Object.entries(antigravityStores())) {
    if (!existsSync(store)) continue
    const root = realpathSync.native(store)
    const [id, system, logs, name, ...rest] = relative(root, path).split(sep)
    if (id !== '..' && system === '.system_generated' && logs === 'logs' &&
        /^transcript(?:_full)?\.jsonl$/.test(name) && !rest.length) {
      return { tool, root: join(root, id), id }
    }
  }
}

// Newer installations index conversation titles, activity, workspaces and App archives in SQLite.
export function antigravitySummaries(root) {
  const path = join(dirname(root), 'conversation_summaries.db')
  return readAntigravityDatabase(path, query => {
    const summaries = query('SELECT conversation_id, title, last_modified_time, workspace_uris FROM conversation_summaries')
    const hasSearch = query("SELECT 1 FROM sqlite_master WHERE name = 'conversations_fts'").length
    const archived = new Set(hasSearch ? query("SELECT DISTINCT conversation_id FROM conversations_fts WHERE archived IN (1, '1')").map(r => r.conversation_id) : [])
    return new Map(summaries.map(row => {
      const uris = JSON.parse(row.workspace_uris || '[]') || []
      const workspaces = uris.filter(uri => typeof uri === 'string' && uri.startsWith('file:///')).map(uri => fileURLToPath(uri))
      return [row.conversation_id, { title: row.title, workspaces, archived: archived.has(row.conversation_id),
        updated: Date.parse(row.last_modified_time.replace(' ', 'T')) }]
    }))
  }) || new Map()
}

export function antigravityTitle(root, id) {
  const path = join(dirname(root), 'annotations', id + '.pbtxt')
  if (!existsSync(path)) return ''
  const literal = readFileSync(path, 'utf8').match(/^title:\s*("(?:[^"\\]|\\.)*")/m)?.[1]
  if (!literal) return ''
  try { return JSON.parse(literal) } catch { return '' } // Unrecognized protobuf escape: use the first prompt.
}

export function antigravityPrompt(content = '') {
  const request = content.match(/<USER_REQUEST>([\s\S]*?)(?:<\/USER_REQUEST>|$)/)?.[1] ?? content
  return request.replace(/<external_system_instructions>[\s\S]*?(?:<\/external_system_instructions>|$)/g, '').trim()
}

export function isAntigravityRecord(rec) {
  return Number.isInteger(rec?.step_index) && typeof rec.created_at === 'string' &&
    typeof rec.source === 'string' && typeof rec.type === 'string'
}

async function loadMedia(media, logDir, roots, userSelected = false) {
  const images = []
  for (const { uri, mime_type: mime } of media || []) {
    if (!mime?.startsWith('image/')) continue
    const path = fileReferences([uri], logDir)[0]?.source?.path
    if (!path) continue
    try {
      const actual = await realpath(path)
      if ((userSelected || roots.some(root => within(actual, root))) && (await stat(actual)).isFile()) {
        images.push({ mime, base64: (await readFile(actual)).toString('base64') })
      }
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP'].includes(error.code)) throw error
    }
  }
  return images
}

function reviewedFiles(name, args, cwd) {
  if (name === 'notify_user' && Array.isArray(args.PathsToReview)) return fileReferences(args.PathsToReview, cwd)
  if (name === 'exit_plan_mode' && typeof args.plan === 'string' && args.plan.trim()) {
    const plan = args.plan.trim()
    if (/^(?:file:\/\/|\/|[A-Z]:[\\/])[^\n]*\.md$/i.test(plan)) return fileReferences([plan], cwd)
  }
  return []
}

function parseSubagentReply(content = '', subagents = new Map()) {
  const match = String(content).match(/\[Message\][^\n]*?\bsender=([^\s\]]+)[^\n]*?\bcontent=([\s\S]*?)(?:\s*<\/SYSTEM_MESSAGE>\s*)?$/)
  if (!match) return null
  const [, sender, rawReport] = match
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sender)
  const agent = subagents.get(sender) || (isUuid ? `Subagent ${sender.slice(0, 8)}` : '')
  if (!agent) return null
  const report = rawReport.replace(/^(?:COMPLETED\s*\/\s*TASK_COMPLETED|TASK_COMPLETED|COMPLETED)\s*\n+/i, '').trim()
  return report ? { agent, report } : null
}

const TRANSIENT_ERROR_RE = /^(?:API error \(attempt \d+\):|The stream was interrupted\.)/i
const IGNORED_UI_TOOLS = new Set(['update_focus', 'update_steps'])

function hasSubsequentRecovery(records, index) {
  for (let i = index + 1; i < records.length; i++) {
    const next = records[i]
    if (next.type === 'USER_INPUT') return false
    if (next.type === 'PLANNER_RESPONSE' && !next.error && (next.content || next.thinking || next.tool_calls?.length)) {
      return true
    }
  }
  return false
}

export async function readAntigravity(records, { file, tool, native, images, assetRoots, includeMemory }) {
  const transcript = createTranscript()
  const metadata = readAntigravityContext(native, records, includeMemory)
  const logDir = dirname(file)
  const defaults = [process.cwd(), ...(native?.workspaces || []).filter(dir => existsSync(dir))]
  const roots = await Promise.all((assetRoots?.length ? assetRoots : defaults).map(dir => realpath(resolve(dir))))
  const cwd = native?.workspaces?.[0] || native?.root
  // Native recordings own their media directory. A detached log only gets the caller's asset roots.
  if (native) roots.push(await realpath(native.root))
  const userSelected = Boolean(native?.workspaces?.length && !assetRoots)
  let pending = []
  let deferredUsage = null
  const pendingSubagents = new Map()
  const subagents = new Map()
  let model
  let tokens = 0
  for (let idx = 0; idx < records.length; idx++) {
    const record = records[idx]
    const { type, created_at: time, content = '', step_index: step } = record
    if (type === 'USER_INPUT') {
      pending = []
      const before = transcript.items.length
      transcript.user(antigravityPrompt(content), time, {
        images: images ? await loadMedia(record.media, logDir, roots, userSelected) : [],
        cwd,
        captureLinks: false,
        ...(deferredUsage || {}),
      })
      if (transcript.items.length > before) deferredUsage = null
    } else if (type === 'PLANNER_RESPONSE') {
      pending = []
      model = record.model || model
      const usage = {}
      if (Number.isInteger(record.input_tokens) || Number.isInteger(record.cache_read_tokens)) {
        usage.contextTokens = (record.input_tokens || 0) + (record.cache_read_tokens || 0)
      }
      const estimates = metadata?.breakdowns.get(step)
      if (estimates) usage.contextTokenEstimates = estimates
      if (metadata?.variableWindows) usage.contextWindow = metadata.windows.get(step) || 0
      tokens += (usage.contextTokens || 0) + (record.output_tokens || 0)
      const effectiveUsage = deferredUsage ? { ...deferredUsage, ...usage } : usage
      const before = transcript.items.length
      transcript.reasoning(record.thinking, time, effectiveUsage)
      transcript.assistant(content, time, { cwd, captureLinks: false, ...effectiveUsage })
      for (const [i, call] of (record.tool_calls || []).entries()) {
        const id = step + '/' + i
        const args = call.args || {}
        const name = call.name || 'tool'
        const base = name.replace(/^mcp_ide-tools_/, '')
        if (IGNORED_UI_TOOLS.has(base)) {
          pending.push(null)
          continue
        }
        const inlinePlan = base === 'exit_plan_mode' && typeof args.plan === 'string' && args.plan.trim()
          && !/^(?:file:\/\/|\/|[A-Z]:[\\/])[^\n]*\.md$/i.test(args.plan.trim())
          ? args.plan.trim()
          : undefined
        const recipientRole = base === 'send_message' && typeof args.Recipient === 'string'
          ? subagents.get(args.Recipient)
          : undefined
        const details = describeTool(base, {
          ...args,
          ...(args.CommandLine && { command: args.CommandLine }),
          ...(args.Path && { path: args.Path }),
          ...(args.Content !== undefined && { content: args.Content }),
          ...(args.Role ? { description: args.Role } : args.TypeName ? { description: args.TypeName } : {}),
          ...(args.Prompt && { prompt: args.Prompt }),
          ...(args.Message && { message: args.Message }),
        })
        if (inlinePlan) {
          details.input = inlinePlan
          details.file = 'implementation_plan.md'
        }
        if (recipientRole) {
          details.summary = `给子任务发消息：${recipientRole}`
          if (args.Message) details.input = args.Message
        }
        const item = transcript.tool(id, { ...details, name, ...effectiveUsage }, time)
        if (base === 'invoke_subagent') {
          pendingSubagents.set(id, args.Role || args.TypeName || item.agent || 'Subagent')
        }
        const files = reviewedFiles(base, args, cwd)
        if (files.length) item.deliverables = files
        pending.push(id)
      }
      if (transcript.items.length > before) {
        deferredUsage = null
      } else if (Object.keys(effectiveUsage).length) {
        deferredUsage = effectiveUsage
      }
    } else if (type === 'GENERIC') {
      // Each batch's result steps follow its tool calls in trajectory order.
      const id = pending.shift()
      if (id === null) continue
      const output = content.replace(/^(?:(?:Created At|Completed At):[^\n]*(?:\n|$))+/u, '').trim()
      const done = content.match(/^Completed At:\s*([^\r\n]+)/m)?.[1] || time
      if (id !== undefined) {
        if (pendingSubagents.has(id)) {
          const convId = output.match(/"conversationId"\s*:\s*"([^"]+)"/)?.[1]
          if (convId) subagents.set(convId, pendingSubagents.get(id))
          pendingSubagents.delete(id)
        }
        transcript.result(id, [output, record.error].filter(Boolean).join('\n'), done,
          images ? await loadMedia(record.media, logDir, roots) : [], cwd)
      }
    } else if (type === 'SYSTEM_MESSAGE') {
      const subagentReply = parseSubagentReply(content, subagents)
      if (subagentReply) {
        transcript.tool(null, {
          name: 'agent-message',
          kind: 'reply',
          summary: `子任务交回结果：${subagentReply.agent}`,
          output: subagentReply.report,
          stats: { reply: 1 },
          agent: subagentReply.agent,
          ...(deferredUsage || {}),
        }, time)
        deferredUsage = null
      }
    } else if (type === 'CHECKPOINT' && record.status === 'DONE' && !record.error) {
      const summary = content.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1]?.trim()
      const text = summary && !includeMemory
        ? summary.replace(/<external_system_instructions>[\s\S]*?(?:<\/external_system_instructions>|$)|========= MEMORY_SUMMARY BEGINS =========[\s\S]*?(?:========= MEMORY_SUMMARY ENDS =========|$)/gi, '[Private context omitted]')
        : summary
      transcript.compact({
        ...(text && { text }),
        ...(deferredUsage?.contextTokens > 0 && { preTokens: deferredUsage.contextTokens }),
        ...(deferredUsage?.contextWindow != null && { contextWindow: deferredUsage.contextWindow }),
      }, time)
      deferredUsage = null
    } else if (type === 'ERROR_MESSAGE') {
      const text = String(record.error || content || '').trim()
      if (text && !(TRANSIENT_ERROR_RE.test(text) && hasSubsequentRecovery(records, idx))) {
        transcript.assistant(text, time, { cwd, captureLinks: false, ...(deferredUsage || {}) })
        deferredUsage = null
      }
    }
  }
  if (deferredUsage && transcript.items.length) {
    Object.assign(transcript.items.at(-1), deferredUsage)
  }
  return transcript.finish({ tool, model, tokens: tokens || undefined,
    contextWindow: metadata?.contextWindow, initialContext: metadata?.initialContext,
    title: native?.title || (native && antigravityTitle(dirname(native.root), native.id)) })
}
