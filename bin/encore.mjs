#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { on } from 'node:events'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import readline from 'node:readline'
import { iterateRecentSessions } from '../src/detect.mjs'
import {
  buildReplay,
  rebuildReplayDir,
  scanRecentSessions,
  serveReplayDir,
} from '../src/index.mjs'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

const HELP = `
encore (@niracler/encore) — Replay an AI Agent session to see how it worked and what it delivered.

Usage:
  encore                              Scan recent Codex, Claude Code & WorkBuddy sessions and pick one interactively
  encore <log.jsonl | dir> [options]  Build a replay from a raw log, or rebuild an existing replay directory
  encore play <dir> [--port 4180]     Start local preview server for an existing replay directory

Options:
  -o, --out <dir>          Output directory (default: temporary directory)
      --asset-root <dir>   Set allowed asset roots for attachments and deliverables (repeatable; defaults to cwd and native session workspace)
  -l, --lang <zh|en|auto>  Player UI language (default: auto)
      --title <text>       Override session title
      --desc <text>        Set opening description shown before playback starts
      --from <iso-time>    Start time window filter (e.g. 2026-11-10T09:00)
      --to <iso-time>      End time window filter
      --no-images          Skip extracting embedded images to .webp
      --image-width <px>   Max width for extracted WebP frames (default: 960)
      --clip <chars>       Max chars per tool input/output (default: 1500/2000)
      --conversation <id>  Conversation UUID for multi-chat Claude.ai exports
      --include-memory     Include full cross-session MEMORY_SUMMARY / User CLAUDE.md text
      --list               List recent local sessions without interactive prompt
      --serve              Start local HTTP preview server after building
      --no-serve           Do not start local HTTP preview server
      --no-open            Do not automatically open browser when serving
  -p, --port <number>      Preview server port (default: 4180)
  -v, --version            Show version number
  -h, --help               Show this help message
`.trim()

function printBuildReport(result, { isTempDefault = false } = {}) {
  const { mode, toolLabel, dir, sessionFile, session, leaks } = result
  const shownDir = displayPath(dir)
  const shownSession = displayPath(sessionFile)
  const count = type => (session.items || []).filter(item => item.type === type).length
  const framesCount = (session.frames || []).length
  const action = mode === 'rebuild' ? 'Rebuilt' : 'Built'

  console.log(`\n✨ ${action} replay in ${shownDir.endsWith(sep) ? shownDir : `${shownDir}${sep}`}`)
  console.log(`   Title   : ${session.title}`)
  console.log(`   Agent   : ${toolLabel}${session.model ? ` · ${session.model}` : ''}`)
  console.log(`   Events  : ${count('user')} user messages · ${count('assistant')} replies · ${count('tool')} tool calls${count('compact') ? ` · ${count('compact')} compactions` : ''}`)
  if (framesCount) {
    console.log(`   Frames  : ${framesCount} WebP frame(s) in frames[] (edit ${shownSession} to curate or relabel)`)
  }
  console.log(`   Files   : index.html, session.json, encore-player.js, encore-player.css`)
  if (mode === 'import' && isTempDefault) {
    console.log(`   Note    : Saved to a temporary directory. Pass -o <dir> to keep a portable copy.`)
  }

  if (leaks.length) {
    console.log(`\n⚠️  Leak check found ${leaks.length} potential sensitive snippet(s) (non-blocking — review in ${shownSession}):`)
    for (const leak of leaks.slice(0, 12)) {
      console.log(`   - ${leak.path} · ${leak.rule} · ${leak.match}`)
    }
    if (leaks.length > 12) {
      console.log(`   ... and ${leaks.length - 12} more`)
    }
  }
}

function displayPath(targetPath) {
  const rel = relative(process.cwd(), targetPath)
  if (!rel) return '.'
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) ? rel : targetPath
}

function truncateToColumns(str, maxCols) {
  let width = 0
  let out = ''
  for (const ch of String(str)) {
    const code = ch.codePointAt(0)
    const w = code > 0x1f00 ? 2 : 1
    if (width + w > maxCols - 1) return `${out}…`
    out += ch
    width += w
  }
  return out
}

async function pickRecentSessionInteractive() {
  const pageSize = 10
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const sessions = await scanRecentSessions({ limit: pageSize })
    if (!sessions.length) {
      console.log(HELP)
      return null
    }
    console.log('Recent local AI Agent sessions:\n')
    sessions.forEach((s, idx) => {
      console.log(`  [${idx + 1}] ${s.timeLabel} · ${s.toolLabel.padEnd(11)} · ${s.preview}`)
      console.log(`      ${s.file} (${s.sizeKB} KB)`)
    })
    console.log('\nRun: encore <file-path> -o ./my-replay')
    return null
  }

  const history = iterateRecentSessions()
  const sessions = []
  let exhausted = false
  let selected = 0
  let renderedLines = 0

  async function loadPage(start) {
    while (!exhausted && sessions.length <= start + pageSize) {
      const next = await history.next()
      if (next.done) exhausted = true
      else sessions.push(next.value)
    }
  }

  await loadPage(0)
  if (!sessions.length) {
    console.log(HELP)
    return null
  }

  function renderMenu(start) {
    if (renderedLines) {
      readline.moveCursor(process.stdout, 0, -renderedLines)
      readline.clearScreenDown(process.stdout)
    }
    const cols = Math.max(1, (process.stdout.columns || 80) - 2)
    const page = sessions.slice(start, start + pageSize)
    const last = exhausted && start + pageSize >= sessions.length
    const heading = `Page ${start / pageSize + 1}${last ? ' (last)' : ''} · ←/→ page · ↑/↓ move · Enter select · q quit`
    process.stdout.write(`${truncateToColumns(heading, cols)}\n\n`)
    page.forEach((session, index) => {
      const active = start + index === selected
      const prefix = active ? ' ❯ ' : '   '
      const num = String(index + 1).padStart(2, ' ')
      const badge = `[${session.toolLabel}]`.padEnd(13, ' ')
      const line = truncateToColumns(`${prefix}${num}. ${session.timeLabel}  ${badge} ${session.preview} (${session.sizeKB} KB)`, cols)
      process.stdout.write(`${active ? `\x1b[36m\x1b[1m${line}\x1b[0m` : line}\n`)
    })
    process.stdout.write('\n')
    renderedLines = page.length + 3
  }

  readline.emitKeypressEvents(process.stdin)
  const wasRaw = process.stdin.isRaw
  process.stdin.setRawMode(true)
  try {
    let start = 0
    renderMenu(start)
    for await (const [str, key] of on(process.stdin, 'keypress')) {
      if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        return null
      }
      if (key.name === 'return' || key.name === 'enter') return sessions[selected]
      if (key.name === 'left' || key.name === 'pageup') {
        if (!start) continue
        selected = start - pageSize
      } else if (key.name === 'right' || key.name === 'pagedown') {
        if (start + pageSize >= sessions.length) continue
        selected = start + pageSize
      } else if (key.name === 'up' || key.name === 'k') {
        selected = Math.max(0, selected - 1)
      } else if (key.name === 'down' || key.name === 'j') {
        selected = Math.min(sessions.length - 1, selected + 1)
      } else if (/^\d$/.test(str)) {
        const index = start + (Number(str) || pageSize) - 1
        if (index >= sessions.length) continue
        selected = index
      } else {
        continue
      }
      start = Math.floor(selected / pageSize) * pageSize
      await loadPage(start)
      renderMenu(start)
    }
  } finally {
    process.stdin.setRawMode(Boolean(wasRaw))
    process.stdin.pause()
    await history.return()
  }
}

async function main() {
  const rawArgs = process.argv.slice(2)
  const hasNoImages = rawArgs.includes('--no-images')
  const hasNoServe = rawArgs.includes('--no-serve')
  const hasServe = rawArgs.includes('--serve')
  const hasNoOpen = rawArgs.includes('--no-open')
  const hasIncludeMemory = rawArgs.includes('--include-memory')
  const filteredArgs = rawArgs.filter(a => !['--no-images', '--no-serve', '--serve', '--no-open', '--include-memory'].includes(a))

  const { values, positionals } = parseArgs({
    args: filteredArgs,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      'asset-root': { type: 'string', multiple: true },
      lang: { type: 'string', short: 'l' },
      title: { type: 'string' },
      desc: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      'image-width': { type: 'string' },
      clip: { type: 'string' },
      conversation: { type: 'string' },
      list: { type: 'boolean' },
      port: { type: 'string', short: 'p' },
      force: { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.version) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    console.log(pkg.version || '0.1.0')
    return
  }

  if (values.help) {
    console.log(HELP)
    return
  }

  const port = values.port ? Number(values.port) : 4180

  // Subcommand: `encore play <dir>` or `encore preview <dir>`
  if (positionals[0] === 'play' || positionals[0] === 'preview') {
    const targetDir = resolve(positionals[1] || '.')
    const rebuilt = await rebuildReplayDir(targetDir, {
      assetRoots: values['asset-root'],
      lang: values.lang,
      title: values.title,
      description: values.desc,
    })
    printBuildReport(rebuilt)
    const { url } = await serveReplayDir(rebuilt.dir, { port, open: !hasNoOpen })
    console.log(`\n🎬 Replay live at ${url} (Ctrl+C to stop)`)
    console.log(`   Tip: Edit ${displayPath(rebuilt.sessionFile)} and refresh the browser to see changes immediately.`)
    return
  }

  if (values.list) {
    const recent = await scanRecentSessions({ limit: 15 })
    if (!recent.length) {
      console.log('No recent Codex, Claude Code, or WorkBuddy sessions found in ~/.codex/sessions, ~/.claude/projects, or ~/.workbuddy/projects.')
      return
    }
    console.log('Recent local AI Agent sessions:\n')
    recent.forEach((s, idx) => {
      console.log(`  [${String(idx + 1).padStart(2, ' ')}] ${s.timeLabel} · ${s.toolLabel.padEnd(11)} · ${s.preview} (${s.sizeKB} KB)`)
      console.log(`       ${s.file}`)
    })
    return
  }

  let targets = positionals
  if (targets[0] === 'build' || targets[0] === 'import') {
    targets = targets.slice(1)
  }
  let explicitTool
  if (['codex', 'claude-code', 'claude-ai', 'workbuddy'].includes(targets[0]) && targets.length > 1) {
    explicitTool = targets[0]
    targets = targets.slice(1)
  }

  if (!targets.length) {
    const picked = await pickRecentSessionInteractive()
    if (!picked) return
    targets = [picked.file]
    explicitTool = picked.tool
  }

  const result = await buildReplay(targets, {
    assetRoots: values['asset-root'],
    tool: explicitTool,
    outDir: values.out,
    lang: values.lang || 'auto',
    title: values.title,
    description: values.desc,
    from: values.from,
    to: values.to,
    images: !hasNoImages,
    imageWidth: values['image-width'] ? Number(values['image-width']) : 960,
    clip: values.clip ? Number(values.clip) : undefined,
    conversation: values.conversation,
    includeMemory: hasIncludeMemory,
  })

  printBuildReport(result, { isTempDefault: !values.out })

  const shouldServe = hasServe || (!hasNoServe && Boolean(process.stdin.isTTY && process.stdout.isTTY))
  if (shouldServe) {
    const { url } = await serveReplayDir(result.dir, { port, open: !hasNoOpen })
    console.log(`\n🎬 Replay live at ${url} (Ctrl+C to stop)`)
    console.log(`   Tip: Edit ${displayPath(result.sessionFile)} and refresh the browser to see changes immediately.`)
  }
}

main().catch(err => {
  console.error(`\n❌ Encore error: ${err.message || err}`)
  process.exit(1)
})
