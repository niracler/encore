<p align="center">
  <img src="./docs/hero-zh.svg" alt="Encore · 回看一次 AI Agent 会话，看它怎么完成任务，交付了什么。" width="100%">
</p>

<p align="center">
  <a href="https://encore.niracler.com/?demo=poster-redesign&amp;lang=zh"><strong>演示啦演示</strong></a> ·
  <a href="./README.md">English</a>
</p>

[![课程海报设计回放：左侧是对话和草图，右侧是当时的上下文](./docs/preview-zh.webp)](https://encore.niracler.com/?demo=poster-redesign&lang=zh)

## 回看自己的会话

```bash
npx @niracler/encore@latest
```

需要 Node.js 20.10 或更高版本。选中本机最近的一段 Codex、Claude Code 或 WorkBuddy 会话，浏览器就会打开回放。要回看 Claude.ai 会话，把导出的 `conversations.json` 路径传给同一条命令即可。

回放默认写入系统临时目录。想保留下来，可以在命令末尾加上 `-o ./my-replay`。

## 工作原理

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/architecture-zh-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="./docs/architecture-zh-light.webp">
    <img src="./docs/architecture-zh-light.webp" alt="Encore 处理架构：从原始 Agent 日志与资产根目录内的本地文件，经 CLI 自动导出与可选的发布前整理，生成可独立托管的回放目录与零依赖播放器" width="100%">
  </picture>
</p>

## 常见问题

<details>
<summary>日志会上传吗？分享前要检查什么？</summary>

导出在本机完成。Encore 会在 `session.json` 中隐藏常见密钥、邮箱和本机路径。公开前请检查对话、截图和附件，尤其是项目代号和业务数据。PDF、表格等附件会按原样复制。

需要挑选截图、裁剪对话或写导读时，可以安装 [Encore 技能](./skills/encore/SKILL.md)，然后告诉 Agent：「把我刚才的会话整理成可以分享的回放。」

```bash
npx skills add niracler/encore -g
```

</details>

<details>
<summary>怎样重新打开保存的回放？</summary>

如果用 `-o ./my-replay` 保存过回放，运行：

```bash
npx @niracler/encore@latest play ./my-replay
```

这会启动本地预览服务。直接双击 `index.html` 时，浏览器可能会拦截对 `session.json` 的读取。

</details>

<details>
<summary>删掉原始日志后还能回放吗？</summary>

可以。保留整个回放目录即可，已收录的附件也在里面。外部链接仍依赖原地址。

</details>

<details>
<summary>怎样把回放嵌入自己的网页？</summary>

将整个回放目录上传到静态网站即可单独访问。要嵌入已有页面，引入目录中的三个文件（示例假设目录名为 `my-replay`）：

```html
<link rel="stylesheet" href="./my-replay/encore-player.css">
<div data-encore-player src="./my-replay/session.json" data-lang="zh"></div>
<script src="./my-replay/encore-player.js" defer></script>
```

自定义回放数据可查阅 [JSON Schema](./schema/session.schema.json) 和 [TypeScript 类型](./src/index.d.ts)。

</details>

<details>
<summary>附件旁边的状态是什么意思？</summary>

「已核对版本」表示文件的 SHA-256 与日志记录一致。「导出时的副本」表示找到了文件，但无法确认它与会话当时的版本一致。「原文件缺失」或「未收录」表示文件找不到或在允许收集的目录之外。可以用 `--asset-root` 指定收集目录。

</details>

<details>
<summary>上下文里的 Token 数能用来核对账单吗？</summary>

这些数值用于观察会话中的上下文变化。日志提供统计时使用记录值，缺少的步骤或分类明细按内容长度估算。

</details>

[开发与贡献](./AGENTS.md) · [术语表](./GLOSSARY.md) · [npm](https://www.npmjs.com/package/@niracler/encore) · [MIT](./LICENSE)
