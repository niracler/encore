<p align="center">
  <img src="./docs/hero-zh.svg" alt="Encore · 回看一次 AI Agent 会话，看它怎么完成任务，交付了什么。" width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com/?lang=zh"><strong>在线演示（encore.niracler.com）</strong></a> ·
  <a href="https://www.npmjs.com/package/@niracler/encore"><strong>npm</strong></a> ·
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@niracler/encore"><img src="https://img.shields.io/npm/v/@niracler/encore?style=flat-square&color=c2410c" alt="npm 版本"></a>
  <a href="https://github.com/niracler/encore/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/niracler/encore/ci.yml?branch=main&style=flat-square&label=CI" alt="CI 状态"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.10-334155?style=flat-square" alt="Node.js >= 20.10">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT 协议"></a>
</p>

**Encore** 是面向 AI Agent 会话的 [`asciinema`](https://asciinema.org)。它在本地将 **Codex**、**Claude Code**、**Claude.ai** 或 **WorkBuddy** 的原始日志转换为可独立托管的网页回放。打开回放后，读者可以按步骤查看对话轮次、工具调用、子 Agent 协作、画面帧与交付物，并在右侧同步查看上下文快照的增长与压缩。

![Encore 播放器预览：左侧为会话步骤时间轴，右侧为实时上下文快照面板](./docs/preview-zh.webp)

---

## 快速开始

需要 **Node.js >= 20.10**，无需全局安装。

```bash
npx @niracler/encore@latest
```

命令会扫描本机最近的 **Codex**、**Claude Code** 与 **WorkBuddy** 会话，选中后在浏览器中打开回放；也可以直接传入 `.jsonl`、`.jsonl.zst` 或 Claude.ai 导出的 `conversations.json`。

未传 `-o` 时，回放默认写入系统临时目录；需要保存可移植副本或部署时，传入 `-o <目录>`。完整子命令与选项见 `npx @niracler/encore@latest --help`。

---

## 工作原理

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-zh-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-zh-light.webp">
    <img src="./docs/architecture-zh-light.webp" alt="Encore 处理架构：从原始 Agent 日志与资产根目录内的本地文件，经 CLI 自动导出与可选的发布前整理，生成可独立托管的回放目录与零依赖播放器" width="100%">
  </picture>
</p>

- **全本地离线运行**：日志适配、`.webp` 画面帧转码、自动脱敏与泄露检查都在本地 Node.js 环境中完成，不上传任何数据。
- **会话数据与播放器分离**：`session.json`、提取出的 `.webp` 画面帧与收录文件都与零依赖播放器同目录存放，编辑 `session.json` 后刷新页面即可生效。
- **明确的文件收集边界**：自动收集允许的资产根目录（默认为当前工作目录与原始会话工作区，可用 `--asset-root` 覆盖）内日志明确引用的附件与交付物，生成 PDF 与表格的页内预览，并在原消息下标注「已核对版本」「导出时的副本」或「原文件缺失」。

---

## 发布前整理（可选）

个人复盘或内部留档时，CLI 导出的回放已经可以直接观看，不需要安装技能。准备公开发布到博客、课程或展示页时，可以配合 `encore` 技能在导出结果上做一轮语义整理。

**CLI 自动导出已完成**

- 转换原始日志，提取去重 `.webp` 画面帧，收集资产根目录内引用的附件与交付物并生成页内预览
- 对常见密钥、私钥、JWT、数据库连接串、邮箱、内网 IP 与本机路径自动脱敏，默认省略 `MEMORY_SUMMARY` 与用户级 `CLAUDE.md` 正文，并输出非阻塞泄露检查预警
- 打包独立的回放目录与零依赖播放器

**`encore` 技能负责发布前整理**

- **筛选与标注画面帧**：逐张查看 `.webp` 画面帧，剔除报错与冗余中间态，只保留里程碑画面并写清变化标签
- **撰写导读与裁剪轮次**：结合上下文撰写标题（`title`）与开场说明（`description`），删去首尾无关轮次
- **人工脱敏与附件复核**：处理泄露检查预警，清理正则识别不出的内部代号、人名与业务数据，并核对 `attachments/` 中的原件
- **无损重建同步**：整理完成后运行 `npx @niracler/encore@latest <回放目录>`，刷新播放器与预览、同步页面 `<title>`、清理已删画面帧引用并重跑泄露检查（保留整理修改与补充媒体）

全局安装该技能（或手动复制 [`skills/encore/SKILL.md`](./skills/encore/SKILL.md)）：

```bash
npx skills add niracler/encore -g
```

之后在任意工作区直接告诉 Agent：

```text
用 encore 技能把我刚才那段对话导出并整理一下。
```

> **公开分享前请复核**：自动脱敏只改写 `session.json`，不会修改 `attachments/` 中复制进来的 PDF、工作簿、图片或视频原件。发布前请检查 `session.json`、保留的 `.webp` 画面帧以及所有打包的附件和交付物。

---

## 嵌入网页

使用 `-o ./replays/<会话短名>` 导出后，将整个回放目录部署到 GitHub Pages、Cloudflare Pages、Vercel 或任意静态托管服务即可直接访问，也可通过 3 行代码嵌入已有 HTML 页面：

```html
<link rel="stylesheet" href="./encore-player.css">
<div data-encore-player src="./session.json" data-lang="zh"></div>
<script src="./encore-player.js" defer></script>
```

省略 `data-lang` 时，界面语言自动跟随 `session.json` 的设置。播放器同时原生支持在 `session.json` 中手动挂载步骤音频（`item.audio`）、横竖屏视频切换与 PDF / 表格修订对照。

<details>
<summary><strong><code>session.json</code> 核心结构</strong></summary>

JSON Schema 规范：[`schema/session.schema.json`](./schema/session.schema.json)（`https://encore.niracler.com/schema/session.schema.json`）；TypeScript 类型声明：[`src/index.d.ts`](./src/index.d.ts)。

```json
{
  "$schema": "https://encore.niracler.com/schema/session.schema.json",
  "tool": "codex",
  "model": "gpt-5.4",
  "title": "定下像素风和红发主角·课程海报视觉探索",
  "description": "从信息过载的第一版草图出发，确立三阶段路线图，最终定版像素风课程海报。",
  "lang": "zh",
  "contextWindow": 258400,
  "deliverables": [{ "title": "定版课程海报", "href": "./final-poster.webp", "meta": "WebP · 1920×1080" }],
  "frames": [{ "time": "2026-11-17T10:04:12.000Z", "img": "a1b2c3d4e5f6.webp", "who": "ai", "label": "像素风草图", "w": 960, "h": 540 }],
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

## 常见问题

### 日志会上传吗？隐私怎么处理？

**不会，全部在本地运行。**

- **自动脱敏**：隐藏常见密钥、私钥、JWT、数据库连接串、邮箱、内网 IP 与本机用户目录（替换为 `~`），默认省略 `MEMORY_SUMMARY` 与用户级 `CLAUDE.md` 正文，并输出非阻塞泄露检查预警。
- **需人工复核**：项目代号、业务数据，以及 `attachments/` 里复制进来的原件（PDF、工作簿、图片、视频）不会被自动改写。

### 为什么双击 `index.html` 无法播放？

浏览器安全策略会拦截 `file://` 协议下的 `fetch('./session.json')` 请求。用本地预览服务打开，或部署到任意静态托管即可：

```bash
npx @niracler/encore@latest play ./replays/<会话短名>
```

### 导出后删掉原始日志或原文件，回放会坏吗？

**不会。** 回放目录是自包含的静态包（`session.json`、`.webp` 画面帧、`attachments/` 与播放器文件），保持整个目录完整即可；只有外链 URL 仍依赖原地址。

### 为什么附件会标为「导出时的副本」或「原文件缺失」？

- **已核对版本**：文件在允许的资产根目录内找到，且 SHA-256 与日志记录一致。
- **导出时的副本**：文件在导出时找到了，但日志里没有可比对的摘要或内容已变化。
- **原文件缺失 / 未收录**：日志引用了该文件，但导出时在磁盘上已找不到，或位于资产根目录之外（可用 `--asset-root` 补充目录；原消息下会保留文件名）。

### 上下文快照里的 Token 数值是实际账单吗？

**不是。** 它用于观察上下文结构与增长趋势：原始日志带真实统计（含压缩前后 `preTokens` / `postTokens`）时直接显示，缺失步级或分类明细时按内容长度估算。

---

## 参与贡献与开源协议

架构说明与开发命令见 [`AGENTS.md`](./AGENTS.md)，统一领域术语见 [`GLOSSARY.md`](./GLOSSARY.md)。提交改动前运行 `pnpm test` 验证适配器、脱敏规则与播放器构建产物一致性；如需支持其他 AI Agent 日志格式，欢迎提交 Issue。

[MIT](./LICENSE)
