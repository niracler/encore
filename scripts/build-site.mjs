import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
rmSync(join(outDir, 'session.json'), { force: true })
copyFileSync(join(siteSrcDir, 'showcase.js'), join(outDir, 'showcase.js'))
copyFileSync(join(repoRoot, 'schema', 'session.schema.json'), join(outDir, 'schema', 'session.schema.json'))

const demosSrcDir = join(siteSrcDir, 'demos')
const demosOutDir = join(outDir, 'demos')
if (existsSync(demosSrcDir)) {
  rmSync(demosOutDir, { recursive: true, force: true })
  cpSync(demosSrcDir, demosOutDir, { recursive: true })
}

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
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://encore.niracler.com/">
  <meta property="og:title" content="Encore — Bring Your AI Agent Sessions Back on Stage">
  <meta property="og:description" content="Turn raw Codex, Claude Code, Claude.ai, and WorkBuddy transcripts into interactive web replays with a live Context Window inspector.">
  <meta property="og:image" content="https://encore.niracler.com/preview-en.webp">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230f172a'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='ui-monospace,SFMono-Regular,Menlo,monospace' font-size='18' font-weight='700' fill='%23fb8f68'%3EE%3C/text%3E%3C/svg%3E">
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
      padding: 10px 20px;
    }
    .showcase-hero-inner {
      width: min(1360px, 100%);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px 16px;
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
    .showcase-switcher {
      flex: none;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 8px 20px;
    }
    .showcase-switcher-inner {
      width: min(1360px, 100%);
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .showcase-switcher-label {
      flex: none;
      font: 600 11px/1 ui-monospace, "SF Mono", Menlo, monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }
    .showcase-demo-tabs {
      display: flex;
      align-items: stretch;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      flex: 1;
      padding: 1px 0;
    }
    .showcase-demo-tabs::-webkit-scrollbar {
      display: none;
    }
    .showcase-demo-tab {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
      text-align: left;
      text-decoration: none;
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }
    .showcase-demo-tab:hover {
      border-color: #cbd5e1;
      background: #ffffff;
    }
    .showcase-demo-tab[aria-current="page"] {
      border-color: #0f172a;
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }
    .showcase-agent-badge {
      flex: none;
      font: 600 10.5px/1 ui-monospace, "SF Mono", Menlo, monospace;
      padding: 3px 6px;
      border-radius: 5px;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .showcase-agent-badge.is-codex {
      background: #fff7ed;
      color: #c2410c;
      border-color: #fed7aa;
    }
    .showcase-agent-badge.is-claude-code {
      background: #eef2ff;
      color: #4338ca;
      border-color: #c7d2fe;
    }
    .showcase-agent-badge.is-claude-ai {
      background: #f0fdf4;
      color: #15803d;
      border-color: #bbf7d0;
    }
    .showcase-agent-badge.is-workbuddy {
      background: #f0f9ff;
      color: #0369a1;
      border-color: #bae6fd;
    }
    .showcase-demo-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.15;
    }
    .showcase-demo-text strong {
      font-size: 12px;
      font-weight: 600;
      color: inherit;
      white-space: nowrap;
    }
    .showcase-demo-text small {
      font-size: 10.5px;
      color: #64748b;
      white-space: nowrap;
    }
    #showcase-language { cursor: pointer; }
    #watch-film { color: #334155; font-size: 13px; }
    .showcase-stage {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .showcase-stage .session-wrap {
      margin: 8px auto 12px;
    }
    @media (width <= 640px) {
      .showcase-switcher-label {
        display: none;
      }
    }
    @media (width > 920px) {
      .showcase-stage .session-app {
        height: calc(100dvh - 128px);
        min-height: 540px;
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
          <p class="showcase-tagline" data-text="tagline">Bring your AI agent sessions back on stage — like asciinema, for AI Agents.</p>
        </div>
      </div>
      <div class="showcase-actions">
        <div class="showcase-cmd" role="region" aria-label="Quick start command" data-label="command">
          <span class="showcase-cmd-prompt">$</span>
          <code id="encore-cli-cmd">npx @niracler/encore@latest</code>
          <button type="button" class="showcase-copy-btn" id="encore-copy-btn" aria-label="Copy CLI command" data-label="copyCommand" data-text="copy">Copy</button>
        </div>
        <button type="button" id="showcase-language" class="showcase-link" lang="zh-CN">中文</button>
        <a class="showcase-link" href="https://github.com/niracler/encore" target="_blank" rel="noopener">GitHub ↗</a>
        <a class="showcase-link" href="https://www.npmjs.com/package/@niracler/encore" target="_blank" rel="noopener">npm ↗</a>
      </div>
    </div>
  </header>
  <nav class="showcase-switcher" aria-label="Live replay demos" data-label="cases">
    <div class="showcase-switcher-inner">
      <span class="showcase-switcher-label" data-text="cases">Live Cases</span>
      <div class="showcase-demo-tabs">
        <a class="showcase-demo-tab" href="?demo=ai-tree-1014" data-case="ai-tree-1014">
          <span class="showcase-agent-badge is-claude-ai">Claude.ai</span>
          <span class="showcase-demo-text"><strong data-text="first">70 Years of AI · First cut</strong><small data-text="firstMeta">From idea to preview</small></span>
        </a>
        <a class="showcase-demo-tab" href="?demo=ai-tree-1015" data-case="ai-tree-1015">
          <span class="showcase-agent-badge is-claude-ai">Claude.ai</span>
          <span class="showcase-demo-text"><strong data-text="final">70 Years of AI · Final cut</strong><small data-text="finalMeta">Revising after feedback</small></span>
        </a>
        <a class="showcase-demo-tab" href="?demo=lesson-00-buyers-codex" data-case="lesson-00-buyers-codex">
          <span class="showcase-agent-badge is-codex">Codex</span>
          <span class="showcase-demo-text"><strong data-text="buyers">Overseas lighting buyers</strong><small data-text="codexBuyersMeta">Three markets · 26 leads</small></span>
        </a>
        <a class="showcase-demo-tab" href="?demo=lesson-00-buyers-workbuddy" data-case="lesson-00-buyers-workbuddy">
          <span class="showcase-agent-badge is-workbuddy">WorkBuddy</span>
          <span class="showcase-demo-text"><strong data-text="buyers">Overseas lighting buyers</strong><small data-text="workbuddyBuyersMeta">Retrying tasks · 32 leads</small></span>
        </a>
      </div>
      <a id="watch-film" href="?demo=ai-tree-1015#film" data-text="film">Watch the film</a>
    </div>
  </nav>
  <main class="showcase-stage">
    <div id="encore-showcase-player"></div>
  </main>
  <script src="./encore-player.js" defer></script>
  <script type="module" src="./showcase.js"></script>
</body>
</html>
`

writeFileSync(join(outDir, 'index.html'), html, 'utf8')
console.log(`Built Encore showcase site in ${outDir}`)
