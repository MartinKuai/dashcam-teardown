# 源码与构建说明

本分支保存可独立安装和构建的源码，与 main 的静态发布历史完全分开。导入日期：2026-10-21。

## 环境和命令

- 本次验证：Node.js `v24.13.0`，npm `11.6.2`，Windows。
- 当前锁定的 Vite 声明 Node.js 要求为 `^20.19.0 || >=22.12.0`；其他 Node 版本未在本次验证。
- 在本仓库根目录安装：`npm ci`。本次用 `npm ci --ignore-scripts --no-audit --no-fund` 安装成功。
- 构建：`npm run build`，先运行 `tsc --noEmit`，再构建静态文件。
- 构建输出：`dist/`，不提交到 source 分支。
- 开发：`npm run dev`，地址 `http://localhost:5274/`。
- 构建预览：`npm run preview`，地址 `http://localhost:5275/lab/dashcam-teardown/`。
- 两次构建均成功，Vite 提示存在超过 500 kB 的 JS 分块；本次仅导入源码，没有调整分块策略。

## 路径和语言切换

Vite 的 `base` 在 `vite.config.ts`：开发为 `/`，构建和预览为 `/lab/dashcam-teardown/`。当前源码来自迁移到个人站之后的版本，HTML 的分享链接也使用这个路径。

`src/i18n.ts` 负责语言检测、切换和持久化，localStorage 键为 `teardown-lang`；`index.html` 有首屏中文切换前的初始化脚本，`src/main.ts` 订阅语言变化。

## 与 main 的构建对比

远端 main 有 15 个文件，本次构建有 12 个。忽略文件名哈希后，只少了 `.nojekyll`、`CNAME` 和发布版 `README.md`；HTML 元素 ID 顺序相同，保留一个 JS 和一个 CSS 的分块结构。8 个对应文件字节一致，另 4 个有内容变化（HTML、CSS、JS、favicon.svg）。

两份代码都已包含迁移后的路径与站内返回链接，因此不能把本次构建认作 main 的字节级复刻。main 仍保留旧子域名配置。本次没有修改配色、正文、导航功能，也没有把路径改为新站的 `/work/`。新站此前直接修改过成品文件的内容不在本次任务内。

## 导入范围

保留 `src/`、`public/`、`tools/`、HTML、构建配置、package.json 和锁文件。未导入依赖、构建输出、缓存、审查截图、运行记录，以及原工程的 research/、art/、SPEC.md、REVIEW.md。候选文件没有超过 50 MB 的文件，没有发现 .env 或凭据文件。提交前检查了 key、token、secret、password 等关键词；命中为代码标识符、浏览器存储键、键盘事件、动画关键帧、CSS 设计变量、Gerber 解析 token 或锁文件元数据，未发现可疑凭据。

`tools/` 保留原工程的辅助脚本。浏览器审查工具和 PCB 纹理生成工具可能需要额外的本机工具或输入文件；它们不参与 `npm run build`，本次未执行。

`npm run sync` 面向原 Contra/personal-site 相邻目录布局，会替换目标目录内容。独立克隆本分支后，不要直接使用默认同步目标；若需验证复制，先显式设置 `LAB_TARGET` 到独立目录。本次未运行同步或部署。
