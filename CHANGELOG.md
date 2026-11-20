# Changelog

All notable changes to `@niracler/encore` will be documented in this file.

## [Unreleased]

### Changed
- Importing a raw log without `-o` / `--out` now writes preview files to the OS temporary directory instead of `./replays/<slug>` in the current working directory.

### Added
- Replays collect locally referenced attachments at the message or tool call that delivered them. The Player distinguishes files verified against a recorded SHA-256, copies found at export, and missing originals.
- Packaged PDFs and workbooks open inside the Player. A curated revision can compare a specific PDF line or spreadsheet cell, and videos with a portrait cut can switch formats at the current time.

## [0.2.0] - 2026-11-19

### Changed
- The minimum supported Node.js version is now 20.10.0.
- Pre-rendered stages accept course navigation and attach playback controls to embedded session data.

### Added
- **WorkBuddy Adapter (`src/workbuddy.mjs`)**: Auto-detects WorkBuddy `.jsonl` transcripts, scans `~/.workbuddy/projects` in the interactive session picker, and mounts WorkBuddy system prompt templates.
- **Formal Data Contract & Types**: Added JSON Schema Draft 2020-12 (`schema/session.schema.json`) and TypeScript declarations (`src/index.d.ts`).
- **Live Showcase Site (`encore.niracler.com`)**: Added `scripts/build-site.mjs`, curated showcase `site/session.json`, and GitHub Pages workflow (`.github/workflows/pages.yml`).
- **CI & Governance**: Added GitHub Actions test matrix (`.github/workflows/ci.yml`), `AGENTS.md`, and bundle synchronization assertions.
- **Interactive Session Picker Pagination**: Paginate recent local sessions (`←`/`→` or `h`/`l`) with on-demand log inspection.

### Fixed
- WorkBuddy replays use WorkBuddy's tool list when the log omits tool schemas.
- Codex document previews keep each Markdown file in a multi-file patch separate, including files with the same name in different directories.

## [0.1.0] - 2026-11-17

### Added
- Initial release of `@niracler/encore` with three-layer architecture (`session.json` + `.webp`, standalone `encore-player.js` + `encore-player.css`, and `encore` CLI).
- Support for OpenAI Codex (`rollout-*.jsonl`), Claude Code (`projects/*.jsonl`), and Claude.ai (`conversations.json`) exports.
- Live 7-bucket Context Window inspector, compaction handoff boundaries, sub-agent report modals, WebP frame extraction, and automatic privacy redaction.
- Bilingual (`zh` / `en`) UI and companion curation skill (`skills/encore/SKILL.md`).
