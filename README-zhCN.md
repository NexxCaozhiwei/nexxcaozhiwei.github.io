# 理想电波

个人静态博客，地址为 https://caozhiwei.com，当前页面风格基于 astro-theme-sify。

## 技术与功能

Astro 6、TypeScript、Tailwind CSS 4；支持 Markdown/MDX、分类、标签、归档、分页、RSS、深色模式、文章目录、阅读时间、代码复制、KaTeX 数学公式和 Shiki 代码高亮。

搜索范围为标题、摘要、分类、标签以及正文前 400 个字符。Waline 评论可选启用。

## 本地开发

使用 Node.js 22 和 pnpm 11，与部署工作流保持一致。

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
```

开发地址通常为 http://localhost:4321，构建输出在 `dist/`。

## 配置与目录

- `src/consts.ts`：站点信息、导航、社交链接、每页数量和评论服务地址。
- `astro.config.ts`：站点域名、Markdown 与构建配置。修改域名时同步更新 `src/consts.ts` 和两处 `CNAME`。
- `src/content.config.ts`：文章字段定义。
- `src/content/blog/`：文章源文件。
- `src/pages/`：页面和路由。
- `src/layouts/`、`src/components/`：布局和组件。
- `src/styles/global.css`：全局样式。
- `public/images/`：静态图片。
- `public/links.json`：友情链接。

## 添加文章

```sh
pnpm new-post my-post "我的文章标题"
```

脚本创建 `src/content/blog/my-post.md`，默认设为草稿。也可以手动创建：

```markdown
---
title: "我的文章标题"
description: "文章摘要"
date: 2026-09-30
tags: ["生活"]
category: "日志"
cover: "/images/my-post/cover.webp"
pinned: false
draft: true
---

文章正文。
```

`updated` 是可选的更新日期。发布时将 `draft` 改为 `false`；草稿不进入文章页面、列表、分类、标签、搜索、统计或 RSS。文章地址为 `/post/my-post/`，旧 `/posts/` 路径保留跳转。

## 评论

在 `src/consts.ts` 中设置 `walineServer` 为实际 Waline 服务地址即可显示评论。当前为空，因此未启用。项目不包含 Waline 服务端。

## 部署

`.github/workflows/deploy.yml` 在推送到 `main` 或手动触发时安装依赖、构建并部署到 GitHub Pages。自定义域名由 `public/CNAME` 随构建产物发布。
