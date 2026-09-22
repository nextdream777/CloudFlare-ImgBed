-- =============================================================================
-- CloudFlare ImgBed D1 完整数据库初始化脚本 (Full Initialization Script)
-- 包含二次开发的所有功能：图志管理 (Atlases)、足迹与打卡 (Geo/Story)、标签系统 (Tags) 等
-- 适用于：新建测试库 (img_d1_test) 或全新部署项目的一键完整初始化
-- =============================================================================

-- 1. 文件元数据与足迹主表 (files)
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    value TEXT,
    metadata TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size TEXT,
    upload_ip TEXT,
    upload_address TEXT,
    list_type TEXT,
    timestamp INTEGER,
    label TEXT,
    directory TEXT,
    channel TEXT,
    channel_name TEXT,
    tg_file_id TEXT,
    tg_chat_id TEXT,
    tg_bot_token TEXT,
    is_chunked BOOLEAN DEFAULT FALSE,
    tags TEXT,                              -- 标签 (JSON 数组格式，例如 ["风景", "旅行"])
    latitude REAL,                          -- 空间纬度 (WGS-84 坐标)
    longitude REAL,                         -- 空间经度 (WGS-84 坐标)
    location_name TEXT,                     -- 地点名称 (例如 "西岳华山 · 苍龙岭")
    description TEXT,                       -- 旅行手记 / 光影故事
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 图志核心表 (atlases)
CREATE TABLE IF NOT EXISTS atlases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                     -- 图志名称
    description TEXT,                       -- 图志描述
    cover_file_id TEXT,                     -- 封面照片 ID
    query_rules TEXT,                       -- 动态归纳规则 (JSON: {"directories":[], "tags":[], "media_types":[]})
    sort_order INTEGER DEFAULT 0,           -- 排序权重
    is_public BOOLEAN DEFAULT FALSE,        -- 是否公开访问 (false 需要管理员凭证)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 图志-照片关联表 (atlas_items)
CREATE TABLE IF NOT EXISTS atlas_items (
    atlas_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'include', -- 'include' (显式包含) | 'exclude' (规则命中但排除)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (atlas_id, file_id)
);

-- 4. 系统全局配置表 (settings)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 索引操作审计表 (index_operations)
CREATE TABLE IF NOT EXISTS index_operations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 索引元数据表 (index_metadata)
CREATE TABLE IF NOT EXISTS index_metadata (
    key TEXT PRIMARY KEY,
    last_updated INTEGER,
    total_count INTEGER DEFAULT 0,
    last_operation_id TEXT,
    chunk_count INTEGER DEFAULT 0,
    chunk_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 杂项与扩展数据表 (other_data)
CREATE TABLE IF NOT EXISTS other_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 索引体系构建 (Indexes)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_files_timestamp ON files(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory);
CREATE INDEX IF NOT EXISTS idx_files_channel ON files(channel);
CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_upload_ip ON files(upload_ip);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_tags ON files(tags);
CREATE INDEX IF NOT EXISTS idx_files_geo ON files(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_atlases_sort_order ON atlases(sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_items_file_id ON atlas_items(file_id);
CREATE INDEX IF NOT EXISTS idx_atlas_items_atlas_id ON atlas_items(atlas_id);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

CREATE INDEX IF NOT EXISTS idx_index_operations_timestamp ON index_operations(timestamp);
CREATE INDEX IF NOT EXISTS idx_index_operations_processed ON index_operations(processed);
CREATE INDEX IF NOT EXISTS idx_index_operations_type ON index_operations(type);

CREATE INDEX IF NOT EXISTS idx_other_data_type ON other_data(type);

-- =============================================================================
-- 触发器构建 (Triggers) - 自动维护 updated_at 字段
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS update_files_updated_at 
    AFTER UPDATE ON files
    BEGIN
        UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_atlases_updated_at 
    AFTER UPDATE ON atlases
    BEGIN
        UPDATE atlases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_settings_updated_at 
    AFTER UPDATE ON settings
    BEGIN
        UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;

CREATE TRIGGER IF NOT EXISTS update_index_metadata_updated_at 
    AFTER UPDATE ON index_metadata
    BEGIN
        UPDATE index_metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;

CREATE TRIGGER IF NOT EXISTS update_other_data_updated_at 
    AFTER UPDATE ON other_data
    BEGIN
        UPDATE other_data SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;
