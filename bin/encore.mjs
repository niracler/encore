#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import { parseArgs } from 'node:util'
import { pickSession } from '../src/session-picker.mjs'
import {
  buildReplay,
  rebuildReplayDir,
  scanRecentSessions,
  tools,
  serveReplayDir,
} from '../src/index.mjs'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

const HELP = `
encore (@niracler/encore) — Replay an AI Agent session to see how it worked and what it delivered.

Usage:
  encore                              Scan recent Codex, Claude Code, WorkBuddy & Antigravity sessions and pick one interactively
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

async function withBuildProgress(build) {
  const output = process.stderr
  if (!output.isTTY) return build()

  const frames = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  let index = 0
  const draw = () => output.write(`\r${frames[index++ % frames.length]} Building replay…`)
  draw()
  const timer = setInterval(draw, 100)
  try {
    return await build()
  } finally {
    clearInterval(timer)
    readline.cursorTo(output, 0)
    readline.clearLine(output, 0)
  }
}

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

async function pickRecentSessionInteractive(lang) {
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

  return pickSession({ lang })
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
    const rebuilt = await withBuildProgress(() => rebuildReplayDir(targetDir, {
      assetRoots: values['asset-root'],
      lang: values.lang,
      title: values.title,
      description: values.desc,
    }))
    printBuildReport(rebuilt)
    const { url } = await serveReplayDir(rebuilt.dir, { port, open: !hasNoOpen })
    console.log(`\n🎬 Replay live at ${url} (Ctrl+C to stop)`)
    console.log(`   Tip: Edit ${displayPath(rebuilt.sessionFile)} and refresh the browser to see changes immediately.`)
    return
  }

  if (values.list) {
    const recent = await scanRecentSessions({ limit: 15 })
    if (!recent.length) {
      console.log('No recent local AI Agent sessions found.')
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
  if (Object.hasOwn(tools, targets[0]) && targets.length > 1) {
    explicitTool = targets[0]
    targets = targets.slice(1)
  }

  if (!targets.length) {
    const picked = await pickRecentSessionInteractive(values.lang)
    if (!picked) return
    targets = [picked.file]
    explicitTool = picked.tool
  }

  const result = await withBuildProgress(() => buildReplay(targets, {
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
  }))

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
