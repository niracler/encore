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
copyFileSync(join(siteSrcDir, 'session.json'), join(outDir, 'session.json'))
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

const demos = [
  {
    id: 'encore',
    src: './session.json',
    agent: 'Codex',
    agentTone: 'codex',
    label: 'Design & Ship Encore',
    meta: 'EN · Feature Tour',
  },
  {
    id: 'poster-redesign',
    src: './demos/poster-redesign/session.json',
    agent: 'Codex',
    agentTone: 'codex',
    label: 'Poster Redesign',
    meta: '7 Frames · Compaction',
  },
  {
    id: 'work-stages-site',
    src: './demos/work-stages-site/session.json',
    agent: 'Claude Code',
    agentTone: 'claude-code',
    label: 'Site Integration',
    meta: '4 Sub-Agents · 5 Frames',
  },
  {
    id: 'work-stages-design',
    src: './demos/work-stages-design/session.json',
    agent: 'Claude.ai',
    agentTone: 'claude-ai',
    label: '7-Stage Diagram',
    meta: 'Web Export · 9 Drafts',
  },
  {
    id: 'xcmd-research',
    src: './demos/xcmd-research/session.json',
    agent: 'WorkBuddy',
    agentTone: 'workbuddy',
    label: 'x-cmd Research',
    meta: '4 Parallel Sub-Agents',
  },
]

const demoTabsHtml = demos.map((demo, idx) => `
          <button
            type="button"
            class="showcase-demo-tab${idx === 0 ? ' is-active' : ''}"
            role="tab"
            aria-selected="${idx === 0 ? 'true' : 'false'}"
            data-demo-id="${demo.id}"
          >
            <span class="showcase-agent-badge is-${demo.agentTone}">${demo.agent}</span>
            <span class="showcase-demo-text">
              <strong>${demo.label}</strong>
              <small>${demo.meta}</small>
            </span>
          </button>`).join('')

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
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }
    .showcase-demo-tab:hover {
      border-color: #cbd5e1;
      background: #ffffff;
    }
    .showcase-demo-tab.is-active {
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
          <p class="showcase-tagline">Bring your AI agent sessions back on stage — like asciinema, for AI Agents.</p>
        </div>
      </div>
      <div class="showcase-actions">
        <div class="showcase-cmd" role="region" aria-label="Quick start command">
          <span class="showcase-cmd-prompt">$</span>
          <code id="encore-cli-cmd">npx @niracler/encore@latest</code>
          <button type="button" class="showcase-copy-btn" id="encore-copy-btn" aria-label="Copy CLI command">Copy</button>
        </div>
        <a class="showcase-link" href="https://github.com/niracler/encore" target="_blank" rel="noopener">GitHub ↗</a>
        <a class="showcase-link" href="https://www.npmjs.com/package/@niracler/encore" target="_blank" rel="noopener">npm ↗</a>
      </div>
    </div>
  </header>
  <nav class="showcase-switcher" aria-label="Live replay demos">
    <div class="showcase-switcher-inner">
      <span class="showcase-switcher-label">Live Cases</span>
      <div class="showcase-demo-tabs" role="tablist">${demoTabsHtml}
      </div>
    </div>
  </nav>
  <main class="showcase-stage">
    <div id="encore-showcase-player"></div>
  </main>
  <script src="./encore-player.js" defer></script>
  <script>
    const SHOWCASE_DEMOS = ${JSON.stringify(demos)};
    const demoMap = new Map(SHOWCASE_DEMOS.map(d => [d.id, d]));
    let activePlayer = null;
    let activeDemoId = null;
    let loadSeq = 0;

    function getDemoFromLocation() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('demo');
      return demoMap.has(id) ? id : SHOWCASE_DEMOS[0].id;
    }

    function getLangFromLocation() {
      const lang = new URLSearchParams(window.location.search).get('lang');
      return lang === 'en' || lang === 'zh' ? lang : undefined;
    }

    function syncTabs(demoId) {
      let activeBtn = null;
      document.querySelectorAll('[data-demo-id]').forEach(btn => {
        const isActive = btn.dataset.demoId === demoId;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) activeBtn = btn;
      });
      activeBtn?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    }

    async function loadDemo(demoId, { pushUrl = false } = {}) {
      const demo = demoMap.get(demoId) || SHOWCASE_DEMOS[0];
      if (demo.id === activeDemoId && activePlayer) return;
      activeDemoId = demo.id;
      syncTabs(demo.id);

      if (pushUrl) {
        const url = new URL(window.location.href);
        if (demo.id === SHOWCASE_DEMOS[0].id) url.searchParams.delete('demo');
        else url.searchParams.set('demo', demo.id);
        window.history.pushState({ demo: demo.id }, '', url);
      }

      const mountEl = document.getElementById('encore-showcase-player');
      if (!mountEl || !window.EncorePlayer) return;
      const seq = ++loadSeq;
      activePlayer?.getController()?.destroy();
      activePlayer = null;

      try {
        const lang = getLangFromLocation();
        const player = await window.EncorePlayer.create(mountEl, demo.src, lang ? { lang } : {});
        if (seq !== loadSeq) {
          player?.getController()?.destroy();
          return;
        }
        activePlayer = player;
      } catch (err) {
        if (seq === loadSeq) {
          mountEl.innerHTML = '<div class="encore-load-error">Failed to load demo replay.</div>';
        }
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-demo-id]').forEach(btn => {
        btn.addEventListener('click', () => loadDemo(btn.dataset.demoId, { pushUrl: true }));
      });
      window.addEventListener('popstate', () => loadDemo(getDemoFromLocation(), { pushUrl: false }));
      loadDemo(getDemoFromLocation(), { pushUrl: false });
    });

    document.getElementById('encore-copy-btn')?.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText('npx @niracler/encore@latest')
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
