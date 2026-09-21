# 04_后端开发 长期提炼记忆库 (后端避坑与项目惯例)

## 1. 项目代码惯例
* **模块规范**: 项目采用 ES Module (`import / export`)，文件内注意扩展名完整性。
* **Pages Functions 上下文**: `context.env` 包含环境变量、KV 命名空间 (`img_url`)、R2 桶 (`img_r2`) 与 D1 数据库实例。
* **响应包装**: API 返回统一使用 `{ code: 0, data: ..., msg: ... }` 格式。

## 2. 避坑清单
* Cloudflare Pages Functions 环境中避免使用 Node.js 特有原生 C++ 绑定模块。
* 大文件流式处理注意及时关闭 ReadableStream，避免内存泄漏。
