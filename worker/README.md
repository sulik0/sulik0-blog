# 自建博客后台（Cloudflare Worker）

后台是一个手机友好的静态页面，Worker 负责 GitHub OAuth 和写入仓库。文章仍然使用 `content/posts/<slug>.md`，图片写入 `content/media/`，保存后由现有 GitHub Actions 自动生成并发布。

## 第一次部署（推荐：GitHub Actions）

这样不需要在电脑安装 Wrangler：

1. 在 Cloudflare Dashboard → My Profile → API Tokens 创建一个 API Token，权限选择 **Edit Cloudflare Workers**，并记下 Cloudflare Account ID。Cloudflare 建议把 Token 限制在目标账号。
2. 在 GitHub 仓库 Settings → Secrets and variables → Actions → New repository secret 添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. 合并这个 PR 后，打开仓库的 **Actions → Deploy blog admin → Run workflow**。
4. 工作流完成后，在日志里找到 Worker 地址，一般是 `https://sulik0-blog-admin.<你的 workers.dev 子域>.workers.dev`。
5. 继续按下面的 GitHub OAuth 和运行密钥步骤配置。Cloudflare 官方的 GitHub Actions 部署方式需要 Account ID 和 API Token 两个 CI 密钥。

## GitHub OAuth 和运行密钥

1. 在 GitHub Settings → Developer settings → OAuth Apps → New OAuth App 创建 OAuth App。
2. Homepage URL 填 Worker 地址，例如 `https://blog-admin.example.workers.dev`。
3. Authorization callback URL 填同一地址加 `/callback`。
4. 在 Cloudflare Worker → Settings → Variables and Secrets 中添加以下 Secret：
   - `GITHUB_CLIENT_ID`：GitHub OAuth App 的 Client ID
   - `GITHUB_CLIENT_SECRET`：GitHub OAuth App 的 Client Secret
   - `SESSION_SECRET`：一段随机长字符串
   - `PUBLIC_URL`：Worker 的完整 HTTPS 地址

Cloudflare 会加密保存 Worker Secret；不要把这些值写进仓库。配置方式见 Cloudflare 的 [Secrets 文档](https://developers.cloudflare.com/workers/configuration/secrets/)。

## 本地或命令行部署（备用）

1. 安装 Wrangler：`npm install -g wrangler`，登录：`wrangler login`。
2. 在本目录执行：

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
