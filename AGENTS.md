# 交接说明

- 站名：sulik0 的博客；内容为生活感悟与技术学习。
- 禁止使用 ChatGPT Sites。所有者已选定 GitHub Pages：推送到 `main` 会自动发布到 https://sulik0.github.io/sulik0-blog/ ，所以 `main` 上的内容就是线上内容。
- 不连接、不改动 Claude 中转 VPS，不复制其地址、密钥、配置、备份或运维记录。
- 保持静态、无第三方依赖。只保留首页、两个分类、文章页；新增功能须有用户需求。
- 页面模板在 `templates/`，样式在 `assets/site.css`，文章在 `content/`，生成器在 `scripts/build.py`。
- 生成后运行 `python3 scripts/check.py`，检查空列表与至少一篇文章；UI 变动检查手机布局。
- `dist/` 可重建且会被清空，不放手写内容，不提交 Git。
- 不编造个人经历、职业或联系方式，不恢复已删示例文章。
- 以后操作写入精简 README：必要步骤、验证、回退。保留所有者已有修改，不擅自改写 Git 历史。
