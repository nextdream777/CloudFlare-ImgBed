# 08_DevOps 长期提炼记忆库 (多环境与部署避坑)

## 1. 部署模式避坑
* **Cloudflare Pages 部署**: 环境变量需在 Cloudflare Pages 控制台配置，本地调试依赖 `.dev.vars`。
* **Docker 部署**: 检查端口映射（默认 8080）与持久化卷映射（`data/`）。

## 2. 数据库迁移执行规范
* 新环境执行 `database/init.sql`。
* 增量演进检查 `database/migrations/`，按文件名版本顺序执行。
