<p align="center">
  <img src="./docs/hero-en.svg" alt="Encore — Curtain Call for AI Agents" width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com"><strong>Live Demos (encore.niracler.com) ↗</strong></a> ·
  <a href="https://www.npmjs.com/package/@niracler/encore"><strong>npm ↗</strong></a> ·
  <a href="./README.md"><strong>English</strong></a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@niracler/encore"><img src="https://img.shields.io/npm/v/@niracler/encore?style=flat-square&color=c2410c" alt="npm version"></a>
  <a href="https://github.com/niracler/encore/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/niracler/encore/ci.yml?branch=main&style=flat-square&label=CI" alt="CI status"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.10-334155?style=flat-square" alt="Node.js >= 20.10">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT License"></a>
</p>

**Encore** is like [`asciinema`](https://asciinema.org) for AI agent sessions. It compiles raw transcripts from **Codex**, **Claude Code**, **Claude.ai**, and **WorkBuddy** into a self-contained web replay—complete with a live context-window inspector, tool-call traces, sub-agent handoffs, and visual milestones.

![Encore Preview](./docs/preview-en.webp)

- **Conversation & artifacts (left)**: Streaming replies, collapsible tool batches, sub-agent reports, inline `.md` drafts, and extracted `.webp` frames.
- **Live Context X-Ray (right)**: Real-time `200k` / `1.0M` token gauge split across 7 context buckets, auto-compaction markers, and click-to-inspect raw payloads at any step.
- **Milestone timeline (bottom)**: Step-by-step scrubber pinned with visual keyframes (`🖼`), written documents (`📄`), context compactions (`🗜`), and user prompts (`💬`).

---

## Live Demos

Explore five real sessions across all four supported agents at **[encore.niracler.com](https://encore.niracler.com)** (includes an instant `EN / 中文` UI toggle in the top-right corner):

| Demo | Agent | Highlights |
| :--- | :--- | :--- |
| [Design & Ship Encore](https://encore.niracler.com/) | **Codex** | English walkthrough of building Encore, with Context X-Ray, compaction, and sub-agents |
| [Poster Redesign](https://encore.niracler.com/?demo=poster-redesign) | **Codex** | Visual poster iteration across 7 `.webp` frames plus a live auto-compaction boundary |
| [Site Integration](https://encore.niracler.com/?demo=work-stages-site) | **Claude Code** | 4 sub-agents, 5 visual frames, and a live debugging fix for a broken page script |
| [7-Stage Diagram Redesign](https://encore.niracler.com/?demo=work-stages-design) | **Claude.ai** | Web export (`conversations.json`) exploring 5 layout directions across 9 drafts |
| [Open-Source Research: x-cmd](https://encore.niracler.com/?demo=xcmd-research) | **WorkBuddy** | 4 parallel sub-agents researching a public project from scratch |

---

## Quick Start

Requires **Node.js >= 20.10**. No global install needed—these commands run the `latest` release from npm:

```bash
# 1. Interactive picker — scans ~/.codex/sessions, ~/.claude/projects & ~/.workbuddy/projects
#    Use ↑ / ↓ to select and ← / → to flip pages
npx @niracler/encore@latest

# 2. Export a specific log — auto-detects .jsonl, .jsonl.zst, and Claude.ai conversations.json
npx @niracler/encore@latest /path/to/rollout.jsonl -o ./replays/my-session

# 3. After editing ./replays/my-session/session.json, re-run on the folder to sync <title>
#    and re-check for sensitive strings:
npx @niracler/encore@latest ./replays/my-session

# 4. Preview any exported replay folder locally on http://localhost:4180
npx @niracler/encore@latest play ./replays/my-session
```

By default, Encore creates a self-contained folder under `./replays/<session-slug>/` containing `session.json`, deduplicated `*.webp` frames, `index.html`, `encore-player.js`, and `encore-player.css`.

---

## How It Works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-en-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-en-light.webp">
    <img src="./docs/architecture-en-light.webp" alt="Encore architecture pipeline: from raw agent logs to a portable, curated replay" width="100%">
  </picture>
</p>

- **Offline compiler, zero backend**: Logs are parsed locally in Node.js. Nothing is uploaded, proxied, or sent to an external server.
- **Decoupled data and player**: `session.json` and extracted `.webp` frames stay separate from the zero-dependency player bundle, so you can edit titles, descriptions, or frames directly without rebuilding code.
- **Explicit boundary for external deliverables**: Media embedded in raw logs (Base64 screenshots, inline `.md` writes, context records, sub-agent reports) is extracted automatically. External workspace files created on disk (`.mp3` voiceovers, `.mp4` videos, posters, PDFs) are never auto-scraped by the CLI—copy and mount only what you choose to publish.

---

## Curating a Replay (Director's Cut)

Raw agent runs often include dozens of repetitive tweak screenshots, a long opening prompt instead of a readable title, and project-specific names that regex redaction cannot recognize.

Copy or link [`skills/encore/SKILL.md`](./skills/encore/SKILL.md) into `.agents/skills/encore` (or `~/.codex/skills/encore` / `~/.claude/skills/encore`), then ask your agent:

```text
Use the encore skill to export my latest session and curate session.json for publishing.
```

The skill guides the agent through four focused passes:

- **Prune & label `.webp` frames**: Inspects extracted images, removes broken or duplicate tweaks, and writes concise milestone labels.
- **Write a clear title & intro**: Sets top-level `title` and `description` so readers understand the goal and turning point before pressing Play.
- **Semantic privacy cleanup**: Spots internal codenames, people's names, or private URLs that regex rules miss and replaces them with `(Internal context redacted)`.
- **Trim off-topic tails**: Slices out unrelated setup or follow-up chatter with `--from` / `--to` or direct edits to `items[]`.

---

## Embedding in Blogs & Docs

Upload the generated folder to any static host (GitHub Pages, Cloudflare Pages, Vercel, S3) or drop three lines into an existing HTML page:

```html
<link rel="stylesheet" href="./encore-player.css">
<div data-encore-player src="./session.json" data-lang="en"></div>
<script src="./encore-player.js" defer></script>
```

Omit `data-lang` to auto-detect the UI language from `session.json`.

<details>
<summary><strong>CLI Reference &amp; <code>session.json</code> Schema</strong></summary>

### CLI Options

```text
Usage:
  encore                              Scan recent Codex, Claude Code & WorkBuddy sessions and pick one interactively
  encore <log.jsonl | dir> [options]  Build a standalone replay directory from a log or re-render an edited session.json
  encore play <dir> [--port 4180]     Start local preview server for an existing replay directory

Options:
  -o, --out <dir>          Output directory (default: ./replays/<session-slug>)
  -l, --lang <zh|en|auto>  Player UI language (default: auto; also toggleable in the topbar)
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
  -h, --help               Show help message
```

### `session.json` Schema

Formal JSON Schema: [`schema/session.schema.json`](./schema/session.schema.json) (`https://encore.niracler.com/schema/session.schema.json`) · TypeScript Definitions: [`src/index.d.ts`](./src/index.d.ts)

```json
{
  "$schema": "https://encore.niracler.com/schema/session.schema.json",
  "tool": "codex",
  "model": "gpt-5.4",
  "title": "Redesigning the 7-Stage Architecture Diagram",
  "description": "Started with a cluttered layout, pivoted to a two-column grid after visual review, and exported the final SVG.",
  "lang": "en",
  "contextWindow": 258400,
  "deliverables": [{ "title": "Final Diagram", "href": "./final-diagram.webp", "meta": "SVG / WebP · 1920×1080" }],
  "frames": [{ "time": "2026-11-17T10:04:12.000Z", "img": "a1b2c3d4e5f6.webp", "who": "ai", "label": "Draft 1", "w": 960, "h": 540 }],
  "items": [
    { "type": "user", "text": "...", "time": "..." },
    { "type": "tool", "name": "exec_command", "summary": "...", "stats": { "command": 1 }, "time": "..." },
    { "type": "compact", "seq": 1, "trigger": "auto", "preTokens": 210000, "postTokens": 42000, "time": "..." },
    { "type": "assistant", "text": "...", "time": "..." }
  ]
}
```

</details>

---

## FAQ

**Does Encore upload my logs? How does privacy redaction work?**
No. Everything runs locally on your machine. During export, Encore masks API keys, private keys, JWTs, database credentials, emails, private IPs, and home directory paths (`~`), folds cross-session `MEMORY_SUMMARY` and user-level `CLAUDE.md` by default, and warns about suspicious internal domains or query tokens. Regex cannot catch internal project codenames, colleague names, business numbers, or sensitive content visible inside screenshots—always review `session.json` and extracted `.webp` frames before publishing publicly.

**Where does Encore create files, and what breaks if I delete the original log or workspace?**
Without `-o`, Encore writes a self-contained folder at `./replays/<session-slug>/` in your current working directory. Everything inside the raw log (turns, context records, inline `.md` writes, and extracted `.webp` frames) is copied into that folder, so deleting the original `.jsonl` log afterwards will not break the replay. However, external workspace files that were never embedded in the log (such as `.mp3` voiceovers, `.mp4` videos, or PDFs generated by shell commands) are not auto-copied; if you delete them before copying them into the replay folder, they will be missing.

**Why doesn't double-clicking `index.html` (`file://`) work?**
The player loads `./session.json` with `fetch()`, which browsers block under `file://` due to CORS restrictions. Preview locally with `npx @niracler/encore@latest play ./replays/<slug>`, or host the folder on any static web server.

**Why didn't some screenshots, audio clips, or final videos show up automatically?**
Encore only extracts images that were actually passed through the model session as Base64 payloads. Files written only to disk via shell tools—as well as Claude.ai's `conversations.json` web export, which omits uploaded images and rendered artifacts—do not contain binary media in the transcript. The player supports `.mp3` (`item.audio`), `.mp4` + cover, and poster/link cards natively; copy those files into the replay folder and reference them in `session.json` during curation.

**Are the Context Window token counts exact billing figures?**
When a log records real token usage (including `preTokens` and `postTokens` around compactions), Encore displays those numbers directly. When per-step counts or per-bucket breakdowns are absent from the raw log, Encore estimates proportions from text length so you can inspect context structure and growth trends—not replace provider billing dashboards.

**What if a raw session is too long or full of noisy screenshots?**
Use `--from` and `--to` (ISO timestamps) to slice a focused time window, or edit `frames[]` and `items[]` directly in `session.json` and run `npx @niracler/encore@latest ./replays/<slug>` to re-sync `<title>` and clean up unreferenced frame links. Re-syncing a replay folder preserves your manual edits and mounted media (whereas re-importing from the raw `.jsonl` into the same directory refreshes generated `.webp` files).

---

## Contributing & License

Architecture notes and development commands live in [`AGENTS.md`](./AGENTS.md). Run `pnpm test` to verify adapters, privacy redaction, and player bundle sync, or open an issue to request support for another AI agent log format.

[MIT](./LICENSE)
