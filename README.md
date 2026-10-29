# sulik0 的博客

生活感悟与技术学习。公开地址：https://sulik0.github.io/sulik0-blog/ （GitHub Pages）；不用 ChatGPT Sites，不使用 VPS。

## 保留的核心

首页、生活/技术分类、Markdown 文章页。没有示例文章、搜索、归档、RSS 或后台。推送到 `main` 后由 GitHub Actions 自动生成并发布。

```text
assets/          样式 site.css、交互 site.js、字体 fonts/ 与图标
content/         文章清单及 Markdown 正文
scripts/         静态生成和检查
site.json        站名、首屏简介 intro、首屏链接 links 和站点子路径
templates/      HTML 页面模板
```

## 本地预览

需要 Python 3，无第三方依赖：

```sh
python3 scripts/build.py
python3 scripts/check.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

打开 `http://127.0.0.1:4173/`；Ctrl+C 停止。`dist/` 自动生成，不提交 Git。

## 外观（彩虹桥）

设计规格在 `design/DESIGN.md`，视觉基准是 `design/mockup.html`。只有一套深色外观，不加载任何外部资源。

- 彩虹桥由 `build.py` 生成为内联 SVG，左半链接到生活、右半链接到技术；没有文章时变成灰色。
- `assets/site.js`（原生 JS，小于 6KB）只负责入场动画、导航高亮块、彩虹悬停与筛选、阅读进度条。没有 JS 时页面完整可读，彩虹和分类筛选都是普通链接。
- 首屏简介和链接写在 `site.json`：`"intro": "两三行简介"`、`"links": [{"label": "GitHub", "url": "https://…"}]`。留空时首屏不显示这两项。
- 换中文字体：替换 `assets/fonts/` 里的文件，再改 `assets/site.css` 顶部 `@font-face` 和 `:root` 的 `--serif`、`--sans`、`--mono`。

## 字体

字体随仓库提交，平时不用处理。写的新文章里有字体子集没有的字时，`check.py` 会打印警告（不会失败），这时运行一次：

```sh
pip install fonttools brotli
python3 scripts/fonts.py
```

## 写文章

在 `content/posts/` 新建 `my-first-post.md` 写正文，在 `content/posts.json` 添加一条记录：

```json
[
  {
    "slug": "my-first-post",
    "title": "文章标题",
    "category": "life",
    "date": "2026-10-29",
    "excerpt": "可选的一句话摘要"
  }
]
```

`life` 是生活，`tech` 是技术。正文支持段落、二/三级标题、列表、引用、链接、粗体和代码块（不做语法高亮）。阅读时长按正文汉字数 ÷ 400 向上取整。重新生成即可；没有文章时显示空状态。

## 验证

1. `python3 scripts/build.py && python3 scripts/check.py`：空状态和至少一篇文章两种情况都要通过（临时加测试文章，验证后删除，不提交）。
2. 本地预览，看首页、分类页、文章页和空状态；把窗口缩到 390px 宽，页面不能横向滚动。
3. 浏览器开发者工具：控制台没有报错，网络请求全部来自本站。

## 交给其他 agent

先读 `AGENTS.md`。页面改 `templates/`，样式改 `assets/site.css`，生成逻辑改 `scripts/build.py`。验证后提交 Git；部署平台由所有者选定为 GitHub Pages，`site.json` 的 `base_path` 为 `/sulik0-blog`；换平台或绑定自定义域名时要同步修改它。

2026-10-29：彩虹桥改版（分支 `redesign-rainbow-bridge`），新增 `assets/site.js` 与站内字体。

2026-10-29：清理为最小静态博客，移除原有托管配置和演示内容，上传独立 GitHub 源码仓库。

回退：使用 Git 恢复需要的源码版本，再重新生成。撤销改版只需不合并或还原 `redesign-rainbow-bridge` 分支上的提交。操作记录只保留必要步骤、验证和回退，避免堆积长文。

旧私有预览尚需在 Sites 管理界面手动下线或删除（当前工具没有此接口）；本项目已移除关联配置，不再向它发布。

2026-10-29：按所有者要求公开发布到 GitHub Pages。仓库改为公开；`.github/workflows/pages.yml` 在推送到 `main` 时运行 `build.py` 和 `check.py`，再把 `dist/` 发布出去。验证：Actions 运行成功，线上首页、分类页和字体都能加载。回退：在仓库 Settings → Pages 停用，或删除该工作流。本地预览如果要用根路径，临时把 `base_path` 改回 `""`，不要提交这个改动。
