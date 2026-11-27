# AGENTS.md

Repository guidelines for AI coding agents working on `@niracler/encore`.

## 1. Three-Layer Architecture

Encore strictly separates data, browser player, and CLI tooling:

1. **Data Layer (`session.json` + `.webp`)**:
   - Formalized in [`schema/session.schema.json`](./schema/session.schema.json) and typed in [`src/index.d.ts`](./src/index.d.ts).
   - Log adapters (`src/codex.mjs`, `src/claude-code.mjs`, `src/claude-ai.mjs`, `src/workbuddy.mjs`) normalize raw transcripts into this single intermediate representation via `createTranscript()` in `src/common.mjs`.
2. **Standalone Browser Player (`player/encore-player.js` + `player/encore-player.css`)**:
   - Zero runtime dependencies. Mounts on `<div data-encore-player src="./session.json"></div>`.
   - Built by concatenating `src/i18n.mjs`, `src/markdown.mjs`, `src/timeline.mjs`, `src/render.mjs`, and `src/player-runtime.mjs` via `buildStandalonePlayerJs()` in `src/player-assets.mjs`.
   - Never import `node:*` built-ins or external npm packages inside those 5 browser-shared modules.
3. **CLI & Node Pipeline (`bin/encore.mjs`, `src/detect.mjs`, `src/images.mjs`, `src/redact.mjs`, `src/server.mjs`)**:
   - Handles format auto-detection, interactive session picking, `sharp` WebP extraction, regex privacy redaction, and local preview serving.

## 2. Build & Sync Discipline

- **Rebuild Player Bundle**: `player/encore-player.js` is a generated bundle built automatically on `prepare`, `prepack`, `pretest`, and `build:site` (or manually via `pnpm run build:player`) from `src/i18n.mjs`, `src/markdown.mjs`, `src/timeline.mjs`, `src/render.mjs`, and `src/player-runtime.mjs`:
  ```bash
  pnpm run build:player
  ```
  `test/encore.test.mjs` asserts that `player/encore-player.js` matches `buildStandalonePlayerJs({ write: false })`.
- **Keep Schema & Types Aligned**: When adding fields to `session.json` or changing public exports in `src/index.mjs`, update both `schema/session.schema.json` and `src/index.d.ts`.
- **Adapter Conformance Contract**: Every supported tool in `src/common.mjs` and `schema/session.schema.json` must be registered in `ADAPTER_CONTRACT` inside `test/adapter-conformance.test.mjs` with explicit capability flags (plus a reason for each `false` capability), a minimal fixture covering every `true` capability, and matching rows in the `README.md` / `README.zh-CN.md` capability tables. CI fails if a new agent adapter omits registration, breaks shared invariants, or leaves README tables out of sync.

## 3. Verification Commands

- Run unit, fixture, and bundle sync tests:
  ```bash
  pnpm test
  ```
- Build the static showcase site (`https://encore.niracler.com` -> `dist/site/`):
  ```bash
  pnpm run build:site
  ```

## 4. Git & Release Conventions

- Use English Conventional Commits (`feat(cli): ...`, `fix(player): ...`, `docs: ...`, `test: ...`).
- Do not run `git commit`, `git push`, or `pnpm publish` unless explicitly requested by the user.

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues (`niracler/encore`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
