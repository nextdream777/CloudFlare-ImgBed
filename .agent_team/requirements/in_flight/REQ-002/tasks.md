# REQ-002 研发任务拆解与并发文件锁清单 (Tasks Breakdown & File Locks)

> **工单编号**: `REQ-002`  
> **所属领域**: `management/` & `storage/` & `frontend_ui/`  
> **架构状态**: 双轨并行研发中 (`RUNNING`)  

---

## 1. 任务流转与依赖拓扑 (Dependency Graph)

```text
【设计轨 (02_uiux)】                                     【架构与后端轨 (03_architect + 04_backend)】
[Task 3: AtlasManage 原型与上传批处理规范]                     [Task 1: D1 数据模型与迁移脚本 (atlases, atlas_items)]
        │                                                                │
        │                                                                ▼
        │                                                  [Task 2: 图志 CRUD、标签治理与底图配置 API]
        ▼                                                                │
【前端工程化研发 (05_frontend)】                                          │
[Task 4: Sanyue-ImgHub 原生 PhotoAtlas.vue 迁移与自适应底图] ◄───────────┘
        │
        ├──► [Task 5: UploadHome.vue EXIF 抓取与批量标定]
        └──► [Task 6: AtlasManage.vue 图志与标签管理组件] ◄── (结合 Task 3 原型规范)
                    │
                    ▼
          [Task 7: 构建、联调握手与测试回归 (06_qa)]
```

---

## 2. 原子研发工单清单与文件锁白名单

### Task 1: D1 数据模型与迁移脚本
* **责任角色**: `04_backend`
* **专属文件锁 (File Lock Whitelist)**:
  - `database/migrations/v2.9.0_add_atlas_and_settings.sql` [NEW]
  - `functions/utils/d1Database.js` [MODIFY]
* **作业要点**:
  1. 编写 `v2.9.0_add_atlas_and_settings.sql`，建立 `atlases` 与 `atlas_items` 数据表与索引；
  2. 在 `d1Database.js` 中增加图志相关的数据操作方法；
  3. 增加级联删除防护（删除照片时清理 `atlas_items` 对应记录）。
* **DoD 验收标准**: 执行迁移 SQL 成功，数据表支持 CRUD。

---

### Task 2: 图志 CRUD、标签治理与底图配置 API
* **责任角色**: `04_backend`
* **专属文件锁 (File Lock Whitelist)**:
  - `functions/api/manage/atlas/[[path]].js` [NEW]
  - `functions/api/manage/tags/governance.js` [NEW]
  - `functions/api/manage/sysConfig/page.js` [MODIFY]
  - `functions/api/manage/footprint.js` [MODIFY]
* **作业要点**:
  1. 实现 `/api/manage/atlas` 的 GET (list), POST (create/update), DELETE 端点；
  2. 实现 `/api/manage/tags/governance` 的标签重命名合并与垃圾清理端点；
  3. `sysConfig/page.js` 扩展 `mapConfig` 配置项读取与更新；
  4. `footprint.js` 支持 `atlasId` 过滤参数，内部解析规则并强制无坐标排除。
* **DoD 验收标准**: 接口具备鉴权保护，符合 `delta_api.yaml` 契约。

---

### Task 3: AtlasManage 原型与上传批处理交互规范
* **责任角色**: `02_uiux`
* **专属文件锁 (File Lock Whitelist)**:
  - `.agent_team/requirements/in_flight/REQ-002/prototype_atlas_manage.html` [NEW]
  - `.agent_team/requirements/in_flight/REQ-002/ui_spec.md` [NEW]
* **作业要点**:
  1. 产出 `AtlasManage` 交互原型：图志卡片列表、编辑弹窗（目录选择树、无 GPS 强门禁照片置灰交互）、全局标签治理池；
  2. 产出 `UploadHome.vue` 批量上传结果卡片中「为本批未定位照片统一设置地点」的轻量交互规范；
  3. 严格遵循 Element Plus 与去 Emoji 的 Minimalist Editorial 风格，适配日间/夜间模式。
* **DoD 验收标准**: 交互原型在浏览器中直观可用，经总架构师审阅。

---

### Task 4: Sanyue-ImgHub 原生 PhotoAtlas.vue 迁移与自适应底图
* **责任角色**: `05_frontend`
* **专属文件锁 (File Lock Whitelist)**:
  - `D:/work/wangyc/Sanyue-ImgHub/src/views/PhotoAtlas.vue` [NEW]
  - `D:/work/wangyc/Sanyue-ImgHub/src/router/index.js` [MODIFY]
  - `D:/work/wangyc/Sanyue-ImgHub/src/components/DashboardTabs.vue` [MODIFY]
  - `D:/work/wangyc/Sanyue-ImgHub/src/locales/zh-CN.json` [MODIFY]
  - `D:/work/wangyc/Sanyue-ImgHub/src/locales/en.json` [MODIFY]
* **作业要点**:
  1. 将成熟的画册逻辑迁移至 Vue 3 SFC (`PhotoAtlas.vue`)；
  2. 顶部导航集成「图志切换器」与快捷「管理图志」按钮；
  3. 依据系统设置自适应加载高德 2.0 矢量地图（去商业 POI）或 Leaflet 浅色瓦片；
  4. 动态拉取系统真实标签替代硬编码假标签。
* **DoD 验收标准**: 页面在 Vue Router 中正常渲染，具备管理员守卫保护。

---

### Task 5: UploadHome.vue EXIF 抓取与批量标定
* **责任角色**: `05_frontend`
* **专属文件锁 (File Lock Whitelist)**:
  - `D:/work/wangyc/Sanyue-ImgHub/src/views/UploadHome.vue` [MODIFY]
* **作业要点**:
  1. 引入轻量 EXIF 读取器，在文件选择时嗅探 GPS，并在卡片上点亮定位徽章；
  2. 上传成功结果面板中，对无 GPS 照片提供「一键批量标定」弹窗，统一赋予经纬度。
* **DoD 验收标准**: 手机原图上传自动携带坐标，无坐标批量照片可一键快速打卡。

---

### Task 6: AtlasManage.vue 图志与标签管理组件
* **责任角色**: `05_frontend`
* **专属文件锁 (File Lock Whitelist)**:
  - `D:/work/wangyc/Sanyue-ImgHub/src/views/AtlasManage.vue` [NEW]
* **作业要点**:
  1. 基于 Task 3 的交互原型，实现 Element Plus 风格的双页签管理工作台；
  2. 实现图志 CRUD 与强门禁校验；
  3. 实现全局标签合并重命名与清理。
* **DoD 验收标准**: 界面全中文，操作流程顺畅，数据与后端准确联动。

---

### Task 7: 构建、联调握手与测试回归
* **责任角色**: `06_qa`
* **专属文件锁 (File Lock Whitelist)**:
  - `.agent_team/requirements/in_flight/REQ-002/test_report.md` [NEW]
* **作业要点**:
  1. 在 `Sanyue-ImgHub` 执行 `npm run build`，验证直接输出至 `CloudFlare-ImgBed/frontend-dist`；
  2. 跑通完整业务流：系统设置配置 Key -> 矢量底图生效 -> 新建图志 -> 批量上传打卡 -> 图志切换查看；
  3. 输出联调测试报告。
* **DoD 验收标准**: 100% 通过 7 项 DoD 验收标准。
