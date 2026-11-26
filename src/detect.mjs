import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { antigravityPrompt, antigravityStores, antigravitySummaries, antigravityTitle, isAntigravityRecord, nativeAntigravityLog } from './antigravity.mjs'
import { cleanPrompt } from './codex.mjs'
import { userText } from './claude-code.mjs'
import { lines, textOf, tools } from './common.mjs'
import { workBuddyUserText } from './workbuddy.mjs'

const codexInjected = /^(# AGENTS\.md instructions|<[a-z][\w-]*[\s>]|The following is the Codex agent history)/

export async function detectInput(targetPath) {
  const full = resolve(targetPath)
  if (!existsSync(full)) {
    throw new Error(`Path does not exist: ${targetPath}`)
  }
  const st = statSync(full)
  if (st.isDirectory()) {
    const sessionJson = join(full, 'session.json')
    if (existsSync(sessionJson)) {
      return { kind: 'replay-dir', dir: full, sessionFile: sessionJson }
    }
    throw new Error(`Directory does not contain session.json: ${targetPath}`)
  }

  if (full.endsWith('.json') && !full.endsWith('.jsonl')) {
    const parsed = JSON.parse(readFileSync(full, 'utf8'))
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items) && typeof parsed.tool === 'string') {
      return { kind: 'session-json', dir: dirname(full), sessionFile: full }
    }
    if (Array.isArray(parsed) || (parsed && Array.isArray(parsed.chat_messages))) {
      return { kind: 'raw-log', tool: 'claude-ai', files: [full] }
    }
  }

  const tool = await detectJsonlTool(full)
  return { kind: 'raw-log', tool, files: [full] }
}

export async function detectJsonlTool(filePath) {
  const stream = createReadStream(filePath)
  let count = 0
  for await (const line of lines(stream)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    count++
    if (count === 1 && trimmed.startsWith('[')) {
      return 'claude-ai'
    }
    try {
      const rec = JSON.parse(trimmed)
      if (isAntigravityRecord(rec)) return nativeAntigravityLog(filePath)?.tool || 'antigravity'
      if (rec.type === 'session_meta' || rec.type === 'turn_context' || rec.type === 'response_item' || rec.type === 'event_msg') {
        return 'codex'
      }
      if (
        rec.providerData ||
        rec.type === 'function_call_result' ||
        (rec.type === 'message' && typeof rec.role === 'string' && !rec.payload) ||
        (rec.type === 'function_call' && rec.callId && !rec.payload)
      ) {
        return 'workbuddy'
      }
      if (
        rec.type === 'api-request-shape' ||
        rec.type === 'custom-title' ||
        rec.type === 'summary' ||
        rec.sessionId ||
        rec.claude_code_version ||
        (rec.type === 'user' && rec.message) ||
        (rec.type === 'assistant' && rec.message)
      ) {
        return 'claude-code'
      }
      if (Array.isArray(rec.chat_messages)) {
        return 'claude-ai'
      }
    } catch {
      // Skip malformed records while identifying a log.
    }
    if (count >= 40) break
  }
  return 'codex'
}

function walkFiles(dir, matcher, results = [], maxDepth = 5, depth = 0) {
  if (!existsSync(dir) || depth > maxDepth) return results
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'subagents' || entry.name === 'node_modules') continue
      walkFiles(full, matcher, results, maxDepth, depth + 1)
    } else if (entry.isFile() && matcher(entry.name, full)) {
      try {
        const st = statSync(full)
        if (st.size > 0) {
          results.push({ file: full, mtimeMs: st.mtimeMs, size: st.size })
        }
      } catch {
        // Ignore vanished files
      }
    }
  }
  return results
}

async function summarizeLogFile(file, toolHint, knownTitle) {
  const stream = createReadStream(file)
  let tool = toolHint
  let title = knownTitle || ''
  let firstPrompt = ''
  for await (const line of lines(stream)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let rec
    try {
      rec = JSON.parse(trimmed)
    } catch {
      continue
    }
    if (rec.type === 'session_meta' || rec.type === 'response_item') tool = 'codex'
    if (rec.providerData || rec.type === 'function_call_result') tool = 'workbuddy'
    if (rec.type === 'custom-title' && rec.customTitle) title = rec.customTitle
    if (rec.type === 'ai-title' && rec.aiTitle && !title) title = rec.aiTitle
    if (rec.type === 'summary' && rec.summary && !title) title = rec.summary

    if (!firstPrompt) {
      if (tool.startsWith('antigravity') && rec.type === 'USER_INPUT') {
        firstPrompt = antigravityPrompt(rec.content) || (rec.media?.length ? '[图片]' : '')
      } else if (tool === 'codex' && rec.type === 'response_item' && rec.payload?.type === 'message' && rec.payload?.role === 'user') {
        const raw = textOf(rec.payload.content)
          .replace(/^\s*<([a-z][\w-]*context)\b[^>]*>[\s\S]*?<\/\1>\s*/g, '')
          .trim()
        if (raw && !codexInjected.test(raw) && !raw.startsWith('<send_user_message_question_reply>')) {
          firstPrompt = cleanPrompt(raw)
        }
      } else if (rec.type === 'message' && rec.role === 'user' && !rec.payload) {
        tool = 'workbuddy'
        const txt = workBuddyUserText(rec.content).trim()
        if (txt) firstPrompt = txt
      } else if (rec.type === 'user' && !rec.isMeta && !rec.isCompactSummary && rec.message) {
        tool = 'claude-code'
        const blocks = typeof rec.message.content === 'string'
          ? [{ type: 'text', text: rec.message.content }]
          : (rec.message.content || [])
        const txt = blocks
          .filter(b => b.type === 'text' && !/^\s*<task-notification>/.test(b.text))
          .map(b => userText(b.text))
          .filter(Boolean)
          .join(' ')
          .trim()
        if (txt && txt !== '（中途打断）') firstPrompt = txt
      }
    }
    if (firstPrompt && (tool === 'codex' || tool.startsWith('antigravity'))) break
  }

  const rawPreview = (title || firstPrompt || '').replace(/\s+/g, ' ').trim()
  return {
    tool,
    title, firstPrompt,
    preview: rawPreview ? (rawPreview.length > 58 ? `${rawPreview.slice(0, 57)}…` : rawPreview) : '',
  }
}

function formatLocalTime(ms) {
  const d = new Date(ms)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function antigravityFiles(root, toolHint) {
  if (!existsSync(root)) return []
  const files = []
  const summaries = antigravitySummaries(root)
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const logs = join(root, entry.name, '.system_generated', 'logs')
    for (const name of ['transcript_full.jsonl', 'transcript.jsonl']) {
      const file = join(logs, name)
      const st = statSync(file, { throwIfNoEntry: false })
      if (!st?.isFile() || !st.size) continue
      const summary = summaries.get(entry.name)
      files.push({ file, mtimeMs: summary?.updated || st.mtimeMs, size: st.size, toolHint, id: entry.name, root,
        title: summary?.title, archived: summary?.archived })
      break
    }
  }
  return files
}

function codexTitles(dir) {
  const index = join(dirname(dir), 'session_index.jsonl')
  const titles = new Map()
  if (!existsSync(index)) return titles
  for (const line of readFileSync(index, 'utf8').split('\n')) {
    if (!line) continue
    try {
      const { id, thread_name } = JSON.parse(line)
      if (thread_name) titles.set(id, thread_name)
    } catch { /* A live index can end in an incomplete line. */ }
  }
  return titles
}

export function createSessionCatalog({
  codexDir = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions'),
  claudeDir = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects'),
  workbuddyDir = join(process.env.WORKBUDDY_HOME || join(homedir(), '.workbuddy'), 'projects'),
  antigravityAppDir = antigravityStores()['antigravity-app'],
  antigravityCliDir = antigravityStores()['antigravity-cli'],
} = {}) {
  const rollout = name => name.startsWith('rollout-') && name.endsWith('.jsonl')
  const index = codexTitles(codexDir)
  const codex = (dir, archived) => walkFiles(dir, rollout).map(item => ({
    ...item, toolHint: 'codex', archived,
    title: index.get(basename(item.file, '.jsonl').slice(-36)),
  }))
  const candidates = [
    ...codex(codexDir, false),
    ...codex(join(dirname(codexDir), 'archived_sessions'), true),
    ...walkFiles(claudeDir, name => name.endsWith('.jsonl') && !name.startsWith('agent-')).map(item => ({ ...item, toolHint: 'claude-code' })),
    ...walkFiles(workbuddyDir, name => name.endsWith('.jsonl')).map(item => ({ ...item, toolHint: 'workbuddy' })),
    ...antigravityFiles(antigravityAppDir, 'antigravity-app'),
    ...antigravityFiles(antigravityCliDir, 'antigravity-cli'),
  ].sort((a, b) => b.mtimeMs - a.mtimeMs)
  const summaries = new Map()
  return async function* list({ group, query, signal } = {}) {
    const term = query?.trim().toLowerCase()
    for (const cand of candidates) {
      if (signal?.aborted) return
      if (cand.archived && query === undefined) continue
      if (group && group !== (cand.toolHint.startsWith('antigravity') ? 'antigravity' : cand.toolHint)) continue
      if (!summaries.has(cand.file)) {
        const title = cand.title || (cand.id && antigravityTitle(cand.root, cand.id))
        summaries.set(cand.file, summarizeLogFile(cand.file, cand.toolHint, title))
      }
      let info
      try {
        info = await summaries.get(cand.file)
      } catch (error) {
        if (error.code === 'ENOENT') continue
        throw error
      }
      if (!info.preview || (term && ![info.title, info.firstPrompt].some(s => s.toLowerCase().includes(term)))) continue
      yield {
        tool: info.tool, toolLabel: tools[info.tool] || info.tool, file: cand.file,
        mtimeMs: cand.mtimeMs, timeLabel: formatLocalTime(cand.mtimeMs),
        sizeKB: Math.max(1, Math.round(cand.size / 1024)), preview: info.preview,
        ...(cand.archived && { archived: true }),
      }
    }
  }
}

export async function scanRecentSessions({ limit = 12, ...directories } = {}) {
  const results = []
  if (limit <= 0) return results
  for await (const session of createSessionCatalog(directories)()) {
    results.push(session)
    if (results.length >= limit) break
  }
  return results
}
