import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { readClaudeAi } from './claude-ai.mjs'
import { prepareAttachmentPreviews } from './attachment-previews.mjs'
import { collectExternalFiles, nativeSessionRoot } from './external-files.mjs'
import { readClaudeCode } from './claude-code.mjs'
import { readCodex } from './codex.mjs'
import { readWorkBuddy } from './workbuddy.mjs'
import { cutSession, deriveDefaultTitle, readJsonl, tools } from './common.mjs'
import { detectInput, detectJsonlTool, scanRecentSessions } from './detect.mjs'
import { createTranslator, DICTS, resolveLang } from './i18n.mjs'
import { extractImages } from './images.mjs'
import { escapeHtml, renderMarkdown } from './markdown.mjs'
import { buildStandalonePlayerJs, renderIndexHtml, writePlayerAssets } from './player-assets.mjs'
import { attachPlayerController, createEncorePlayer, createSessionPlaybackModel } from './player-runtime.mjs'
import { clipSession, findLeaks, redactSession, redactText } from './redact.mjs'
import { buildPlayerData, elapsedClock, renderPlayerWidget, wallClock } from './render.mjs'
import { openBrowser, serveReplayDir } from './server.mjs'
import { binSeconds, describeStats, kindOf, minutes, sumStats, timeline, waitThreshold } from './timeline.mjs'

const readers = {
  codex: readCodex,
  workbuddy: readWorkBuddy,
  'claude-code': readClaudeCode,
  'claude-ai': readClaudeAi,
}

function createDefaultOutDir(filePath, tool) {
  const base = basename(filePath)
    .replace(/\.jsonl(?:\.zst)?$|\.json$/i, '')
    .replace(/^rollout-/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
  const slug = base || tool || 'session'
  return mkdtempSync(join(resolve(tmpdir()), `encore-${slug}-`))
}

export async function importRawSession(files, {
  tool,
  outDir,
  lang = 'auto',
  title,
  description,
  from,
  to,
  images = true,
  imageWidth = 960,
  clip,
  conversation,
  includeMemory = false,
  assetRoots,
} = {}) {
  const fileList = [].concat(files).map(f => resolve(f))
  const detectedTool = tool || (await detectInput(fileList[0])).tool || 'codex'
  if (!readers[detectedTool]) {
    throw new Error(`Unsupported session format: ${detectedTool}`)
  }
  const window = { from, to }
  const records = detectedTool === 'claude-ai' ? JSON.parse(readFileSync(fileList[0], 'utf8')) : await readJsonl(fileList, window)
  const nativeRoot = await nativeSessionRoot(fileList[0], detectedTool, records)
  const raw = cutSession(readers[detectedTool](records, { ...window, conversation, includeMemory }), window)

  if (title) raw.title = title
  if (description !== undefined) raw.description = description
  if (lang && lang !== 'auto') raw.lang = resolveLang(lang)
  raw.title = deriveDefaultTitle(raw)
  if (raw.description === undefined) raw.description = ''
  if (!raw.deliverables) raw.deliverables = []

  const createdTempDir = !outDir
  const targetDir = outDir ? resolve(outDir) : createDefaultOutDir(fileList[0], detectedTool)

  try {
    if (outDir && existsSync(targetDir) && images) {
      for (const name of readdirSync(targetDir).filter(file => file.endsWith('.webp'))) {
        rmSync(join(targetDir, name))
      }
    }

    const resolvedLang = resolveLang(lang === 'auto' ? undefined : lang)
    const withImages = await extractImages(raw, targetDir, {
      keep: images,
      width: imageWidth,
      lang: resolvedLang,
    })
    await collectExternalFiles(withImages, targetDir, assetRoots, nativeRoot)
    const redacted = redactSession(withImages)
    const limit = clip ? Number(clip) : undefined
    const session = clipSession(redacted, limit ? { input: limit, output: limit } : undefined)
    const leaks = findLeaks(session)

    mkdirSync(targetDir, { recursive: true })
    await prepareAttachmentPreviews(session, targetDir)
    const sessionFile = join(targetDir, 'session.json')
    writeFileSync(sessionFile, `${JSON.stringify(session, null, 2)}\n`, 'utf8')
    const assets = writePlayerAssets(targetDir, {
      title: session.title,
      lang: lang || session.lang || 'auto',
    })

    return {
      mode: 'import',
      tool: detectedTool,
      toolLabel: tools[detectedTool] || detectedTool,
      dir: targetDir,
      sessionFile,
      session,
      leaks,
      assets,
    }
  } catch (err) {
    if (createdTempDir) rmSync(targetDir, { recursive: true, force: true })
    throw err
  }
}

export async function rebuildReplayDir(dirOrSessionFile, {
  lang,
  title,
  description,
  assetRoots,
} = {}) {
  const detected = await detectInput(dirOrSessionFile)
  const targetDir = detected.dir
  const sessionFile = detected.sessionFile
  const session = JSON.parse(readFileSync(sessionFile, 'utf8'))

  let modified = await collectExternalFiles(session, targetDir, assetRoots)
  if (title !== undefined && title !== session.title) {
    session.title = title
    modified = true
  }
  if (description !== undefined && description !== session.description) {
    session.description = description
    modified = true
  }
  if (lang && lang !== 'auto' && resolveLang(lang) !== session.lang) {
    session.lang = resolveLang(lang)
    modified = true
  }
  if (!session.title) {
    session.title = deriveDefaultTitle(session)
    modified = true
  }
  if (Array.isArray(session.items) && session.items.length > 0) {
    const times = session.items.map(it => it.time).filter(Boolean).sort()
    if (times.length) {
      if (session.started !== times[0]) {
        session.started = times[0]
        modified = true
      }
      if (session.ended !== times.at(-1)) {
        session.ended = times.at(-1)
        modified = true
      }
    }
    if (Array.isArray(session.frames)) {
      const keptImgs = new Set(session.frames.map(fr => fr.img).filter(Boolean))
      for (const item of session.items) {
        if (Array.isArray(item.images)) {
          const nextImgs = item.images.filter(img => !String(img).endsWith('.webp') || keptImgs.has(img))
          if (nextImgs.length !== item.images.length) {
            if (nextImgs.length) item.images = nextImgs
            else delete item.images
            modified = true
          }
        }
      }
    }
  }
  if (await prepareAttachmentPreviews(session, targetDir)) modified = true
  if (modified) {
    writeFileSync(sessionFile, `${JSON.stringify(session, null, 2)}\n`, 'utf8')
  }

  const leaks = findLeaks(session)
  const assets = writePlayerAssets(targetDir, {
    title: session.title,
    lang: lang || session.lang || 'auto',
  })

  return {
    mode: 'rebuild',
    tool: session.tool || 'codex',
    toolLabel: tools[session.tool] || session.tool || 'Agent',
    dir: targetDir,
    sessionFile,
    session,
    leaks,
    assets,
  }
}

export async function buildReplay(inputs, options = {}) {
  const list = [].concat(inputs).filter(Boolean)
  if (!list.length) {
    throw new Error('No input file or directory specified')
  }
  const firstDetected = await detectInput(list[0])
  if (firstDetected.kind === 'replay-dir' || firstDetected.kind === 'session-json') {
    return rebuildReplayDir(list[0], options)
  }
  return importRawSession(list, { ...options, tool: options.tool || firstDetected.tool })
}

export {
  attachPlayerController,
  binSeconds,
  buildPlayerData,
  buildStandalonePlayerJs,
  clipSession,
  createEncorePlayer,
  createSessionPlaybackModel,
  createTranslator,
  cutSession,
  deriveDefaultTitle,
  describeStats,
  detectInput,
  detectJsonlTool,
  DICTS,
  elapsedClock,
  escapeHtml,
  extractImages,
  findLeaks,
  kindOf,
  minutes,
  openBrowser,
  readClaudeAi,
  readClaudeCode,
  readCodex,
  readWorkBuddy,
  readJsonl,
  redactSession,
  redactText,
  renderIndexHtml,
  renderMarkdown,
  renderPlayerWidget,
  resolveLang,
  scanRecentSessions,
  serveReplayDir,
  sumStats,
  timeline,
  tools,
  waitThreshold,
  wallClock,
  writePlayerAssets,
}
