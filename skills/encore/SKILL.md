---
name: encore
description: >
  Export, curate, and rebuild portable AI Agent replays (Codex, Claude Code, Claude.ai, WorkBuddy, Antigravity App and CLI) with Encore.
  Use when the user asks to export a Raw Log into a Replay, curate `session.json`, select and label `.webp` Frames, review packaged Attachments or Deliverables, write a title and opening description, or redact residual sensitive details before publishing.
---

# Encore — Session Replay & Curation Skill

Encore turns a Raw Log from **Codex**, **Claude Code**, **Claude.ai**, **WorkBuddy**, or **Antigravity** into a portable **Replay** rendered by the standalone **Player** (**Left**: Turns, Tool calls, Sub-agents, Attachments, Deliverables, and Frames; **Right**: live Context Snapshot inspector and Compaction boundaries; **Bottom**: Step timeline).

While `npx @niracler/encore@latest` builds an immediately playable Replay, this skill guides **Curation** before publishing.

---

## Workflow

### 1. Export the Initial Replay

- If the user has not specified a Raw Log yet, list recent local sessions:
  ```bash
  npx @niracler/encore@latest --list
  ```
- Export the target Raw Log into an explicit Replay directory with `-o` so it is saved outside the default temporary preview directory, without blocking on the preview server (pass `--asset-root <dir>` if referenced Attachments or Deliverables live outside the current working directory and native session workspace):
  ```bash
  npx @niracler/encore@latest <path-to-log.jsonl> -o ./replays/<slug> --no-serve
  ```
- Output files:
  - `session.json` — canonical **Session** data (`title`, `description`, `initialContext`, `deliverables`, `frames`, `items`)
  - `*.webp` — deduplicated embedded **Frames** extracted from the Raw Log
  - `attachments/` — collected **Attachments** and **Deliverables** within allowed **Asset Roots**, plus generated PDF/XLSX previews when applicable
  - `index.html`, `encore-player.js`, `encore-player.css` — standalone **Player** (`<div data-encore-player src="./session.json"></div>`)

---

### 2. Curate & Label Frames (`frames[]`)

Raw exports often contain 15–40 Frames, including terminal errors, minor tweaks, or duplicate views.

1. **Inspect every image**: Use `view_image` (or `Read`) to visually inspect each `.webp` file listed in `session.json -> frames`.
2. **Keep key milestones**: Remove broken renders, repetitive micro-adjustments, or uninformative entries from `session.json -> frames`. Keep **3 to 12 milestone Frames** showing progression from reference to final result.
3. **Write concrete labels**: Replace fallback labels (`过程画面 #1` / `Agent Frame #1`) with concrete 6–16 character labels stating what changed:
   - Good: `"第一张草图：信息过载"`, `"V2：改为深色双栏网格"`, `"终稿：定版课程海报"`
   - Bad: `"图片 1"`, `"修改后"`, `"赋能视觉升级版"`

---

### 3. Write Title & Opening Description (`title` & `description`)

Edit the top-level `title` and `description` in `session.json`:

1. **`title` (8–24 chars)**:
   - State the concrete task, turning point, or friction directly.
   - Good: `"嫌太难看，重新设计七阶段图"`, `"把内部播放器拆成开源工具 Encore"`, `"排查 Mesh 40940 冲突并补齐测试"`
   - Skip empty buzzwords (`赋能`, `深度剖析`, `全方位重构`, `探索与实践`, `基于 AI 的…`).
2. **`description` (1–3 sentences, 40–120 chars)**:
   - Shown in the **Player** before the viewer clicks **Play**.
   - State **what problem the Session tackled**, **what key pivot or Sub-agent collaboration happened**, and **what Deliverable or outcome was reached**.
   - Write plain, direct prose without repeating the title.

---

### 4. Redaction, Packaged Files, & Turn Trimming

Automatic **Redaction** rewrites `session.json` to hide home paths (`~`), API keys (`[密钥]`), emails (`[邮箱]`), and private IPs (`[内网地址]`), and prints non-blocking **Leak Check** warnings.

1. **Review Leak Check warnings**: Inspect every path reported under `Leak check found ... potential sensitive snippet(s)`.
2. **Redact residual sensitive details in `initialContext` and `items[]`**: Regex cannot catch internal codenames, colleague names, intranet hostnames, or business figures. Inspect `initialContext.mem`, `initialContext.sys`, `items[type="compact"].text`, and `items[]`, replacing sensitive passages with a clear marker such as `（涉及内部业务细节，已略去）` or `(Internal context redacted)`.
3. **Inspect packaged Attachments and Deliverables (`attachments/`)**: Automatic Redaction only rewrites `session.json`; it does not modify packaged PDFs, spreadsheets, images, or videos. Verify each collected file before publishing, and remove or replace any file that contains private data.
4. **Trim off-topic Turns**: If the Raw Log starts or ends with an unrelated topic, either re-export with `--from <ISO> --to <ISO>` or remove those Events from `session.json -> items`.

---

### 5. Rebuild & Verify

- Because `index.html` loads `./session.json` at runtime, edits to `session.json` appear immediately on browser refresh.
- Run a **Rebuild** after editing `session.json` so Encore refreshes Player assets, syncs `<title>`, refreshes attachment previews, drops references to deleted Frames, and re-runs the **Leak Check** without re-importing the Raw Log or overwriting Curation edits:
  ```bash
  npx @niracler/encore@latest ./replays/<slug> --no-serve
  ```
- Launch a local preview for the user:
  ```bash
  npx @niracler/encore@latest play ./replays/<slug>
  ```
