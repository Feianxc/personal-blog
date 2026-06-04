# FEIAN 个人博客站点

这里是个人博客的前端工程目录，负责真正可运行的页面、样式、动效和构建。

## 页面入口

- `index.html`：首页
- `workflow.html`：工作流正文页
- `field.html`：现场排障正文页
- `lab.html`：项目实验室
- `archive.html`：归档页
- `about.html`：关于页
- `lab-html-canvas-signal.html`：HTML-in-Canvas / Pixi + GSAP 实验页
- 其他 `workflow-*`、`lab-*` 页面：项目/工作流详情页

## 目录结构

```text
site/
├─ public/            静态资源
├─ src/               React / TypeScript / CSS 源码
├─ scripts/           本地验证脚本
├─ logs/              预览与热更新日志；不交付
├─ reports/           Lighthouse/QA 报告；不交付
├─ dist/              本地构建输出；不作为默认交付边界
├─ *.html             Vite 多页面入口
└─ package.json       开发脚本
```

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
node ./scripts/verify-entry-frame-readwrite.mjs
```

## 正式交付构建方式

正式交付不要直接拿当前 `site/dist/`。请构建到独立 clean outDir，例如：

```bash
node ./node_modules/vite/bin/vite.js build --outDir ../deliverables/20260427-personal-blog-static-clean/dist --emptyOutDir
```

然后只从这个 clean outDir 生成 ZIP，并同步写入 README、SHA256 和验收报告。

## 不进入交付的内容

- `node_modules/`
- `logs/`
- `reports/`
- `dist/`（除非它是刚刚确认过的 clean build 目录，但推荐仍用 `deliverables/.../dist`）
- 本地 Chrome profile、Lighthouse cache、临时服务器日志
- 根目录 `progress.md` 与 `.workspace/`
