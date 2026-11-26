# Changelog

All notable changes to `@niracler/encore` will be documented in this file.

## [Unreleased]

## [0.4.0] - 2026-11-26

### Added
- Import Antigravity App and CLI sessions with reference images, browser screenshots and files submitted for review.
- Browse local sessions by Agent and search titles and first prompts across history, including identifiable archived sessions.
- The Japan travel map Replay preserves the CLI-generated title, Frame labels, and event order, with sensitive content masked and both original-sound films available.

### Changed
- Clicking a message or moving the timeline pauses the Player at that Step. Playback resumes with the next Step. Image and document previews preserve the current position.
- The segmented timeline marks Frames, documents, Turns, and Compactions. Labels adapt to the available width. Touch and keyboard navigation use the same playback position.
- The showcase opens each Replay on its own page with a link back to the case directory. Existing shared links continue to open the same Replay.

## [0.3.0] - 2026-11-20

### Changed
- The default output for raw log imports moved from `./replays/<slug>` to a unique, owner-only directory in the OS temporary directory. To keep a replay, choose an output directory explicitly, for example `encore session.jsonl -o ./replays/my-session`.

### Added
- Replays collect locally referenced attachments at the message or tool call that delivered them. The Player distinguishes files verified against a recorded SHA-256, copies found at export, and missing originals.
- Packaged PDFs and workbooks open inside the Player. A curated revision can compare a specific PDF line or spreadsheet cell, and videos with a portrait cut can switch formats at the current time.
- The CLI shows a progress indicator while building a replay in a terminal. The standalone Player displays a loading message while it reads the session.

### Fixed
- Replies containing nested Markdown code fences now render correctly. These replies could previously freeze the browser before the playback controls appeared.
- The context inspector is visible on the mobile showcase, and playback keyboard shortcuts apply only when focus is inside the Player.

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

[Unreleased]: https://github.com/niracler/encore/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/niracler/encore/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/niracler/encore/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/niracler/encore/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/niracler/encore/releases/tag/v0.1.0
