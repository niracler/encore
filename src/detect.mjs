import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { cleanPrompt } from './codex.mjs'
import { userText } from './claude-code.mjs'
import { lines, textOf, tools } from './common.mjs'

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
  const stream = createReadStream(filePath, { start: 0, end: 256 * 1024 })
  let count = 0
  for await (const line of lines(stream)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    count++
    if (count === 1 && (trimmed.startsWith('[') || trimmed.includes('"chat_messages"'))) {
      return 'claude-ai'
    }
    try {
      const rec = JSON.parse(trimmed)
      if (rec.type === 'session_meta' || rec.type === 'turn_context' || rec.type === 'response_item' || rec.type === 'event_msg') {
        return 'codex'
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
      // Ignore partial line at slice boundary
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
        if (st.size > 200) {
          results.push({ file: full, mtimeMs: st.mtimeMs, size: st.size })
        }
      } catch {
        // Ignore vanished files
      }
    }
  }
  return results
}

async function summarizeLogFile(file, toolHint) {
  const stream = createReadStream(file, { start: 0, end: 512 * 1024 })
  let tool = toolHint
  let title = ''
  let firstPrompt = ''
  let timestamp = ''
  let lineCount = 0

  for await (const line of lines(stream)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    lineCount++
    let rec
    try {
      rec = JSON.parse(trimmed)
    } catch {
      continue
    }
    if (!timestamp && rec.timestamp) {
      timestamp = typeof rec.timestamp === 'number' ? new Date(rec.timestamp).toISOString() : String(rec.timestamp)
    }
    if (rec.type === 'session_meta' || rec.type === 'response_item') tool = 'codex'
    if (rec.type === 'custom-title' && rec.customTitle) title = rec.customTitle
    if (rec.type === 'ai-title' && rec.aiTitle && !title) title = rec.aiTitle
    if (rec.type === 'summary' && rec.summary && !title) title = rec.summary

    if (!firstPrompt) {
      if (tool === 'codex' && rec.type === 'response_item' && rec.payload?.type === 'message' && rec.payload?.role === 'user') {
        const raw = textOf(rec.payload.content)
          .replace(/^\s*<([a-z][\w-]*context)\b[^>]*>[\s\S]*?<\/\1>\s*/g, '')
          .trim()
        if (raw && !codexInjected.test(raw) && !raw.startsWith('<send_user_message_question_reply>')) {
          firstPrompt = cleanPrompt(raw)
        }
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
    if (title && firstPrompt) break
    if (lineCount > 240 && firstPrompt) break
  }

  const rawPreview = (title || firstPrompt || '').replace(/\[(?:附图|图片|附件：[^\]]+)\]/g, '').replace(/\s+/g, ' ').trim()
  return {
    tool,
    preview: rawPreview ? (rawPreview.length > 58 ? `${rawPreview.slice(0, 57)}…` : rawPreview) : '',
    timestamp,
  }
}

function formatLocalTime(ms) {
  const d = new Date(ms)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function scanRecentSessions({
  limit = 12,
  codexDir = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions'),
  claudeDir = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects'),
} = {}) {
  const codexFiles = walkFiles(codexDir, name => name.startsWith('rollout-') && name.endsWith('.jsonl'))
    .map(item => ({ ...item, toolHint: 'codex' }))
  const claudeFiles = walkFiles(claudeDir, name => name.endsWith('.jsonl') && !name.startsWith('agent-'))
    .map(item => ({ ...item, toolHint: 'claude-code' }))

  const candidates = [...codexFiles, ...claudeFiles]
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit * 3)

  const results = []
  for (const cand of candidates) {
    const info = await summarizeLogFile(cand.file, cand.toolHint)
    if (!info.preview) continue
    results.push({
      tool: info.tool,
      toolLabel: tools[info.tool] || info.tool,
      file: cand.file,
      mtimeMs: cand.mtimeMs,
      timeLabel: formatLocalTime(cand.mtimeMs),
      sizeKB: Math.max(1, Math.round(cand.size / 1024)),
      preview: info.preview,
    })
    if (results.length >= limit) break
  }
  return results
}
