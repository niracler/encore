import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

export const recordedText = Symbol('recordedText')

function isLocal(path) {
  return typeof path === 'string' && path && !path.startsWith('#') && !path.startsWith('//')
    && (!/^[a-z][\w+.-]*:/i.test(path) || isAbsolute(path) || path.startsWith('file:'))
}

function decodeLocalName(path) {
  try { return decodeURIComponent(path) } catch { return path } // Local filenames may contain a literal %.
}

export function fileReferences(entries, cwd) {
  const files = new Map()
  for (const entry of entries) {
    let path = typeof entry === 'string' ? entry : entry?.path
    if (typeof path === 'string' && path.startsWith('sandbox:/')) {
      files.set(path, { title: basename(path), availability: 'missing' })
      continue
    }
    if (!isLocal(path)) continue
    if (path.startsWith('file:')) {
      try { path = fileURLToPath(path) } catch { continue }
    }
    if (path.startsWith('~/')) path = join(homedir(), path.slice(2))
    if (cwd && !isAbsolute(path)) path = resolve(cwd, path)
    const sha256 = typeof entry === 'object' ? entry.sha256 : undefined
    files.set(path, { title: basename(path), source: { path, ...(sha256 && { sha256 }) } })
  }
  return [...files.values()]
}

export function messageReferences(text) {
  const prose = text.replace(/^\s*(\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '').replace(/\x60[^\x60\n]*\x60/g, '')
  const paths = []
  for (const match of prose.matchAll(/\[([^\]\n]*)\]\((<[^>\n]+>|(?:[^()\n]|\([^()\n]*\))+)\)/g)) {
    if (match[1].startsWith('$')) continue
    let path = match[2].replace(/^<|>$/g, '').split('#')[0]
    if ((!isLocal(path) && !path.startsWith('sandbox:/')) || !extname(path)) continue
    paths.push(decodeLocalName(path))
  }
  return paths
}

const supportedInline = new Set(['.pdf', '.xlsx', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.ogg'])
const notFound = err => ['ENOENT', 'ENOTDIR'].includes(err.code)
export const within = (path, root) => {
  const rel = relative(root, path)
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}

export async function nativeSessionRoot(log, tool, records) {
  const stores = {
    codex: ['.codex/sessions', '.codex/archived_sessions'],
    workbuddy: ['.workbuddy/projects'], 'claude-code': ['.claude/projects'],
  }
  const path = await realpath(log)
  if (!stores[tool]?.some(dir => within(path, join(homedir(), dir)))) return undefined
  const cwd = tool === 'codex' ? records.find(row => row.type === 'session_meta')?.payload?.cwd
    : records.find(row => row.cwd)?.cwd
  return cwd && isAbsolute(cwd) ? cwd : undefined
}

async function snapshot(path, target, roots, userSelected) {
  let actual
  let handle
  try {
    actual = await realpath(path)
    if (!roots.some(root => within(actual, root)) && !userSelected) return { unavailableReason: 'outside-root' }
    if (!(await stat(actual)).isFile()) return { availability: 'missing', unavailableReason: 'unreadable' }
    handle = await open(actual, 'r')
  } catch (err) {
    if (notFound(err)) return { availability: 'missing' }
    if (['EPERM', 'EACCES', 'ELOOP'].includes(err.code)) return { availability: 'missing', unavailableReason: 'unreadable' }
    throw err
  }
  try {
    return await writeAttachment(handle.createReadStream(), path, target)
  } finally {
    await handle.close()
  }
}

async function writeAttachment(stream, path, target) {
  let stage
  try {
    const dir = join(target, 'attachments')
    await mkdir(dir, { recursive: true })
    if ((await lstat(dir)).isSymbolicLink()) throw new Error('Attachment directory must be inside the replay')
    stage = await mkdtemp(join(dir, 'copy-'))
    const temp = join(stage, 'file')
    const hash = createHash('sha256')
    const meter = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); callback(null, chunk) } })
    await pipeline(stream, meter, createWriteStream(temp, { flags: 'wx' }))
    const digest = hash.digest('hex')
    const ext = extname(path).toLowerCase()
    const name = digest + (supportedInline.has(ext) ? ext : '.bin')
    await rename(temp, join(dir, name))
    return { href: 'attachments/' + name, digest }
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true })
  }
}

// Consume explicit external sources once. Reopening a replay uses its own packaged files.
export async function collectExternalFiles(session, directory, assetRoots, nativeRoot, sessionRoots = []) {
  const userFiles = new Set((session.items || []).filter(item => item.type === 'user').flatMap(item => item.deliverables || []))
  const files = [...(session.deliverables || session.files || []), ...(session.items || []).flatMap(item => item.deliverables || [])]
  if (!files.length) return false
  const originalWorkspace = nativeRoot && !assetRoots
  if (!assetRoots?.length) assetRoots = [process.cwd()]
  const roots = await Promise.all(assetRoots.map(root => realpath(resolve(root))))
  if (originalWorkspace) {
    try { roots.push(await realpath(nativeRoot)) } catch (err) { if (!notFound(err)) throw err }
  }
  for (const root of sessionRoots) roots.push(await realpath(root))
  const copies = new Map()
  let changed = false
  for (const file of files) {
    if (file[recordedText] !== undefined) {
      const copy = await writeAttachment(Readable.from([Buffer.from(file[recordedText])]), file.title, directory)
      Object.assign(file, { href: copy.href, availability: 'export-copy' })
      delete file[recordedText]
      changed = true
      continue
    }
    if (!file.source && file.href && isLocal(file.href)) {
      // Root-relative web URLs belong to the host site. Explicit file: URLs are local.
      if (isAbsolute(file.href) && !within(file.href, homedir()) && !roots.some(root => within(file.href, root))) continue
      const external = isAbsolute(file.href) || /^(?:~\/|file:)/.test(file.href)
      if (external) {
        file.source = fileReferences([file.href])[0]?.source
      } else {
        const target = decodeLocalName(file.href.split(/[?#]/)[0])
        const path = resolve(directory, target)
        let availability
        let reason
        try {
          const actual = await realpath(path)
          if (!within(actual, await realpath(directory))) {
            file.source = { path }
          } else if (!(await stat(actual)).isFile()) {
            availability = 'missing'
            reason = 'unreadable'
          } else if (file.sessionSha256) {
            const hash = createHash('sha256')
            for await (const chunk of createReadStream(actual)) hash.update(chunk)
            availability = hash.digest('hex') === file.sessionSha256 ? 'verified' : 'export-copy'
          } else {
            availability = 'export-copy'
          }
        } catch (err) {
          availability = 'missing'
          if (!notFound(err)) reason = 'unreadable'
        }
        if (availability && (file.availability !== availability || file.unavailableReason !== reason)) {
          file.availability = availability
          if (reason) file.unavailableReason = reason
          else delete file.unavailableReason
          if (availability === 'missing') delete file.preview
          changed = true
        }
      }
    }
    if (!file.source) continue
    const source = file.source
    const sourcePath = source.path.startsWith('~/') ? join(homedir(), source.path.slice(2)) : source.path
    const path = resolve(nativeRoot || roots[0], sourcePath)
    const userSelected = Boolean(originalWorkspace && userFiles.has(file))
    const key = JSON.stringify([path, userSelected])
    if (!copies.has(key)) copies.set(key, await snapshot(path, directory, roots, userSelected))
    const { href, digest, unavailableReason } = copies.get(key)
    delete file.source
    delete file.href
    delete file.preview
    delete file.unavailableReason
    if (href) file.href = href
    if (/^[a-f0-9]{64}$/i.test(source.sha256 || '')) file.sessionSha256 = source.sha256.toLowerCase()
    else delete file.sessionSha256
    if (unavailableReason) file.unavailableReason = unavailableReason
    file.availability = !href ? 'missing' : digest === file.sessionSha256 ? 'verified' : 'export-copy'
    changed = true
  }
  return changed
}
