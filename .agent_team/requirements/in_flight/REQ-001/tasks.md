# REQ-001 研发任务拆解与并发文件锁清单 (Tasks Breakdown & File Locks)

> **工单编号**: `REQ-001` (地图足迹大盘与地理标记)  
> **所属领域**: `domain_tree/management/` & `domain_tree/storage/`  
> **架构状态**: 上游强门禁等待中 (`GATE_WAITING`)  
> **排期原则**: 模块解耦、并发零端口占用、API 握手门禁、2PC 严格合流  

---

## 1. 任务流转与依赖拓扑 (Dependency Graph)

```text
[Task 1: D1 数据库增量脚本与双写适配] (04_backend)
        │
        ├──► [Task 2: 两阶段足迹接口实现 (footprint.js)] (04_backend)
        ├──► [Task 3: 照片打卡与游记保存接口 (geo.js)] (04_backend)
        └──► [Task 4: 上传接口透传地理元数据适配] (04_backend)
                     │
                     ▼
[Task 5: 独立大盘路由与边缘鉴权守卫 (atlas.js)] (04_backend)
        │
        ▼
[Task 6: 前端极简大盘与打卡工作台集成 (atlas.html)] (05_frontend)
        │
        ▼
【API Handshake 联调握手门禁 (Master + 04_backend + 05_frontend)】
        │
        ▼
[Task 7: 自动化测试与主链路回归] (06_qa)
        │
        ▼
[Task 8: 代码审查总评与经验沉淀] (07_review) ➔ 2PC 合流
```

---

## 2. 原子研发工单清单与文件锁白名单 (Task Specifications)

### Task 1: D1 数据库迁移脚本与适配层双写增强
* **责任角色**: `04_backend`
* **前置依赖**: 无
* **专属文件锁 (File Lock Whitelist)**:
  - `database/migrations/v2.8.0_add_geo_and_story_columns.sql` [NEW]
  - `functions/utils/d1Database.js` [MODIFY]
* **作业要点**:
  1. 落地 `v2.8.0_add_geo_and_story_columns.sql` 增量 DDL 与空间索引 `idx_files_geo`；
  2. 在 `d1Database.js` 的 `extractMetadataFields` 中提取 `latitude`, `longitude`, `locationName`, `description`；
  3. 在 `putFile` 的 `INSERT OR REPLACE` 语句中增加对应 4 个字段与绑定值，实现双写持久化；
  4. 保证字段为 `NULL` 时不影响现有业务逻辑。
* **DoD 验收标准**: 单元测试验证通过，执行 `putFile` 时字段正确入库且 `metadata` JSON 保持同步。

---

### Task 2: 两阶段足迹查询与详情接口实现
* **责任角色**: `04_backend`
* **前置依赖**: Task 1
* **专属文件锁 (File Lock Whitelist)**:
  - `functions/api/manage/footprint.js` [NEW]
* **作业要点**:
  1. 实现 `GET /api/manage/footprint`（阶段 1）：
     - 依据 `dir`、`includeTags`、`startTime`、`endTime` 过滤 `files` 表；
     - 强制 `WHERE latitude IS NOT NULL AND longitude IS NOT NULL`；
     - 仅返回 `{ id, lat, lng, name, dir, date, tags }` 轻量遥测包；
  2. 实现 `GET /api/manage/footprint/detail`（阶段 2）：
     - 根据传入的 `id` 查询完整记录；
     - 返回原图地址 `rawUrl` 与强制带 `?width=400&fit=cover` 的缩略图地址 `thumbUrl`；
     - 返回完整的图文故事 `description`。
* **DoD 验收标准**: 接口具备管理员鉴权保护，未登录返回 401；返回数据结构符合 `delta_api.yaml`。

---

### Task 3: 照片打卡选点与游记故事保存接口
* **责任角色**: `04_backend`
* **前置依赖**: Task 1
* **专属文件锁 (File Lock Whitelist)**:
  - `functions/api/manage/metadata/geo.js` [NEW]
* **作业要点**:
  1. 实现 `POST /api/manage/metadata/geo`；
  2. 接收 `{ id, latitude, longitude, location_name, description }`；
  3. 坐标合法性校验（`-90 <= lat <= 90`, `-180 <= lng <= 180`，允许 null 表示清除）；
  4. 读取原文件元数据，合并新字段并执行 `putFile` 双写；
  5. 异步同步至 `indexManager` 并触发 Cloudflare 缓存清除。
* **DoD 验收标准**: 打卡保存后刷新能读取到最新坐标与故事，清除定位后坐标置空。

---

### Task 4: 上传接口透传地理元数据适配
* **责任角色**: `04_backend`
* **前置依赖**: Task 1
* **专属文件锁 (File Lock Whitelist)**:
  - `functions/upload/index.js` [MODIFY]
* **作业要点**:
  1. 检查上传表单解析逻辑，若存在 `latitude`, `longitude`, `location_name`, `description`，自动合并至文件 `metadata` 中；
  2. 保持原有各渠道（Telegram, R2 等）的上传主链路 100% 不受影响。
* **DoD 验收标准**: 携带 GPS 参数上传时，入库记录直接包含坐标信息。

---

### Task 5: 边缘路由守卫与大盘入口分发
* **责任角色**: `04_backend`
* **前置依赖**: 无
* **专属文件锁 (File Lock Whitelist)**:
  - `functions/atlas.js` [NEW]
* **作业要点**:
  1. 实现 `/atlas` 路由拦截；
  2. 校验管理员登录态（Cookie / Token）；
  3. 若未登录，返回 302 重定向至 `/` 登录页；
  4. 若已登录，读取并响应 `frontend-dist/atlas.html` 内容，附带 `private, no-cache` 头。
* **DoD 验收标准**: 未登录无法直接打开大盘，已登录无缝渲染大盘页面。

---

### Task 6: 前端极简时空大盘与打卡工作台集成
* **责任角色**: `05_frontend`
* **前置依赖**: Task 2, Task 3, Task 5
* **专属文件锁 (File Lock Whitelist)**:
  - `frontend-dist/atlas.html` [NEW]
* **作业要点**:
  1. 基于已确认的 `prototype.html`，接入真实后端接口：
     - 初始化调用 `/api/manage/footprint` 获取散点；
     - 顶部分类与多标签过滤联动；
     - 点击标记点异步请求 `/api/manage/footprint/detail` 展开抽屉；
     - 抽屉图片加载使用 `thumbUrl`，点击全屏查看使用 `rawUrl`；
  2. 实现打卡选点弹窗：
     - 点击地图选点，自动填入经纬度；
     - 异步调用 Nominatim 获取推荐地名并填充；
     - 点击保存提交至 `/api/manage/metadata/geo`，并静默刷新大盘点位。
  3. 遵循无 Emoji、极简温润的纯文本与 SVG 规范。
* **DoD 验收标准**: 浏览器中全功能流畅运行，无控制台报错，网络请求符合两阶段加载。

---

### Task 7: 联调握手与测试回归 (API Handshake & QA)
* **责任角色**: `06_qa` + `04_backend` + `05_frontend`
* **专属文件锁 (File Lock Whitelist)**:
  - `.agent_team/requirements/in_flight/REQ-001/test_report.md` [NEW]
* **作业要点**:
  1. 跑通完整真实业务闭环：上传 -> 选点打卡 -> 足迹大盘点聚合 -> 抽屉展开游记；
  2. 验证 Telegram 存储原图读取与缩略图转换；
  3. 验证未授权访问拦截；
  4. 输出测试报告与缺陷排查结果。
* **DoD 验收标准**: 100% 通过 8 项 DoD 验收标准。

---

### Task 9: 前端大盘全中文化与排版换行样式优化
* **责任角色**: `05_frontend`
* **专属文件锁 (File Lock Whitelist)**:
  - `frontend-dist/atlas.html` [MODIFY]
* **作业要点**:
  1. 将大盘所有界面英文字符全面汉化（包含导航栏标题、目录下拉框、标签栏、统计指标、侧边抽屉各元数据字段、提示文案等）；
  2. 解决导航栏、指标栏及抽屉在各屏幕尺寸下的异常折行问题（增加 `whitespace-nowrap`、`flex-shrink-0` 及响应式断点弹性收缩）；
  3. 优化视觉排版细节与行高，杜绝文本拥挤或换行截断；
  4. 严格遵循去 Emoji、极简温润的画册级排版规范。
* **DoD 验收标准**: 界面 100% 中文展示，所有文本与按钮在常见分辨率下无异常换行，视觉对齐优雅。

---

## 3. 并发开发物理隔离与端口防冲突规范

1. **零端口占用原则**：在前后端并发开发阶段，严禁启动后台长期占用的 Web 监听服务；
2. **单例联调原则**：仅在 Handshake 阶段由主控拉起单一临时测试实例，并在测试结束后精准优雅退出；
3. **文件锁强制隔离**：前后端 Worker 严格仅在各自的专属文件锁清单内修改代码，严禁跨边界写入。
