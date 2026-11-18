import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStandalonePlayerJs } from '../src/player-assets.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const siteSrcDir = join(repoRoot, 'site')
const outDir = join(repoRoot, 'dist', 'site')

mkdirSync(outDir, { recursive: true })
mkdirSync(join(outDir, 'schema'), { recursive: true })

// Ensure standalone player bundle is fresh
const playerJs = buildStandalonePlayerJs({ write: true })
writeFileSync(join(outDir, 'encore-player.js'), playerJs, 'utf8')
copyFileSync(join(repoRoot, 'player', 'encore-player.css'), join(outDir, 'encore-player.css'))
copyFileSync(join(siteSrcDir, 'CNAME'), join(outDir, 'CNAME'))
copyFileSync(join(siteSrcDir, 'session.json'), join(outDir, 'session.json'))
copyFileSync(join(repoRoot, 'schema', 'session.schema.json'), join(outDir, 'schema', 'session.schema.json'))

for (const img of ['preview-zh.webp', 'preview-en.webp']) {
  const srcImg = join(repoRoot, 'docs', img)
  if (existsSync(srcImg)) {
    copyFileSync(srcImg, join(outDir, img))
  }
}

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Encore — Bring Your AI Agent Sessions Back on Stage</title>
  <meta name="description" content="Like asciinema, but for AI Agents (Codex, Claude Code, Claude, WorkBuddy). Replay conversations, live Context Window growth, compactions, and visual milestones.">
  <link rel="stylesheet" href="./encore-player.css">
  <style>
    .showcase-shell {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Segoe UI", system-ui, sans-serif;
    }
    .showcase-hero {
      flex: none;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      padding: 12px 20px;
    }
    .showcase-hero-inner {
      width: min(1360px, 100%);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .showcase-brand {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 280px;
      flex: 1;
    }
    .showcase-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .showcase-logo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 9px;
      border-radius: 6px;
      background: #0f172a;
      color: #ffffff;
      font: 700 12px/1.3 ui-monospace, "SF Mono", Menlo, monospace;
      letter-spacing: 0.08em;
      text-decoration: none;
    }
    .showcase-version {
      font: 600 11px/1 ui-monospace, "SF Mono", Menlo, monospace;
      color: #64748b;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 3px 8px;
    }
    .showcase-tagline {
      margin: 0;
      font-size: 14.5px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.35;
    }
    .showcase-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .showcase-pill {
      font-size: 11.5px;
      line-height: 1.3;
      color: #475569;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 2px 8px;
      white-space: nowrap;
    }
    .showcase-pill strong {
      color: #0f172a;
      font-weight: 600;
    }
    .showcase-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .showcase-cmd {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 34px;
      padding: 0 6px 0 12px;
      border-radius: 8px;
      background: #0f172a;
      color: #f8fafc;
      font: 500 12.5px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      border: 1px solid #1e293b;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    .showcase-cmd-prompt {
      color: #fb8f68;
      user-select: none;
    }
    .showcase-copy-btn {
      height: 24px;
      padding: 0 8px;
      border-radius: 5px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #e2e8f0;
      font: 600 11px/1 system-ui, sans-serif;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .showcase-copy-btn:hover {
      background: #334155;
      color: #ffffff;
    }
    .showcase-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 34px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #1e293b;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .showcase-link:hover {
      border-color: #94a3b8;
      background: #f1f5f9;
    }
    .showcase-stage {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .showcase-stage .session-wrap {
      margin: 10px auto 12px;
    }
    .showcase-stage .session-app {
      height: calc(100dvh - 96px);
      min-height: 580px;
    }
    @media (max-width: 860px) {
      .showcase-stage .session-app {
        height: calc(100dvh - 140px);
      }
    }
  </style>
</head>
<body class="encore-page showcase-shell">
  <header class="showcase-hero">
    <div class="showcase-hero-inner">
      <div class="showcase-brand">
        <div class="showcase-title-row">
          <a class="showcase-logo" href="https://github.com/niracler/encore" target="_blank" rel="noopener">ENCORE</a>
          <span class="showcase-version">v${pkg.version}</span>
          <p class="showcase-tagline">Bring your AI agent sessions back on stage — like asciinema, for AI Agents.</p>
        </div>
        <div class="showcase-pills">
          <span class="showcase-pill"><strong>Agents:</strong> Codex · Claude Code · Claude · WorkBuddy</span>
          <span class="showcase-pill"><strong>Context Inspector:</strong> 7-Bucket Live Gauge</span>
          <span class="showcase-pill"><strong>Milestones:</strong> Compactions · Sub-Agents · WebP Frames</span>
          <span class="showcase-pill"><strong>Bilingual:</strong> EN / 中文 Toggle</span>
        </div>
      </div>
      <div class="showcase-actions">
        <div class="showcase-cmd" role="region" aria-label="Quick start command">
          <span class="showcase-cmd-prompt">$</span>
          <code id="encore-cli-cmd">npx @niracler/encore</code>
          <button type="button" class="showcase-copy-btn" id="encore-copy-btn" aria-label="Copy CLI command">Copy</button>
        </div>
        <a class="showcase-link" href="https://github.com/niracler/encore" target="_blank" rel="noopener">GitHub ↗</a>
        <a class="showcase-link" href="https://www.npmjs.com/package/@niracler/encore" target="_blank" rel="noopener">npm ↗</a>
      </div>
    </div>
  </header>
  <main class="showcase-stage">
    <div data-encore-player src="./session.json"></div>
  </main>
  <script src="./encore-player.js" defer></script>
  <script>
    document.getElementById('encore-copy-btn')?.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText('npx @niracler/encore')
        const prev = this.textContent
        this.textContent = 'Copied!'
        setTimeout(() => { this.textContent = prev }, 1600)
      } catch {}
    })
  </script>
</body>
</html>
`

writeFileSync(join(outDir, 'index.html'), html, 'utf8')
console.log(`Built Encore showcase site in ${outDir}`)
