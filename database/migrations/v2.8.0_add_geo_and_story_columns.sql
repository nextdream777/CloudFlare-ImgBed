-- >>> UP >>>
-- 1. 扩展 files 表地理位置与故事描述字段
ALTER TABLE files ADD COLUMN latitude REAL;
ALTER TABLE files ADD COLUMN longitude REAL;
ALTER TABLE files ADD COLUMN location_name TEXT;
ALTER TABLE files ADD COLUMN description TEXT;

-- 2. 为空间检索与图卷散点聚合建立联合索引
CREATE INDEX IF NOT EXISTS idx_files_geo ON files(latitude, longitude);

-- <<< DOWN <<<
-- 回滚脚本 (用于部署异常时秒级回滚)
DROP INDEX IF EXISTS idx_files_geo;
ALTER TABLE files DROP COLUMN latitude;
ALTER TABLE files DROP COLUMN longitude;
ALTER TABLE files DROP COLUMN location_name;
ALTER TABLE files DROP COLUMN description;
