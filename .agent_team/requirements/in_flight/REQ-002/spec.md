# 特性切片需求：REQ-002 原生 Vue 架构下的光影图志、多图志管理与全局标签治理闭环

> **工单编号**: `REQ-002`  
> **所属领域**: `management/` & `storage/` & `frontend_ui/`  
> **创建时间**: 2026-09-21 19:30:00  
> **主控智能体**: Master Orchestrator  
> **责任角色**: `01_pm` (产品), `02_uiux` (设计), `03_architect` (架构), `04_backend` (后端), `05_frontend` (前端), `06_qa` (测试)  

---

## 1. 业务价值与目标
在 REQ-001 完成 D1 空间列扩展与独立大盘原型的基础上，依托全新发现的原生前端工程 `D:\work\wangyc\Sanyue-ImgHub`，实现企业级架构重构与能力升级：
1. **工程原生化**：将独立 HTML 原型重构为原生 Vue 3 组件（`PhotoAtlas.vue`），集成至系统统一路由与导航；
2. **底图配置化**：在系统设置中支持高德 Web API Key / 密钥配置，启用高德 2.0 WebGL 矢量去商业 POI 极简底图，并提供免 Key 栅格瓦片平滑降级；
3. **多图志管理（Atlas Management）**：提供独立顶层管理页面（`/atlasManage`），支持图志 CRUD、封面设置、目录/标签规则归集，以及**无 GPS 媒体严禁入内**的强门禁校验；
4. **全局标签治理**：提供跨文件的全局标签池维护，支持标签统计、重命名合并与死标签清理；
5. **上传端空间闭环**：在 `UploadHome.vue` 接入客户端 EXIF 毫秒级抓取，针对批量无 GPS 照片提供上传后「一键批量统一定位」。

---

## 2. 需求范围矩阵 (In Scope vs. Out of Scope)

### 2.1 本次范围 (In Scope)
1. **D1 数据模型升级**：
   - 新增 `atlases` 表与 `atlas_items` 关联表；
   - 级联自愈：当关联照片被删除时，封面自动降级为第一张可用照片，关联项自动解除。
2. **系统设置扩展**：
   - `SystemConfig.vue` 增加地图配置项（`amap_enable`, `amap_api_key`, `amap_security_code`, `amap_style`, `amap_show_poi`）；
   - 后端 `functions/api/manage/sysConfig/` 存取适配。
3. **原生光影图志单页 (`PhotoAtlas.vue`)**：
   - 注册 `/atlas` 路由与 `DashboardTabs.vue` 导航入口；
   - 顶部提供「图志切换器」（默认“全部·光影图志” + 自定义图志列表）；
   - 双模底图引擎：根据系统设置自适应加载高德 2.0 矢量地图或 Leaflet 瓦片地图；
   - 动态加载系统真实标签，支持标签过滤与两阶段数据流抽屉展开。
4. **图志与标签管理页面 (`AtlasManage.vue`)**：
   - 顶层一级路由 `/atlasManage`，包含两大 Tab：
     - **Tab 1: 图志编排管理**：图志卡片列表、新建/编辑图志（名称、描述、封面、目录规则、显式照片挑选）；
     - **强门禁校验**：未标定 GPS 的照片与视频严格不可选入图志；
     - **Tab 2: 全局标签治理**：标签全景池、关联照片计数、标签一键重命名合并、无引用标签批量清理。
5. **上传端空间闭环 (`UploadHome.vue`)**：
   - 选择文件时静默解析 EXIF GPS，卡片标记“已定位”；
   - 上传完成面板提供「为本批未定位照片统一设置地点」一键统一定位弹窗。
6. **双工程直接构建**：
   - `Sanyue-ImgHub/vue.config.js` 输出至 `../CloudFlare-ImgBed/frontend-dist`，一键构建部署。

### 2.2 明确排除 (Out of Scope)
1. 公开外链加密只读分享（留待 REQ-003）。
2. GPX 轨迹路线动态连线与回放动画（留待 REQ-003）。
3. 视频二进制深度 QuickTime 嗅探（采用手动标定与批量统一标定）。

---

## 3. 验收标准清单 (Definition of Done - DoD)
- [ ] **DoD-1**: D1 `atlases` 与 `atlas_items` 表成功建立，外键关系与级联删除无孤儿数据；
- [ ] **DoD-2**: 在系统设置中配置高德 Key 后，光影图志自动切换为高德 2.0 矢量地图并完全隐藏商业/生活 POI 杂质；清空 Key 时自动平滑回退至免 Key 极简瓦片；
- [ ] **DoD-3**: 用户可在 `/atlasManage` 新建、编辑、删除图志，并配置关联目录与显式照片；
- [ ] **DoD-4**: 在图志添加照片时，无经纬度照片强制置灰不可选，确保图志 100% 具备空间属性；
- [ ] **DoD-5**: 全局标签治理支持将旧标签合并为新标签，底层 D1、metadata JSON 与 indexManager 缓存三方原子同步；
- [ ] **DoD-6**: 手机原图在 `UploadHome.vue` 上传时自动提取 GPS 并在后台直接呈现；未定位照片支持上传完成后一键批量标定；
- [ ] **DoD-7**: `npm run build` 打包后无报错，产物在 Pages Dev 环境下全功能流畅运行。
