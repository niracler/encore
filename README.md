# Encore

**Bring your AI agent sessions back on stage.**
*Like [`asciinema`](https://asciinema.org), but for AI Agent sessions (`Codex`, `Claude Code`, `Claude.ai`).*

[English](./README.md) · [简体中文](./README.zh-CN.md)

![Encore Preview](./docs/preview-en.webp)

---

## Why Encore?

Screen recordings of AI coding or design sessions are blurry, bulky, and unsearchable. Plain Markdown chat exports strip away everything that actually matters in an agentic workflow: **what was inside the context window, which tools and sub-agents ran, how visual artifacts evolved step by step, and when context compaction fired.**

**Encore** turns raw session logs from **OpenAI Codex**, **Claude Code**, and **Claude.ai** into an interactive, self-contained web stage:

| Stage Area | What It Shows |
| :--- | :--- |
| **Left · Conversation & Artifact Stage** | Typewriter prompt composer, soft-breathing Markdown reply streaming, live tool call shimmer (`1.0×` / `12×` / `0.8×`), sub-agent dispatches & reports, inline `.webp` visual outputs, intermediate Markdown drafts, and audio/video deliverables. |
| **Right · Live Context Window Inspector** | Real-time token gauge (`200k` / `1.0M`), 7-color stacked bar (`System Prompt`, `Tool Schemas & MCP`, `User Messages`, `Memory & Rules`, `Skills`, `Assistant`, `Tool Outputs`), auto-compaction headroom markers, and drill-down payload inspection for every step. |
| **Bottom · Segmented Milestone Timeline** | Interactive step segments with pinned visual frames (`🖼`), draft documents (`📄`), context compactions (`🗜`), and user turns (`💬`). |

---

## Architecture (Inspired by `asciinema`)

Encore separates data, player, and CLI into three clean layers:

1. **Data Format (`session.json` + `.webp`)**: A self-contained, human-editable JSON file (analogous to `.cast` in `asciinema`) holding metadata (`title`, `description`, `deliverables`), visual milestone `frames`, initial context mounts, and normalized conversation `items`.
2. **Standalone Player (`encore-player.js` + `encore-player.css`)**: Zero-dependency drop-in browser player. Any HTML page can embed a replay with a single tag:
   ```html
   <link rel="stylesheet" href="./encore-player.css">
   <div data-encore-player src="./session.json" data-lang="en"></div>
   <script src="./encore-player.js" defer></script>
   ```
3. **CLI (`encore`)**: Auto-detects `Codex`, `Claude Code`, and `Claude.ai` logs, extracts embedded images into `.webp`, redacts local paths & secrets, writes the static replay folder, and serves a live local preview.

---

## 30-Second Quick Start (Raw Cut)

### 1. Pick from your recent local sessions

Run `encore` with no arguments to scan `~/.codex/sessions` and `~/.claude/projects` and pick a recent session with `↑` / `↓`:

```bash
npx @niracler/encore
```

### 2. Convert a specific log file directly

Pass any `.jsonl` (or `.jsonl.zst` / Claude `.json` export) and Encore will auto-detect the format, extract embedded screenshots to `.webp`, mask sensitive strings, and launch a local preview:

```bash
npx @niracler/encore /path/to/rollout.jsonl -o ./replays/my-session
```

### 3. Edit `session.json` & refresh

Because `index.html` loads `./session.json` dynamically, **any edit you make to `session.json` (changing `title`, adding `description`, renaming or deleting `frames`) appears immediately when you refresh the browser.**

You can also re-run `encore` on an existing replay directory to sync `<title>` in `index.html` and re-run the privacy leak check:

```bash
npx @niracler/encore ./replays/my-session
```

---

## Agent Curation Workflow (Director's Cut)

Raw agent logs often contain 20+ repetitive screenshots, long first prompts instead of a clear title, or internal project names that regex redaction cannot catch.

Encore ships with an all-in-one Agent Skill at [`skills/encore/SKILL.md`](./skills/encore/SKILL.md). Install or link it into `.agents/skills/encore` (or `~/.codex/skills/encore` / `~/.claude/skills/encore`) and ask your agent:

> *"Use the `encore` skill to export my latest session and curate `session.json` for publishing."*

The skill guides the agent through four curation steps:
1. **Visual Frame Pruning & Naming**: Visually inspects every extracted `.webp` image, deletes broken or redundant screenshots from `frames[]`, and writes concise narrative labels (e.g. `"V1 wireframe"`, `"Final dark-mode layout"`).
2. **Title & Opening Story Intro**: Writes a punchy `title` and a 1–3 sentence `description` explaining the problem, mid-session pivot, and outcome without fluff.
3. **Semantic Privacy Cleanup**: Scans `items[]` for internal codenames, colleague names, or sensitive business logic and replaces them with `(Internal context redacted)`.
4. **Time-Window Trimming**: Cuts unrelated off-topic turns at the start or end of a session.

---

## `session.json` Schema Reference

```json
{
  "tool": "codex",
  "model": "gpt-5.4",
  "title": "Redesigning the 7-Stage Architecture Diagram",
  "description": "Started with a cluttered layout, pivoted to a two-column grid after visual review, and exported the final SVG.",
  "lang": "en",
  "started": "2026-11-17T10:00:00.000Z",
  "ended": "2026-11-17T10:18:30.000Z",
  "contextWindow": 258400,
  "deliverables": [
    {
      "title": "Final Architecture Diagram",
      "href": "./final-diagram.webp",
      "meta": "SVG / WebP · 1920×1080"
    }
  ],
  "frames": [
    {
      "time": "2026-11-17T10:04:12.000Z",
      "img": "a1b2c3d4e5f6.webp",
      "who": "ai",
      "label": "Draft 1: Overcrowded labels",
      "w": 960,
      "h": 540
    }
  ],
  "items": [
    { "type": "user", "text": "...", "time": "..." },
    { "type": "tool", "name": "exec_command", "summary": "...", "stats": { "command": 1 }, "time": "..." },
    { "type": "compact", "seq": 1, "trigger": "auto", "preTokens": 210000, "postTokens": 42000, "time": "..." },
    { "type": "assistant", "text": "...", "time": "..." }
  ]
}
```

---

## CLI Options

```text
Usage:
  encore                              Scan recent Codex & Claude Code sessions and pick one interactively
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

## License

[MIT](./LICENSE)
