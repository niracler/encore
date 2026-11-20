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

选择一段最近的会话，浏览器就会打开回放。

---

## 工作原理

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-zh-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-zh-light.webp">
    <img src="./docs/architecture-zh-light.webp" alt="Encore 处理架构：从原始 Agent 日志与资产根目录内的本地文件，到可独立托管的回放目录与零依赖播放器" width="100%">
  </picture>
</p>

- **全本地离线运行**：日志适配、WebP 画面帧转码与自动脱敏都在本地 Node.js 环境中完成，不上传任何数据。
- **会话数据与播放器分离**：`session.json`、提取出的 `.webp` 画面帧和收录文件与零依赖播放器同目录存放，整理修改后刷新页面即可生效。
- **明确的文件收集边界（`main` 未发布）**：在 `main` 分支（[未发布更新](./CHANGELOG.md#unreleased)）中，Encore 会收集资产根目录内日志明确引用的附件与交付物，生成 PDF 与表格的页内预览，并在原消息下标注「已核对版本」「导出时的副本」或「原文件缺失」。上方快速开始命令运行的是 npm 已发布的 `0.2.0` 版本，仅提取内嵌媒体与内联 `.md` 文稿。

---

## 发布前整理（可选）

如果只是个人复盘或内部留档，CLI 导出的回放已经可以直接看，不需要安装技能。

如果要把回放公开发布到博客、课程或展示页，原始导出通常还需要一轮整理：筛选关键画面帧、撰写清晰的标题与开场说明、裁剪无关轮次，并去掉正则识别不出的内部名称与业务细节。这些步骤需要读懂上下文和查看图片，因此 Encore 配套提供了给 Agent 使用的 `encore` 技能：

| 阶段 | 执行方式 | 完成的工作 |
| --- | --- | --- |
| **导出** | Encore CLI（确定性处理） | 转换原始日志、提取 `.webp` 画面帧，对常见密钥、本机路径、邮箱与内网 IP 自动脱敏，并生成独立回放 |
| **整理** | Agent + `encore` 技能（语义整理） | 逐张查看并标注里程碑画面帧、撰写标题与开场说明、脱敏内部代号、人名与业务数据、裁剪无关轮次，并重建回放 |

全局安装该技能（或手动复制 [`skills/encore/SKILL.md`](./skills/encore/SKILL.md)）：

```bash
npx skills add niracler/encore -g
```

之后在任意工作区直接告诉 Agent：

```text
用 encore 技能把我刚才那段对话导出并整理一下。
```

**公开分享前请复核**：自动脱敏只改写 `session.json`，不会修改 `attachments/` 中复制进来的 PDF、工作簿、图片或视频原件。发布前请检查 `session.json`、保留的 `.webp` 画面帧，以及所有打包的附件和交付物。

---

## 嵌入网页

将生成的回放目录部署到 GitHub Pages、Cloudflare Pages、Vercel 或任意静态托管服务即可直接访问，也可通过 3 行代码嵌入已有 HTML 页面：

```html
<link rel="stylesheet" href="./encore-player.css">
<div data-encore-player src="./session.json" data-lang="zh"></div>
<script src="./encore-player.js" defer></script>
```

省略 `data-lang` 时，界面语言自动跟随 `session.json` 的设置。

<details>
<summary><strong>CLI 参数与 <code>session.json</code> 结构</strong></summary>

### CLI 参数

会话选择器扫描 `~/.codex/sessions`、`~/.claude/projects` 和 `~/.workbuddy/projects`。也可以直接传入 `.jsonl`、`.jsonl.zst` 日志或 Claude.ai 导出的 `conversations.json`。

```text
用法：
  encore                              扫描本机最近的 Codex、Claude Code 与 WorkBuddy 会话，上下键选择导出
  encore <log.jsonl | dir> [options]  从原始日志生成回放目录，或重建已有回放目录
  encore play <dir> [--port 4180]     启动本地预览服务

常用参数：
  -o, --out <dir>          输出目录（main 默认为系统临时目录；0.2.0 为 ./replays/<会话短名>）
      --asset-root <dir>   指定允许收集附件与交付物的资产根目录，可重复使用（main 未发布功能）
  -l, --lang <zh|en|auto>  界面语言（默认：auto，网页右上角也可一键切换）
      --title <text>       自定义回放标题
      --desc <text>        自定义开场导读说明
      --from <iso-time>    起始时间切片（如 2026-11-10T09:00）
      --to <iso-time>      结束时间切片
      --no-images          不提取内嵌图片
      --image-width <px>   提取的 WebP 最大宽度（默认：960）
      --clip <chars>       单条工具输入/输出最大保留字符数（默认：1500/2000）
      --conversation <id>  Claude.ai 多会话导出包中指定会话 UUID
      --include-memory     保留完整的跨会话 MEMORY_SUMMARY 与用户级 CLAUDE.md 正文（默认省略正文）
      --list               仅列出本机最近会话，不进入交互菜单
      --serve              生成后启动本地预览服务
      --no-serve           生成文件后直接退出，不启动本地预览服务
      --no-open            启动预览服务时不自动打开浏览器
  -p, --port <number>      本地预览端口（默认：4180）
  -v, --version            显示版本号
  -h, --help               显示帮助信息
```

### `session.json` 核心字段

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

<details>
<summary><strong>常见问题（FAQ）</strong></summary>

**日志会上传吗？隐私和密钥怎么处理？**
不会。所有处理都在本地完成。导出时，自动脱敏会隐藏常见 API 密钥、私钥、JWT、数据库连接串、邮箱、内网 IP 与本机用户目录路径（替换为 `~`）；跨会话 `MEMORY_SUMMARY` 与用户级 `CLAUDE.md` 默认省略正文，泄露检查会对疑似内网域名与 URL 凭据参数发出非阻塞提示。项目代号、业务数据，以及画面帧、附件和交付物原件中的敏感内容仍需人工复核。

**导出后删除原始日志或工作区文件，会影响回放吗？**
已经打包进回放目录的内容（`session.json`、`.webp` 画面帧、`attachments/` 与播放器文件）不依赖原始日志和原工作区。保持整个回放目录完整即可；指向外部网站的链接仍依赖原地址。

**为什么双击 `index.html`（`file://` 协议）无法播放？**
播放器通过 `fetch('./session.json')` 加载数据，浏览器安全策略会拦截 `file://` 协议下的本地请求。本地预览请运行 `npx @niracler/encore@latest play ./replays/<会话短名>`；部署到静态托管服务后即可直接访问。

**为什么有些附件或交付物显示缺失，或标为导出时的副本？**
在 `main` 分支（未发布）中，Encore 会从允许的资产根目录（默认为当前工作目录与原始会话工作区，可用 `--asset-root` 覆盖）收集消息和交付工具明确引用的本地文件。由脚本直接写入磁盘且未被显式引用的文件不会自动收集；若引用的原文件已不存在，原消息下仍会保留文件名并提示缺失。找到文件后，只有 SHA-256 与会话记录的校验值一致时才会标明版本已核对，否则标明为导出时的副本。

**右侧上下文面板的 Token 数值是实际账单数字吗？**
不是。上下文快照用于观察上下文结构与增长趋势，不替代服务商账单。原始日志包含真实 Token 统计（含压缩前后的 `preTokens` 与 `postTokens`）时，面板直接显示记录值；缺少步级统计或 7 个上下文分类明细时，按内容长度估算占比。

**原始回放太长或画面帧太多，如何精简？**
导出时可用 `--from` 与 `--to` 按 ISO 时间范围切片。也可以直接整理 `session.json` 中的 `frames[]`、`items[]`、`title` 与 `description`，再运行 `npx @niracler/encore@latest ./replays/<会话短名>` 重建播放器文件、同步页面 `<title>`、清理无效画面帧引用并重新运行泄露检查。重建不会覆盖手工整理与新增媒体；若从原始日志重新导出到同一目录，则会重新提取 `.webp` 画面帧。

</details>

---

## 参与贡献与开源协议

架构说明与开发命令见 [`AGENTS.md`](./AGENTS.md)，统一领域术语见 [`GLOSSARY.md`](./GLOSSARY.md)。提交改动前运行 `pnpm test` 验证适配器、脱敏规则与播放器构建产物一致性；如需支持其他 AI Agent 日志格式，欢迎提交 Issue。

[MIT](./LICENSE)
