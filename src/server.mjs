import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.md': 'text/markdown; charset=utf-8',
}

export function openBrowser(url) {
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.unref()
  } catch {
    // Ignore browser launch errors on headless machines
  }
}

export function serveReplayDir(rootDir, { port = 4180, host = '127.0.0.1', open = false } = {}) {
  const baseDir = resolve(rootDir)

  const handler = (req, res) => {
    const rawUrl = (req.url || '/').split('?')[0]
    let reqPath
    try {
      reqPath = rawUrl === '/' ? '/index.html' : decodeURIComponent(rawUrl)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('400 Bad Request')
      return
    }
    const filePath = resolve(baseDir, `.${reqPath.startsWith('/') ? reqPath : `/${reqPath}`}`)

    if ((filePath !== baseDir && !filePath.startsWith(baseDir + sep)) || !existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
      return
    }

    const st = statSync(filePath)
    const targetFile = st.isDirectory() ? join(filePath, 'index.html') : filePath
    if (!existsSync(targetFile)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
      return
    }

    const ext = extname(targetFile).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    })
    createReadStream(targetFile).pipe(res)
  }

  return new Promise((resolvePromise, rejectPromise) => {
    let currentPort = Number(port) || 4180
    const tryListen = () => {
      const server = createServer(handler)
      server.once('error', err => {
        if (err.code === 'EADDRINUSE' && currentPort < Number(port) + 20) {
          currentPort++
          tryListen()
        } else {
          rejectPromise(err)
        }
      })
      server.listen(currentPort, host, () => {
        const url = `http://localhost:${currentPort}`
        if (open) openBrowser(url)
        resolvePromise({ server, url, port: currentPort })
      })
    }
    tryListen()
  })
}
