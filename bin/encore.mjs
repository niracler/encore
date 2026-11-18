#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import readline from 'node:readline'
import {
  buildReplay,
  rebuildReplayDir,
  scanRecentSessions,
  serveReplayDir,
} from '../src/index.mjs'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

const HELP = `
encore (@niracler/encore) — Bring your AI agent sessions back on stage.

Usage:
  encore                              Scan recent Codex & Claude Code sessions and pick one interactively
  encore <log.jsonl | dir> [options]  Build a standalone replay directory from a log or re-render an edited session.json
  encore play <dir> [--port 4180]     Start local preview server for an existing replay directory

Options:
  -o, --out <dir>          Output directory (default: ./replays/<session-slug>)
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

function printBuildReport(result) {
  const { mode, toolLabel, dir, sessionFile, session, leaks } = result
  const relDir = relative(process.cwd(), dir) || '.'
  const relSession = relative(process.cwd(), sessionFile) || 'session.json'
  const count = type => (session.items || []).filter(item => item.type === type).length
  const framesCount = (session.frames || []).length
  const action = mode === 'rebuild' ? 'Re-rendered' : 'Generated'

  console.log(`\n✨ ${action} replay in ${relDir}/`)
  console.log(`   Title   : ${session.title}`)
  console.log(`   Agent   : ${toolLabel}${session.model ? ` · ${session.model}` : ''}`)
  console.log(`   Steps   : ${count('user')} prompts · ${count('assistant')} replies · ${count('tool')} tool calls${count('compact') ? ` · ${count('compact')} compactions` : ''}`)
  if (framesCount) {
    console.log(`   Frames  : ${framesCount} WebP image(s) in frames[] (edit ${relSession} to prune or rename labels)`)
  }
  console.log(`   Files   : index.html, session.json, encore-player.js, encore-player.css`)

  if (leaks.length) {
    console.log(`\n⚠️  Privacy check found ${leaks.length} potential sensitive snippet(s) (non-blocking — review in ${relSession}):`)
    for (const leak of leaks.slice(0, 12)) {
      console.log(`   - ${leak.path} · ${leak.rule} · ${leak.match}`)
    }
    if (leaks.length > 12) {
      console.log(`   ... and ${leaks.length - 12} more`)
    }
  }
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

async function pickRecentSessionInteractive(sessions) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('Recent local AI Agent sessions:\n')
    sessions.forEach((s, idx) => {
      console.log(`  [${idx + 1}] ${s.timeLabel} · ${s.toolLabel.padEnd(11)} · ${s.preview}`)
      console.log(`      ${s.file} (${s.sizeKB} KB)`)
    })
    console.log('\nRun: encore <file-path> -o ./replays/my-session')
    return null
  }

  return new Promise(resolvePromise => {
    let selected = 0
    const total = sessions.length

    const renderMenu = (firstRender = false) => {
      if (!firstRender) {
        readline.moveCursor(process.stdout, 0, -(total + 3))
        readline.clearScreenDown(process.stdout)
      }
      const cols = Math.max(40, (process.stdout.columns || 80) - 2)
      process.stdout.write(`${truncateToColumns('🎭 Pick a recent AI Agent session to bring back on stage (↑/↓ to move, Enter to select, q to quit):', cols)}\n\n`)
      sessions.forEach((s, idx) => {
        const active = idx === selected
        const prefix = active ? ' ❯ ' : '   '
        const num = String(idx + 1).padStart(2, ' ')
        const badge = `[${s.toolLabel}]`.padEnd(13, ' ')
        const line = truncateToColumns(`${prefix}${num}. ${s.timeLabel}  ${badge} ${s.preview} (${s.sizeKB} KB)`, cols)
        process.stdout.write(`${active ? `\x1b[36m\x1b[1m${line}\x1b[0m` : line}\n`)
      })
      process.stdout.write('\n')
    }

    renderMenu(true)
    readline.emitKeypressEvents(process.stdin)
    const wasRaw = process.stdin.isRaw
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress)
      if (process.stdin.isTTY) process.stdin.setRawMode(Boolean(wasRaw))
      process.stdin.pause()
    }

    const onKeypress = (str, key) => {
      if (!key) return
      if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup()
        resolvePromise(null)
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        selected = (selected - 1 + total) % total
        renderMenu(false)
      } else if (key.name === 'down' || key.name === 'j') {
        selected = (selected + 1) % total
        renderMenu(false)
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        resolvePromise(sessions[selected])
      } else if (str && /^[1-9]$/.test(str)) {
        const idx = Number(str) - 1
        if (idx < total) {
          selected = idx
          renderMenu(false)
        }
      }
    }

    process.stdin.on('keypress', onKeypress)
  })
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
      lang: values.lang,
      title: values.title,
      description: values.desc,
    })
    printBuildReport(rebuilt)
    const { url } = await serveReplayDir(rebuilt.dir, { port, open: !hasNoOpen })
    console.log(`\n🎬 Encore stage live at ${url} (Ctrl+C to stop)`)
    console.log(`   Tip: Edit ${relative(process.cwd(), rebuilt.sessionFile) || 'session.json'} and refresh the browser to see changes immediately.`)
    return
  }

  if (values.list) {
    const recent = await scanRecentSessions({ limit: 15 })
    if (!recent.length) {
      console.log('No recent Codex or Claude Code sessions found in ~/.codex/sessions or ~/.claude/projects.')
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
  if (['codex', 'claude-code', 'claude-ai'].includes(targets[0]) && targets.length > 1) {
    explicitTool = targets[0]
    targets = targets.slice(1)
  }

  if (!targets.length) {
    const recent = await scanRecentSessions({ limit: 10 })
    if (!recent.length) {
      console.log(HELP)
      return
    }
    const picked = await pickRecentSessionInteractive(recent)
    if (!picked) return
    targets = [picked.file]
    explicitTool = picked.tool
  }

  const result = await buildReplay(targets, {
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

  printBuildReport(result)

  const shouldServe = hasServe || (!hasNoServe && Boolean(process.stdin.isTTY && process.stdout.isTTY))
  if (shouldServe) {
    const { url } = await serveReplayDir(result.dir, { port, open: !hasNoOpen })
    console.log(`\n🎬 Encore stage live at ${url} (Ctrl+C to stop)`)
    console.log(`   Tip: Edit ${relative(process.cwd(), result.sessionFile) || 'session.json'} and refresh the browser to see changes immediately.`)
  }
}

main().catch(err => {
  console.error(`\n❌ Encore error: ${err.message || err}`)
  process.exit(1)
})
