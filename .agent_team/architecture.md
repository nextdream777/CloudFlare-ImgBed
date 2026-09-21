# CloudFlare-ImgBed 系统架构与源码工作区映射 (Architecture & Workspace Mapping)

## 1. 项目基本概况
* **项目名称**: CloudFlare-ImgBed
* **当前版本**: v2.7.6
* **系统形态**: 支持 Serverless（Cloudflare Pages / Cloudflare Worker）与容器化（Docker / Node.js）双模部署的多渠道图床与文件托管系统
* **主要特性**:
  - 多存储渠道接入：Telegram、Discord、Cloudflare R2、S3 兼容对象存储、Hugging Face、WebDAV
  - 现代化数据持久化：Cloudflare D1 / SQLite
  - 丰富的 API 与 WebDAV 协议支持
  - 静态前端与边缘函数解耦

---

## 2. 技术栈清单 (Tech Stack)
* **运行时环境**: Node.js (ES Module: `"type": "module"`)
* **边缘计算引擎**: Cloudflare Pages Functions / Cloudflare Workers
* **开发与本地调试**: Wrangler (`wrangler pages dev`), Miniflare
* **测试框架**: Mocha, Concurrently, Wait-on
* **数据库/持久层**: Cloudflare D1 / SQLite (`database/init.sql`, `database/migrations/`), Cloudflare KV (`img_url`), Cloudflare R2 (`img_r2`)
* **容器化**: Docker, Docker Compose

---

## 3. 源码工作区与目录映射 (Source Directory Mapping)

```text
CloudFlare-ImgBed/
├── functions/                  # 后端核心逻辑：Cloudflare Pages Functions
│   ├── api/                    # RESTful API 路由实现
│   │   ├── auth/               # 认证相关（登录、登出、校验）
│   │   ├── manage/             # 资源管理（文件列表、删除、更新、标签等）
│   │   ├── bing/               # 每日必英壁纸接口
│   │   ├── public/             # 公共无需鉴权接口
│   │   ├── channels.js         # 存储渠道定义与适配
│   │   ├── directoryTree.js    # 目录树生成与管理
│   │   ├── fetchRes.js         # 外部资源抓取与代理
│   │   └── userConfig.js       # 系统与用户配置管理
│   ├── dav/                    # WebDAV 服务网关实现
│   ├── file/                   # 文件分发、CDN代理与图片转换逻辑
│   ├── upload/                 # 多渠道文件上传处理核心
│   ├── utils/                  # 通用工具函数库
│   └── _middleware.js          # 全局中间件（鉴权、CORS、请求拦截）
├── database/                   # 数据库脚本与架构
│   ├── init.sql                # D1 / SQLite 初始化 DDL
│   └── migrations/             # 历史增量迁移脚本
├── frontend-dist/              # 前端编译输出目录（静态资源托管）
├── deploy/                     # 部署适配器与配置
│   ├── server/                 # Docker 独立 Node.js 服务实现
│   ├── worker/                 # Cloudflare Worker 单独打包路由生成器
│   └── profiles/               # 各部署模式 profile
├── .agent_team/                # 多智能体团队治理与编排核心目录
└── package.json                # 工程配置与脚本
```

---

## 4. 标准工程脚本与执行命令 (Standard Run & Test Commands)

* **本地开发服务启动 (Pages Dev + Miniflare)**:
  ```bash
  npm start
  # npx wrangler pages dev ./frontend-dist --kv "img_url" --r2 "img_r2" --ip 0.0.0.0 --port 8080 --persist-to ./data
  ```
* **Docker 服务启动**:
  ```bash
  npm run start:docker
  ```
* **单元/集成测试**:
  ```bash
  npm test
  # mocha
  ```
* **CI 自动化全量测试**:
  ```bash
  npm run ci-test
  ```
* **Worker 单独部署构建**:
  ```bash
  npm run deploy:worker
  ```

---

## 5. 分支策略与持续交付规范 (Branch Strategy & CD SOP)

* **主开发分支**: `dev` (日常需求研发、合流与联调均在 `dev` 分支进行)
* **发布分支**: `main` (CloudFlare-ImgBed) / `master` (Sanyue-ImgHub)
* **审阅后自动交付 SOP (Review-to-Dev Pipeline)**:
  - 每次需求经总架构师审阅完成（Stage 08 通过）并执行 2PC 事务提交（Stage 09）时：
    1. 自动为 `CloudFlare-ImgBed` 与 `Sanyue-ImgHub` 检出并切换至 `dev` 分支；
    2. 自动暂存并生成语义化提交：`git commit -m "feat: [需求简述] (vX.Y.Z)"`；
    3. 自动同步向远程 `dev` 分支推送最新版本代码 (`git push -u origin dev`)。

