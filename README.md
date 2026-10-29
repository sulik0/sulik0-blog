# sulik0 的博客

生活感悟与技术学习。当前只保存源码，未配置新的托管；不用 ChatGPT Sites，不使用 VPS。

## 保留的核心

首页、生活/技术分类、Markdown 文章页。没有示例文章、搜索、归档、RSS、后台或自动部署。

```text
assets/          外观与图标
content/         文章清单及 Markdown 正文
scripts/         静态生成和检查
site.json        站名、简介和站点子路径
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

`life` 是生活，`tech` 是技术。正文支持段落、二/三级标题、列表、引用、链接、粗体和代码块。重新生成即可；没有文章时显示空状态。

## 交给其他 agent

先读 `AGENTS.md`。页面改 `templates/`，样式改 `assets/site.css`，生成逻辑改 `scripts/build.py`。验证后提交 Git；未来需要公开部署时，再按所有者选择配置平台和 `base_path`。

2026-10-29：清理为最小静态博客，移除原有托管配置和演示内容，上传独立 GitHub 源码仓库。

回退：使用 Git 恢复需要的源码版本，再重新生成。操作记录只保留必要步骤、验证和回退，避免堆积长文。

旧私有预览尚需在 Sites 管理界面手动下线或删除（当前工具没有此接口）；本项目已移除关联配置，不再向它发布。
