-- CloudFlare-ImgBed D1 Database Migration
-- Version: v2.9.0
-- Description: Add atlases (图志表) and atlas_items (图志-文件关联表) for REQ-002

-- Up Migration
CREATE TABLE IF NOT EXISTS atlases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_file_id TEXT,
    query_rules TEXT, -- JSON format: {"directories":[], "tags":[], "media_types":[]}
    sort_order INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS atlas_items (
    atlas_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'include', -- 'include' (显式包含) | 'exclude' (规则命中但排除)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (atlas_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_atlases_sort_order ON atlases(sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_items_file_id ON atlas_items(file_id);
CREATE INDEX IF NOT EXISTS idx_atlas_items_atlas_id ON atlas_items(atlas_id);

-- Down Migration (For Rollback Reference)
-- DROP INDEX IF EXISTS idx_atlas_items_atlas_id;
-- DROP INDEX IF EXISTS idx_atlas_items_file_id;
-- DROP INDEX IF EXISTS idx_atlases_sort_order;
-- DROP TABLE IF EXISTS atlas_items;
-- DROP TABLE IF EXISTS atlases;
