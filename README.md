<p align="center">
  <img src="./docs/hero-en.svg" alt="Encore · Replay an AI Agent session to see how it worked and what it delivered." width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com/?lang=en"><strong>Live Demos (encore.niracler.com)</strong></a> ·
  <a href="https://www.npmjs.com/package/@niracler/encore"><strong>npm</strong></a> ·
  <a href="./README.md"><strong>English</strong></a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@niracler/encore"><img src="https://img.shields.io/npm/v/@niracler/encore?style=flat-square&color=c2410c" alt="npm version"></a>
  <a href="https://github.com/niracler/encore/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/niracler/encore/ci.yml?branch=main&style=flat-square&label=CI" alt="CI status"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.10-334155?style=flat-square" alt="Node.js >= 20.10">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT License"></a>
</p>

**Encore** is like [`asciinema`](https://asciinema.org) for AI Agent sessions. Locally, it turns a raw log from **Codex**, **Claude Code**, **Claude.ai**, or **WorkBuddy** into a portable web replay. Readers can step through turns, tool calls, sub-agents, frames, and deliverables while watching the context snapshot grow and compact in real time.

![Encore Player showing the Step timeline on the left and the live Context Snapshot inspector on the right](./docs/preview-en.webp)

---

## Quick Start

Requires **Node.js >= 20.10**. No global install needed.

```bash
npx @niracler/encore@latest
```

Choose a recent session to open its replay in your browser.

---

## How It Works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-en-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-en-light.webp">
    <img src="./docs/architecture-en-light.webp" alt="Encore architecture: from raw Agent logs and referenced local files in Asset Roots to a portable Replay and standalone Player" width="100%">
  </picture>
</p>

- **Local-only processing**: Adapters, WebP frame extraction, and automatic redaction all run locally in Node.js. Nothing is uploaded.
- **Decoupled Session and Player**: `session.json`, extracted `.webp` frames, and collected files sit beside the zero-dependency player, so curation edits appear on browser reload.
- **Explicit file collection (`main`, unreleased)**: On `main` ([Unreleased](./CHANGELOG.md#unreleased)), Encore collects locally referenced attachments and deliverables within allowed asset roots, generates in-place PDF and workbook previews, and labels each file as verified (matching SHA-256), an export-time copy, or missing. Quick Start runs npm release `0.2.0`, which extracts only embedded media and inline `.md` documents.

---

## Curating Before Publishing (Optional)

For personal review or internal archiving, the CLI export is ready to watch as-is—no skill needed.

Before publishing a replay to a blog, course, or showcase, raw exports usually need an editorial pass: picking milestone frames, writing a clear title and opening description, trimming off-topic turns, and removing internal names that regex cannot catch. Because that requires reading context and inspecting images, Encore ships a companion `encore` skill for your Agent:

| Stage | Handled by | What it does |
| --- | --- | --- |
| **Export** | Encore CLI (deterministic) | Converts the raw log, extracts `.webp` frames, redacts common secrets, paths, emails, and private IPs, and builds a standalone replay |
| **Curate** | Agent + `encore` skill (semantic) | Inspects and labels milestone frames, writes the title and opening description, redacts internal codenames, names, and figures, trims off-topic turns, and rebuilds the replay |

Install the skill globally (or copy [`skills/encore/SKILL.md`](./skills/encore/SKILL.md) manually):

```bash
npx skills add niracler/encore -g
```

Then ask your Agent from any workspace:

```text
Use the encore skill to export my latest session and curate it for publishing.
```

**Before sharing**: Automatic redaction only rewrites `session.json`; it never modifies copied PDFs, workbooks, images, or videos in `attachments/`. Review `session.json`, every kept `.webp` frame, and all packaged attachments and deliverables before publishing.

---

## Embedding on Any Site

Deploy the generated replay directory to GitHub Pages, Cloudflare Pages, Vercel, or any static host—or embed the player in an existing HTML page with three lines:

```html
<link rel="stylesheet" href="./encore-player.css">
<div data-encore-player src="./session.json" data-lang="en"></div>
<script src="./encore-player.js" defer></script>
```

Omit `data-lang` to follow the language set in `session.json`.

<details>
<summary><strong>CLI Reference &amp; <code>session.json</code> Schema</strong></summary>

### CLI Options

The interactive picker scans `~/.codex/sessions`, `~/.claude/projects`, and `~/.workbuddy/projects`. You can also pass a `.jsonl` or `.jsonl.zst` raw log, or a Claude.ai `conversations.json` export directly.

```text
Usage:
  encore                              Scan recent Codex, Claude Code & WorkBuddy sessions and pick one interactively
  encore <log.jsonl | dir> [options]  Build a replay from a raw log, or rebuild an existing replay directory
  encore play <dir> [--port 4180]     Start local preview server for an existing replay directory

Options:
  -o, --out <dir>          Output directory (default: temporary directory on main; ./replays/<session-slug> in 0.2.0)
      --asset-root <dir>   Set allowed asset roots for attachments and deliverables (repeatable; unreleased on main)
  -l, --lang <zh|en|auto>  Player UI language (default: auto; also toggleable in the topbar)
      --title <text>       Override session title
      --desc <text>        Set opening description shown before playback starts
      --from <iso-time>    Start time window filter (e.g. 2026-11-10T09:00)
      --to <iso-time>      End time window filter
      --no-images          Skip extracting embedded images to .webp
      --image-width <px>   Max width for extracted WebP frames (default: 960)
      --clip <chars>       Max chars per tool input/output (default: 1500/2000)
      --conversation <id>  Conversation UUID for multi-chat Claude.ai exports
      --include-memory     Include full cross-session MEMORY_SUMMARY and user-level CLAUDE.md text (omitted by default)
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

<details>
<summary><strong>FAQ</strong></summary>

**Does Encore upload my logs? How does redaction work?**
No. Everything runs locally. During export, automatic redaction hides common API keys, private keys, JWTs, database credentials, emails, private IPs, and home directory paths (`~`). Cross-session `MEMORY_SUMMARY` and user-level `CLAUDE.md` bodies are omitted by default, and the leak check flags suspicious internal domains or URL token parameters without blocking export. Project codenames, business figures, and sensitive content inside frames, attachments, or deliverables still require manual review.

**Will deleting the original log or workspace files break a replay?**
Everything packaged inside the replay directory (`session.json`, `.webp` frames, `attachments/`, and player files) stays playable after the raw log or workspace files are removed. Keep the replay directory intact; links to external URLs still depend on their hosts.

**Why doesn't double-clicking `index.html` (`file://`) work?**
The player loads `./session.json` with `fetch()`, which browsers block on `file://` URLs for security reasons. Preview locally with `npx @niracler/encore@latest play ./replays/<session-slug>`, or serve the folder from any static host.

**Why is an attachment or deliverable missing, or marked as an export-time copy?**
On `main` (unreleased), Encore collects locally referenced files from messages and handoff tools within allowed asset roots (defaulting to the current directory and native session workspace; override with `--asset-root`). Files written silently by shell commands may not be referenced, and missing files keep only their filename in place. When a file is found, the player marks it as verified only if its SHA-256 matches a digest recorded during the session; otherwise it is labeled as an export-time copy.

**Are the context-window token counts exact billing figures?**
No—context snapshots visualize structure and growth rather than provider billing. When a raw log records actual token counts (including `preTokens` and `postTokens` around compactions), Encore displays them directly; when per-step totals or the 7 context categories are missing, Encore estimates proportions from content length.

**What if a raw replay is too long or has too many frames?**
Pass `--from` and `--to` (ISO timestamps) to slice a specific time window during export. You can also curate `frames[]`, `items[]`, `title`, and `description` in `session.json`, then run `npx @niracler/encore@latest ./replays/<session-slug>` to rebuild player assets, sync `<title>`, drop references to deleted frames, and re-run the leak check. Rebuilding an existing replay preserves curation edits and added media, whereas re-importing from the raw log regenerates `.webp` frames.

</details>

---

## Contributing & License

Architecture notes and development commands live in [`AGENTS.md`](./AGENTS.md), and shared domain terminology lives in [`GLOSSARY.md`](./GLOSSARY.md). Run `pnpm test` before opening a pull request to verify adapters, redaction rules, and player build sync. To request support for another Agent format, open an issue.

[MIT](./LICENSE)
