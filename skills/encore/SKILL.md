---
name: encore
description: >
  Export, curate, and polish AI Agent session replays (Codex, Claude Code, Claude.ai) into standalone web stage replays using Encore.
  Use when the user asks to export a session replay, polish/curate a generated `session.json`, prune and label `.webp` process screenshots, write a replay title and story intro, or clean up semantic privacy leaks before publishing.
---

# Encore — AI Agent Session Replay & Curation Skill

`encore` turns raw AI Agent logs (`Codex`, `Claude Code`, `Claude.ai`) into an interactive web replay stage (**Left**: streaming conversation, tool shimmer, sub-agents, and visual deliverables; **Right**: live Context Window inspector and compaction boundaries; **Bottom**: milestone timeline).

While `npx @niracler/encore` produces an immediately playable replay ("raw cut / 生肉"), this skill guides you through turning it into a curated, publication-ready showcase ("director's cut / 熟肉").

---

## Workflow

### 1. Locate or Generate the Initial Replay Folder

- If the user hasn't specified a log file yet, list recent local sessions:
  ```bash
  npx @niracler/encore --list
  ```
- Export the target session into a replay directory (without blocking on the preview server):
  ```bash
  npx @niracler/encore <path-to-log.jsonl> -o ./replays/<slug> --no-serve
  ```
- This produces:
  - `session.json` — self-contained replay data & metadata (`title`, `description`, `deliverables`, `frames`, `items`)
  - `*.webp` — deduplicated embedded images extracted from the session
  - `index.html`, `encore-player.js`, `encore-player.css` — standalone web player (`<div data-encore-player src="./session.json"></div>`)

---

### 2. Visual Frame Curation & Naming (`frames[]`)

Raw sessions often contain 15–40 screenshots, including terminal errors, minor CSS tweaks, or duplicate checks.

1. **Inspect every image**: Use `view_image` (or `Read`) to visually inspect each `.webp` file listed in `session.json -> frames`.
2. **Prune noise**: Delete entries from `session.json -> frames` that are broken renders, repetitive micro-adjustments, or uninformative screenshots. Keep **3 to 12 key visual milestones** that clearly show the evolution from reference/sketch to final output.
3. **Write narrative labels**: Replace generic fallback labels (`过程产出 #1` / `Stage Output #1`) with concrete 6–16 character labels that tell the viewer what changed:
   - Good: `"第一张草图：信息过载"`, `"V2：改为深色双栏网格"`, `"终稿：定版课程海报"`
   - Bad: `"图片 1"`, `"修改后"`, `"赋能视觉升级版"`

---

### 3. Title & Story Intro (`title` & `description`)

Edit the top-level `title` and `description` in `session.json` following these **direct, anti-fluff writing rules**:

1. **`title` (8–24 chars)**:
   - State the concrete task, turning point, or friction directly.
   - Good: `"嫌太难看，重新设计七阶段图"`, `"把内部播放器拆成开源工具 Encore"`, `"排查 Mesh 40940 冲突并补齐测试"`
   - Avoid empty buzzwords (`赋能`, `深度剖析`, `全方位重构`, `探索与实践`, `基于 AI 的…`).
2. **`description` (1–3 sentences, 40–120 chars)**:
   - Shown on the empty stage before the viewer clicks **Play**.
   - Explain **what problem the session tackled**, **what key pivot or collaboration happened mid-way**, and **what outcome was reached**.
   - Write in plain, natural prose. Do not repeat the title word-for-word.

---

### 4. Semantic Privacy & Time-Window Cleanup (`items[]`)

`encore` automatically masks home paths (`~`), API keys (`[密钥]`), emails (`[邮箱]`), and private IPs (`[内网地址]`), and prints non-blocking warnings for suspicious strings.

1. **Check CLI warnings**: Inspect any paths reported by `encore` under `Privacy check found ... potential sensitive snippet(s)`.
2. **Scan for semantic leaks across both `initialContext` and `items[]`**: Regex cannot catch internal company codenames, colleague names, private intranet hostnames, or confidential business numbers. Always inspect `initialContext.mem`, `initialContext.sys`, `items[type="compact"].text`, and `items[]`, replacing sensitive passages with a clear marker such as:
   - `（涉及内部业务细节，已略去）` or `(Internal context redacted)`
3. **Trim off-topic tails**: If the user chatted about an unrelated topic at the beginning or end of the same window, either re-run `npx @niracler/encore <log.jsonl> --from <ISO> --to <ISO> -o <dir> --no-serve` or remove the off-topic entries from `session.json -> items`.

---

### 5. Re-render & Verify

- Because `index.html` dynamically mounts `<div data-encore-player src="./session.json"></div>`, any edits to `session.json` take effect immediately on browser refresh.
- Run `npx @niracler/encore ./replays/<slug> --no-serve` once after editing `session.json` so `index.html`'s `<title>` tag is synced and the privacy leak check runs cleanly against your curated JSON.
- To launch a live local preview for the user:
  ```bash
  npx @niracler/encore play ./replays/<slug>
  ```
