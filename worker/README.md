# 自建博客后台（Cloudflare Worker）

后台是一个手机友好的静态页面，Worker 负责 GitHub OAuth 和写入仓库。文章仍然使用 `content/posts/<slug>.md`，图片写入 `content/media/`，保存后由现有 GitHub Actions 自动生成并发布。

## 第一次部署

1. 在 GitHub Settings → Developer settings → OAuth Apps → New OAuth App 创建 OAuth App。
2. Homepage URL 填 Worker 地址，例如 `https://blog-admin.example.workers.dev`。
3. Authorization callback URL 填同一地址加 `/callback`。
4. 安装 Wrangler：`npm install -g wrangler`，登录：`wrangler login`。
5. 在本目录执行：

```sh
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put PUBLIC_URL
wrangler deploy
```

`PUBLIC_URL` 必须是 Worker 的完整 HTTPS 地址。`SESSION_SECRET` 使用一段随机长字符串。GitHub OAuth App 需要 `repo` 权限，因为后台要向这个私有或公开仓库写入文章和图片。

## 本地预览

```sh
wrangler dev
```

本地登录回调需要在 OAuth App 里额外配置本地回调地址，或先部署到 Worker 再测试。不要把 `GITHUB_CLIENT_SECRET`、`SESSION_SECRET` 写入文件或提交 Git。

## 安全边界

登录令牌只以加密、HttpOnly、Secure Cookie 保存；浏览器端没有 GitHub Token。Worker 只允许合法 slug、`life/tech` 分类和文章目录，图片只允许常见图片扩展名。
