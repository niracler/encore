<p align="center">
  <img src="./docs/hero-zh.svg" alt="Encore：AI Agent 会话返场剧场" width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com/?lang=zh"><strong>在线演示（encore.niracler.com）↗</strong></a> ·
  <a href="https://www.npmjs.com/package/@niracler/encore"><strong>npm ↗</strong></a> ·
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@niracler/encore"><img src="https://img.shields.io/npm/v/@niracler/encore?style=flat-square&color=c2410c" alt="npm 版本"></a>
  <a href="https://github.com/niracler/encore/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/niracler/encore/ci.yml?branch=main&style=flat-square&label=CI" alt="CI 状态"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.10-334155?style=flat-square" alt="Node.js >= 20.10">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT 协议"></a>
</p>

**Encore** 是面向 AI Agent 会话的 [`asciinema`](https://asciinema.org)。Encore 在本地将 **Codex**、**Claude Code**、**Claude.ai** 和 **WorkBuddy** 的原始日志转换为可独立托管的交互网页。打开回放后，读者可以按时间轴逐步查看对话、工具调用、子 Agent 协作与过程截图，并在右侧同步观察上下文窗口的增长与压缩。

![Encore 界面预览：左侧为会话时间轴，右侧为实时上下文检查面板](./docs/preview-zh.webp)

---

## 在线演示

[在线展示站](https://encore.niracler.com/?lang=zh)首页收录 4 段回放：前两段记录《AI 七十年，长成一棵树》从首版到定稿的视频制作过程（默认打开首版），后两段对比 Codex 与 WorkBuddy 完成同一项海外照明采购方调研的过程。页面、播放器和案例导读支持中英文切换，对话内容保留原文。

| 案例 | Agent | 看点 |
| :--- | :--- | :--- |
| [《AI 七十年》从构思到首版](https://encore.niracler.com/?lang=zh) | **Claude.ai** | 派发 7 个子 Agent 核对史实、准备讲稿，完成 4 分 10 秒的首版视频 |
| [《AI 七十年》从反馈到定稿](https://encore.niracler.com/?demo=ai-tree-1015&lang=zh) | **Claude.ai** | 根据反馈补充历史照片并调整术语讲解，交付横屏与竖屏成片 |
| [海外照明采购方调研](https://encore.niracler.com/?demo=lesson-00-buyers-codex&lang=zh) | **Codex** | 派发 3 个子 Agent 分头调研德国、英国和澳大利亚市场，整理出 26 家潜在客户 |
| [海外照明采购方调研](https://encore.niracler.com/?demo=lesson-00-buyers-workbuddy&lang=zh) | **WorkBuddy** | 重新分派 3 个因额度用尽而中断的调研任务，整理出 32 家潜在客户 |

其他回放可通过直链打开：

| 案例 | Agent | 看点 |
| :--- | :--- | :--- |
| [大改课程海报：三套视觉提案](https://encore.niracler.com/?demo=poster-redesign&lang=zh) | **Codex** | 记录 7 张 `.webp` 过程图，并在中途触发一次上下文自动压缩 |
| [把新版七阶段图接入课件与站点](https://encore.niracler.com/?demo=work-stages-site&lang=zh) | **Claude Code** | 派发 4 个子 Agent 协作接入课件与站点，含 5 张过程截图及页面脚本故障修复 |
| [嫌太难看，重做「七阶段图」](https://encore.niracler.com/?demo=work-stages-design&lang=zh) | **Claude.ai** | 导入网页导出包（`conversations.json`），探索 6 套版式方向并迭代 9 稿 |
| [横纵分析开源工具 x-cmd](https://encore.niracler.com/?demo=xcmd-research&lang=zh) | **WorkBuddy** | 并行派发 4 个子 Agent 检索公开资料，整理出结构化研究报告 |

---

## 快速开始

需要 **Node.js >= 20.10**，无需全局安装：

```bash
# 交互选择：自动扫描 ~/.codex/sessions、~/.claude/projects 与 ~/.workbuddy/projects
# 按 ↑ / ↓ 选择会话，← / → 翻页
npx @niracler/encore@latest

# 指定单个日志导出：自动识别 .jsonl、.jsonl.zst 与 Claude.ai 的 conversations.json
npx @niracler/encore@latest /path/to/rollout.jsonl -o ./replays/my-session

# 启动本地预览服务（默认 http://localhost:4180）
npx @niracler/encore@latest play ./replays/my-session
```

未指定 `-o` 时，Encore 默认在当前目录生成 `./replays/<会话短名>/`，内含 `session.json`、去重后的 `*.webp` 图片、`index.html`、`encore-player.js` 和 `encore-player.css`。

---

## 工作原理

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-zh-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-zh-light.webp">
    <img src="./docs/architecture-zh-light.webp" alt="Encore 处理流水线：从原始 Agent 日志到本地可托管的交互回放" width="100%">
  </picture>
</p>

- **全本地离线运行**：日志解析、WebP 图片转码与基础脱敏全部在本地 Node.js 环境中完成，不上传任何数据。
- **数据与播放器分离**：`session.json` 与提取出的 `.webp` 图片独立于零依赖播放器之外，修改文案或删减截图后刷新页面即可生效，无需重新构建。
- **媒体边界明确**：CLI 仅自动提取日志内嵌的 Base64 图片与 `.md` 文稿；工作区磁盘上额外生成的 `.mp3`、`.mp4`、海报和 PDF 等外部文件不会自动采集，需要发布时手动复制到回放目录并在 `session.json` 中引用。

---

## 发布前整理（可选）

原始导出往往保留大量中间截图，默认以首条提问作为标题，且正则表达式无法识别项目内部代号等隐性敏感信息。将 [`skills/encore/SKILL.md`](./skills/encore/SKILL.md) 复制到 `.agents/skills/encore`（或 `~/.codex/skills/encore`、`~/.claude/skills/encore`）后，可以让 Agent 协助筛选并命名截图、撰写标题与开场说明、清理隐性敏感信息，并按需裁剪无关对话：

```text
用 encore 技能把我刚才那段对话导出并整理一下。
```

手动编辑 `session.json` 后，对回放目录运行 `npx @niracler/encore@latest ./replays/my-session`，即可同步页面 `<title>`、清理已删除截图的引用并重新检查敏感信息。对已有回放目录重新运行不会覆盖手工修改或手动添加的媒体文件。

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

```text
用法：
  encore                              扫描本机最近的 Codex、Claude Code 与 WorkBuddy 会话，上下键选择导出
  encore <log.jsonl | dir> [options]  从原始日志一步生成回放目录，或对已修改的目录重新同步
  encore play <dir> [--port 4180]     启动本地预览服务

常用参数：
  -o, --out <dir>          输出目录（默认：./replays/<会话短名>）
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
不会。所有处理都在本地完成。导出时，Encore 会自动脱敏常见 API 密钥、私钥、JWT、数据库连接串、邮箱、内网 IP 与本机用户目录路径（替换为 `~`）。跨会话 `MEMORY_SUMMARY` 与用户级 `CLAUDE.md` 默认省略正文，疑似内网域名和 URL 凭据参数会输出提示。由于正则表达式无法识别项目代号、同事姓名、业务数据以及截图画面中的敏感信息，公开发布前仍需人工复核 `session.json` 与保留的 `.webp` 图片。

**导出后删除原始日志或原工作区文件，会影响回放吗？**
删除原始日志不会影响回放，但删除未复制的外部媒体文件会导致对应资源无法加载。原始日志中的内容（对话、上下文、内联 `.md` 文稿与提取出的 `.webp` 图片）会全部写入 `./replays/<会话短名>/`，因此导出后可以安全删除原始 `.jsonl` 文件。仅保存在工作区磁盘上的外部成品（如 `.mp3` 旁白、`.mp4` 视频、海报或 PDF）不会被自动复制；删除原文件前，需先将这些文件复制到回放目录并在 `session.json` 中使用相对路径引用。

**为什么双击 `index.html`（`file://` 协议）无法播放？**
播放器通过 `fetch('./session.json')` 加载数据，浏览器安全策略会拦截 `file://` 协议下的本地请求。本地预览请运行 `npx @niracler/encore@latest play ./replays/<会话短名>`；部署到静态托管服务后即可直接访问。

**为什么有些截图、音频或视频没有自动出现？**
Encore 仅能提取以 Base64 形式进入过模型对话或工具返回内容的图片。由脚本直接写入磁盘且未回传给模型的媒体文件，以及 Claude.ai 网页导出的 `conversations.json`（官方导出包不包含上传图片与 Artifact 渲染图），在日志中均不包含对应二进制数据。播放器原生支持步骤音频（`item.audio`）、`.mp4` 视频与交付物卡片，可在整理阶段将文件复制到回放目录并在 `session.json` 中引用。

**右侧上下文面板的 Token 数值是实际账单数字吗？**
不是。上下文面板用于观察上下文构成和增长趋势，不替代服务商账单。原始日志包含真实 Token 统计（含压缩前后的 `preTokens` 与 `postTokens`）时，面板直接显示记录值；缺少步级统计或 7 类分桶明细时，按内容长度估算占比。

**原始回放太长或截图太多，如何精简？**
导出时可使用 `--from` 与 `--to` 按 ISO 时间范围截取片段。也可以直接编辑 `session.json` 中的 `frames[]`、`items[]`、`title` 与 `description`，再对目录运行 `npx @niracler/encore@latest ./replays/<会话短名>`，同步页面 `<title>` 并清理无效引用。对已有回放目录重新同步不会覆盖手工修改与手动添加的媒体文件；若重新从原始 `.jsonl` 导出到同一目录，则会重新生成 `.webp` 图片。

</details>

---

## 参与贡献与开源协议

架构说明与开发命令见 [`AGENTS.md`](./AGENTS.md)。提交改动前运行 `pnpm test` 验证解析器、脱敏规则与播放器产物一致性；如需支持其他 AI Agent 日志格式，欢迎提交 Issue。

[MIT](./LICENSE)
