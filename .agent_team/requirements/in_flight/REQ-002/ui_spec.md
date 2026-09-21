# UI/UX 交互与设计规范：REQ-002 图志编排、标签治理与上传空间交互

> **工单编号**: `REQ-002`  
> **责任角色**: `02_uiux`  
> **状态**: 已就绪 (`DELIVERED`)  
> **原型文件**: [.agent_team/requirements/in_flight/REQ-002/prototype_atlas_manage.html](file:///d:/work/wangyc/CloudFlare-ImgBed/.agent_team/requirements/in_flight/REQ-002/prototype_atlas_manage.html)  

---

## 1. 设计系统与调性对齐
* **设计语言**: Minimalist Editorial（温润极简画册风）+ Element Plus 原生组件适配。
* **暗黑模式对齐**: 严格复用 `Sanyue-ImgHub` 的 CSS 变量（`--admin-container-color`, `--tabs-switcher-accent-color`），在日间与暗黑模式下自适应对比度与毛玻璃质感。
* **去 Emoji 规范**: 统一使用 FontAwesome SVG 图标与清爽小字号胶囊 Badge，严禁装饰性 Emoji。

---

## 2. 页面与组件交互规范

### 2.1 独立管理页面 (`AtlasManage.vue`)
* **导航接入**: 在 `DashboardTabs.vue` 中配置 Tab `atlasManage`，图标 `atlas`，文案 `图志与标签`。
* **Tab 1: 图志编排列表 (Atlases)**:
  - **画廊卡片 Grid**: 采用 16:9 封面 + 渐变黑色遮罩，底部叠印图志名称与足迹数徽章；
  - **默认主图志**: 置顶锁定，标识「系统主图志」，不可删除，规则为全量坐标；
  - **自定义图志卡片**: 展示关联目录与标签胶囊，操作栏包含「编辑规则」、「大盘查看」与「删除」。
* **图志编辑弹窗 (Dialog)**:
  - 基础信息：图志名称、封面选择（默认自动使用首张可用照片）、策展前言与手记；
  - 自动规则：关联目录（支持树形选择器输入）+ 关联标签；
  - **无坐标强门禁 (Hard-Gate)**：
    - 照片列表中，无经纬度的媒体呈现 **半透明置灰（opacity-40） + 灰度滤镜（grayscale） + 虚线边框**；
    - 遮罩提示「无经纬度 · 需先打卡」；
    - 点击或 hover 触发 Tooltip 提示，严禁选中入库。
* **Tab 2: 全局标签治理 (Tag Governance)**:
  - 表格呈现：标签名称、关联照片总数、带坐标照片数（百分比）、最后使用时间；
  - **一键合并弹窗**: 输入目标标签名称（如将 `#hangzhou` 合并至 `#杭州`），确认后提交后端事务；
  - **清理死标签**: 顶栏提供「清理 0 引用标签」操作，带二次确认弹窗。

---

### 2.2 上传端空间闭环交互 (`UploadHome.vue`)
* **文件选择嗅探反馈**:
  - 用户拖入照片后，卡片右下角根据 EXIF 解析结果展示动态徽标：
    - 含有 GPS：显示高亮微型图钉图标 + 地理名称/经纬度缩写；
    - 无 GPS：显示半透明微型「待定位」提示。
* **上传完成「一键批量标定」弹窗**:
  - 当单批次上传的照片中存在 **>= 2 张未定位照片** 时，上传成功结果卡片中显眼提供按钮：
    `[ 为本批 X 张未定位照片统一设置地点 ]`
  - 点击弹出微型 Leaflet 地图选点器：
    - 用户在地图上点击落点；
    - 自动反查地名；
    - 点击「确认赋予」，一次性为这 X 张照片写入相同的 `latitude`, `longitude` 与 `location_name`。
