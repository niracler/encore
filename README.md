<p align="center">
  <img src="./docs/hero-en.svg" alt="Encore · Replay an AI Agent session to see how it worked and what it delivered." width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com/?demo=poster-redesign&amp;lang=en"><strong>Watch Codex redesign a course poster</strong></a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

[![Course poster replay with the conversation, a sketch and the context at that step](./docs/preview-en.webp)](https://encore.niracler.com/?demo=poster-redesign&lang=en)

## Replay your own session

```bash
npx @niracler/encore@latest
```

Requires Node.js 20.10 or later. Choose a local Codex, Claude Code, WorkBuddy or Antigravity session to open its replay in your browser. Press `Tab` to switch agents and `/` to search titles and first user messages in the current tab. Search includes identifiable archived sessions. `Esc` restores your previous position.

Antigravity App and CLI share a tab with the source shown on each row. The picker prefers `transcript_full.jsonl` and falls back to `transcript.jsonl`. Passing a path imports exactly that file. The picker reads the Antigravity index using Node’s built-in SQLite or a local `sqlite3` executable. If the index is unavailable, it uses transcripts and title annotations and cannot identify archives recorded only in the index. For Claude.ai, pass the path to your exported `conversations.json` to the same command.

Encore writes to a temporary directory by default. To keep the replay, add `-o ./my-replay` to the command.

## How it works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-en-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-en-light.webp">
    <img src="./docs/architecture-en-light.webp" alt="Encore architecture: from raw Agent logs and referenced local files in Asset Roots, through automatic CLI export and optional pre-publish Curation, to a portable Replay and standalone Player" width="100%">
  </picture>
</p>

## FAQ

<details>
<summary>Does Encore upload my logs? What should I check before sharing?</summary>

Export runs locally. Encore redacts common secrets, email addresses and local paths in `session.json`. Before publishing, review the conversation, screenshots and attachments for details such as internal project names or business figures. PDFs, spreadsheets and other attachments are copied as they are.

To pick screenshots, trim the conversation or write an introduction, install the [Encore skill](./skills/encore/SKILL.md) and ask your agent to prepare your latest session for sharing.

```bash
npx skills add niracler/encore -g
```

</details>

<details>
<summary>How do I reopen a saved replay?</summary>

If you saved it with `-o ./my-replay`, run:

```bash
npx @niracler/encore@latest play ./my-replay
```

This starts a local preview server. Opening `index.html` directly can cause the browser to block access to `session.json`.

</details>

<details>
<summary>Can I delete the original log after exporting?</summary>

Yes. Keep the entire replay directory, which includes the collected attachments. External links still depend on their original hosts.

</details>

<details>
<summary>How do I embed a replay on my site?</summary>

Upload the entire replay directory to a static host to give it its own URL. To embed it in an existing page, point these three lines at your replay directory:

```html
<link rel="stylesheet" href="./my-replay/encore-player.css">
<div data-encore-player src="./my-replay/session.json" data-lang="en"></div>
<script src="./my-replay/encore-player.js" defer></script>
```

To customize the replay data, see the [JSON Schema](./schema/session.schema.json) and [TypeScript types](./src/index.d.ts).

</details>

<details>
<summary>What do the attachment labels mean?</summary>

A verified file matches the SHA-256 checksum recorded in the log. An export-time copy was found on disk, but its contents could not be verified against the session. A missing or excluded file could not be found or was outside the allowed directories. Use `--asset-root` to specify a directory to collect files from.

</details>

<details>
<summary>Can I use the context token counts to check my bill?</summary>

The counts show how the context changes during a session. Encore uses recorded counts where available and estimates missing step or category counts from content length.

For native Antigravity sessions, Encore reads the recorded system instructions and tool definitions from the first model request. The opening estimate (`≈`) counts system-side groups and excludes the first user message. Missing usage and window limits are labeled separately. Completed checkpoints appear on the timeline at their recorded times.

</details>

[Contributing](./AGENTS.md) · [Glossary](./GLOSSARY.md) · [npm](https://www.npmjs.com/package/@niracler/encore) · [MIT](./LICENSE)
