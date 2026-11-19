import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escapeHtml } from './markdown.mjs'

const srcDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(srcDir, '..')
const playerDir = join(repoRoot, 'player')

function stripModuleSyntax(code) {
  return code
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*$/gm, '')
    .replace(/^export\s+(async\s+function|function|const|let|class)\b/gm, '$1')
    .replace(/\bescapeHtml\s+as\s+escape\b/g, '')
    .trim()
}

export function buildStandalonePlayerJs({ write = true } = {}) {
  const files = [
    'i18n.mjs',
    'markdown.mjs',
    'timeline.mjs',
    'attachment-reader.mjs',
    'render.mjs',
    'player-runtime.mjs',
  ]
  const chunks = files.map(name => {
    let raw = readFileSync(join(srcDir, name), 'utf8')
    if (name === 'render.mjs') {
      raw = raw.replace(/\bconst escape = escapeHtml\b/, '')
      raw = `const escape = escapeHtml\n${raw}`
    }
    return `// --- ${name} ---\n${stripModuleSyntax(raw)}`
  })

  const bundle = `// Encore Standalone Player (https://github.com/niracler/encore)
;(() => {
${chunks.join('\n\n')}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoMountEncorePlayers())
  } else {
    autoMountEncorePlayers()
  }
}
})()
`
  if (write) {
    try {
      mkdirSync(playerDir, { recursive: true })
      writeFileSync(join(playerDir, 'encore-player.js'), bundle, 'utf8')
    } catch {
      // Ignore write failures in read-only package caches (e.g. npx / Nix store)
    }
  }
  return bundle
}

export function renderIndexHtml({ title = 'Agent Session Replay', lang = 'auto', sessionSrc = './session.json' } = {}) {
  const htmlLang = lang === 'en' ? 'en' : 'zh-CN'
  const dataLangAttr = lang && lang !== 'auto' ? ` data-lang="${escapeHtml(lang)}"` : ''
  return `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Encore</title>
  <link rel="stylesheet" href="./encore-player.css">
</head>
<body class="encore-page">
  <div data-encore-player src="${escapeHtml(sessionSrc)}"${dataLangAttr}></div>
  <script src="./encore-player.js" defer></script>
</body>
</html>
`
}

export function writePlayerAssets(targetDir, { title, lang = 'auto', sessionSrc = './session.json' } = {}) {
  mkdirSync(targetDir, { recursive: true })
  const bundle = buildStandalonePlayerJs({ write: false })
  writeFileSync(join(targetDir, 'encore-player.js'), bundle, 'utf8')
  copyFileSync(join(playerDir, 'encore-player.css'), join(targetDir, 'encore-player.css'))
  const html = renderIndexHtml({ title, lang, sessionSrc })
  writeFileSync(join(targetDir, 'index.html'), html, 'utf8')
  return {
    indexHtml: join(targetDir, 'index.html'),
    playerJs: join(targetDir, 'encore-player.js'),
    playerCss: join(targetDir, 'encore-player.css'),
  }
}
