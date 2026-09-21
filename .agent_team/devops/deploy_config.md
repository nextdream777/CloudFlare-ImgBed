# 多环境配置矩阵与部署 Runbook (Deploy Config)

## 1. 部署环境矩阵 (Environment Matrix)

| 环境 | 部署载体 | 访问入口 | 启动命令 | 持久化方式 |
| :--- | :--- | :--- | :--- | :--- |
| **Local Dev** | Wrangler / Miniflare | `http://localhost:8080` | `npm start` | 本地 `./data` 目录 |
| **Docker** | Node.js Server 容器 | `http://localhost:8080` | `npm run start:docker` | 挂载卷 `/app/data` |
| **Cloudflare Pages** | Serverless Edge | 自定义域名 / pages.dev | Cloudflare Git 自动构建 | D1 + KV + R2 |
| **Cloudflare Worker** | Worker 单文件路由 | 自定义域名 / workers.dev | `npm run deploy:worker` | D1 + KV + R2 |

---

## 2. 核心环境变量清单

* `DATABASE`: Cloudflare D1 绑定名称
* `img_url`: Cloudflare KV 命名空间绑定
* `img_r2`: Cloudflare R2 存储桶绑定
* `ADMIN_PASSWORD`: 管理员后台访问密码
* `API_TOKEN`: 接口调用通用鉴权 Token
* `TG_BOT_TOKEN`: Telegram 机器人 Token (可选)
* `TG_CHAT_ID`: Telegram 存储频道 ID (可选)
