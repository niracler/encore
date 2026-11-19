<p align="center">
  <img src="./docs/hero-zh.svg" alt="Encore — AI Agent 会话返场剧场" width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com"><strong>在线剧场 (encore.niracler.com) ↗</strong></a> ·
  <a href="https://www.npmjs.com/package/@niracler/encore"><strong>npm ↗</strong></a> ·
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

**Encore** 是面向 AI Agent 时代的 [`asciinema`](https://asciinema.org)。告别又糊又大的录屏视频与干瘪的 Markdown 聊天记录，将 **Codex**、**Claude Code**、**Claude.ai** 与 **WorkBuddy** 的原始会话日志，一键搬上可交互的独立网页舞台。

![Encore 界面预览](./docs/preview-zh.webp)

<table>
  <thead>
    <tr>
      <th width="33%" align="left">左屏 · 舞台实况</th>
      <th width="33%" align="left">右屏 · 上下文透视</th>
      <th width="33%" align="left">底部 · 关键帧时间轴</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td valign="top">输入框打字上屏、Markdown 呼吸流式回复、<code>12×</code> 工具调用流光快切、子代理派发报告与 <code>.webp</code> 过程效果图演进。</td>
      <td valign="top">实时显示 <code>200k</code> / <code>1.0M</code> 上下文水位、7 色分段进度条与压缩警戒线，点击任意色块或消息即可定格查看当时的原文载荷。</td>
      <td valign="top">按步切分的进度条，自动钉出过程效果图（<code>🖼</code>）、中间文稿（<code>📄</code>）、上下文压缩（<code>🗜</code>）与提问节点（<code>💬</code>）。</td>
    </tr>
  </tbody>
</table>

---

## 01 · 即兴返场（生肉直出）

以下命令使用 npm 上标记为 `latest` 的 Encore 版本。

```bash
# 1. 交互式选片 —— 自动扫描 ~/.codex/sessions、~/.claude/projects 与 ~/.workbuddy/projects
#    按 ↑ / ↓ 选择会话，← / → 翻页
npx @niracler/encore@latest

# 2. 指定日志直出 —— 自动识别 .jsonl / .jsonl.zst / Claude.ai .json
npx @niracler/encore@latest /path/to/rollout.jsonl -o ./replays/my-session

# 3. 直接手改 ./replays/my-session/session.json 并刷新浏览器即可生效；
#    对目录重跑命令可同步更新 <title> 并重新执行隐私检查：
npx @niracler/encore@latest ./replays/my-session
```

---

## 02 · 导演剪辑版（Agent 策展精修）

脚本一步导出的原始回放往往夹杂着几十张重复微调或报错截图，标题也只是第一句长提问。将 [`skills/encore/SKILL.md`](./skills/encore/SKILL.md) 放入 `.agents/skills/encore`（或 `~/.codex/skills/encore` / `~/.claude/skills/encore`），直接对 Agent 说：

```text
用 encore 技能把我刚才那段对话导出并精修一下。
```

- **看图筛片与命名**：多模态逐张检查 `.webp`，剔除报错图与重复微调图，为关键演进节点写好清晰的 `label`。
- **提炼标题与报幕导读**：在 `session.json` 顶层写出直奔主题的 `title` 与几十字的 `description` 开场脉络。
- **语义级隐私清理**：识别正则抓不到的内部代号、同事姓名或内网地址，替换为 `（涉及内部业务细节，已略去）`。
- **时间窗口切片**：掐掉会话首尾顺手聊的无关话题，只留完整讲好一件事的片段。

---

## 03 · 随处搭台（零依赖嵌入）

Encore 将数据（`session.json` + `.webp`）、纯前端播放器（`encore-player.js` + `encore-player.css`）与 CLI（`encore`）完全解耦。只需 3 行代码即可在任意博客或文档站搭起回放舞台：

```html
<link rel="stylesheet" href="./encore-player.css">
<div data-encore-player src="./session.json" data-lang="zh"></div>
<script src="./encore-player.js" defer></script>
```

<details>
<summary><strong>CLI 参数与 <code>session.json</code> 结构速查</strong></summary>

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
      --include-memory     保留完整的跨会话 MEMORY_SUMMARY / 用户级 CLAUDE.md 原文（默认自动折叠脱敏）
      --list               仅列出本机最近会话，不进入交互菜单
      --no-serve           生成文件后直接退出，不启动本地预览服务
  -v, --version            显示版本号
```

### `session.json` 核心字段

JSON Schema 规范：[`schema/session.schema.json`](./schema/session.schema.json)（`https://encore.niracler.com/schema/session.schema.json`）· TypeScript 类型声明：[`src/index.d.ts`](./src/index.d.ts)

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

## 开源协议

[MIT](./LICENSE)
