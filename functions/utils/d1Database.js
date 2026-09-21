/**
 * D1 数据库操作工具类
 */

class D1Database {
    constructor(db) {
        this.db = db;
    }
}

// ==================== 文件操作 ====================

/**
 * 保存文件记录 (替代 KV.put)
 */
D1Database.prototype.putFile = function(fileId, value, options) {
    value = value || '';
    options = options || {};
    var metadata = options.metadata || {};
    
    // 从metadata中提取字段用于索引
    var extractedFields = this.extractMetadataFields(metadata);
    
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO files (' +
        'id, value, metadata, file_name, file_type, file_size, ' +
        'upload_ip, upload_address, list_type, timestamp, ' +
        'label, directory, channel, channel_name, ' +
        'tg_file_id, tg_chat_id, tg_bot_token, is_chunked, ' +
        'tags, latitude, longitude, location_name, description' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    
    var self = this;
    return stmt.bind(
        fileId,
        value,
        JSON.stringify(metadata),
        extractedFields.fileName,
        extractedFields.fileType,
        extractedFields.fileSize,
        extractedFields.uploadIP,
        extractedFields.uploadAddress,
        extractedFields.listType,
        extractedFields.timestamp,
        extractedFields.label,
        extractedFields.directory,
        extractedFields.channel,
        extractedFields.channelName,
        extractedFields.tgFileId,
        extractedFields.tgChatId,
        extractedFields.tgBotToken,
        extractedFields.isChunked,
        extractedFields.tags,
        extractedFields.latitude,
        extractedFields.longitude,
        extractedFields.locationName,
        extractedFields.description
    ).run().catch(function(err) {
        // Fallback for older table schema without geo columns
        var legacyStmt = self.db.prepare(
            'INSERT OR REPLACE INTO files (' +
            'id, value, metadata, file_name, file_type, file_size, ' +
            'upload_ip, upload_address, list_type, timestamp, ' +
            'label, directory, channel, channel_name, ' +
            'tg_file_id, tg_chat_id, tg_bot_token, is_chunked' +
            ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        return legacyStmt.bind(
            fileId,
            value,
            JSON.stringify(metadata),
            extractedFields.fileName,
            extractedFields.fileType,
            extractedFields.fileSize,
            extractedFields.uploadIP,
            extractedFields.uploadAddress,
            extractedFields.listType,
            extractedFields.timestamp,
            extractedFields.label,
            extractedFields.directory,
            extractedFields.channel,
            extractedFields.channelName,
            extractedFields.tgFileId,
            extractedFields.tgChatId,
            extractedFields.tgBotToken,
            extractedFields.isChunked
        ).run();
    });
};

/**
 * 获取文件记录 (替代 KV.get)
 */
D1Database.prototype.getFile = function(fileId) {
    var self = this;
    var stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
    return stmt.bind(fileId).first().then(function(result) {
        if (!result) return null;
        
        return {
            value: result.value,
            metadata: JSON.parse(result.metadata || '{}')
        };
    });
};

/**
 * 获取文件记录包含元数据 (替代 KV.getWithMetadata)
 */
D1Database.prototype.getFileWithMetadata = function(fileId) {
    return this.getFile(fileId);
};

/**
 * 删除文件记录 (替代 KV.delete)
 */
D1Database.prototype.deleteFile = function(fileId) {
    var stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
    return stmt.bind(fileId).run();
};

/**
 * 列出文件 (替代 KV.list)
 */
D1Database.prototype.listFiles = function(options) {
    options = options || {};
    var prefix = options.prefix || '';
    var limit = options.limit || 1000;
    var cursor = options.cursor || null;
    
    var query = 'SELECT id, metadata FROM files';
    var params = [];
    
    if (prefix) {
        query += ' WHERE id LIKE ?';
        params.push(prefix + '%');
    }
    
    if (cursor) {
        query += prefix ? ' AND' : ' WHERE';
        query += ' id > ?';
        params.push(cursor);
    }
    
    query += ' ORDER BY id LIMIT ?';
    params.push(limit + 1);
    
    var stmt = this.db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind.apply(stmt, params);
    }
    return stmt.all().then(function(response) {
        var results = response.results || [];
        var hasMore = results.length > limit;
        if (hasMore) {
            results.pop();
        }

        var keys = results.map(function(row) {
            return {
                name: row.id,
                metadata: JSON.parse(row.metadata || '{}')
            };
        });
        
        return {
            keys: keys,
            cursor: hasMore && keys.length > 0 ? keys[keys.length - 1].name : null,
            list_complete: !hasMore
        };
    });
};

// ==================== 设置操作 ====================

/**
 * 保存设置 (替代 KV.put)
 */
D1Database.prototype.putSetting = function(key, value, category) {
    if (!category && key.startsWith('manage@sysConfig@')) {
        category = key.split('@')[2];
    }
    
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO settings (key, value, category) VALUES (?, ?, ?)'
    );
    
    return stmt.bind(key, value, category).run();
};

/**
 * 获取设置 (替代 KV.get)
 */
D1Database.prototype.getSetting = function(key) {
    var stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    return stmt.bind(key).first().then(function(result) {
        return result ? result.value : null;
    });
};

/**
 * 删除设置 (替代 KV.delete)
 */
D1Database.prototype.deleteSetting = function(key) {
    var stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    return stmt.bind(key).run();
};

/**
 * 列出设置 (替代 KV.list)
 */
D1Database.prototype.listSettings = function(options) {
    options = options || {};
    var prefix = options.prefix || '';
    var limit = options.limit || 1000;
    
    var query = 'SELECT key, value FROM settings';
    var params = [];
    
    if (prefix) {
        query += ' WHERE key LIKE ?';
        params.push(prefix + '%');
    }
    
    query += ' ORDER BY key LIMIT ?';
    params.push(limit);
    
    var stmt = this.db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind.apply(stmt, params);
    }
    return stmt.all().then(function(response) {
        var results = response.results || [];
        var keys = results.map(function(row) {
            return {
                name: row.key,
                value: row.value
            };
        });

        return { keys: keys };
    });
};

// ==================== 索引操作 ====================

/**
 * 保存索引操作记录
 */
D1Database.prototype.putIndexOperation = function(operationId, operation) {
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO index_operations (id, type, timestamp, data) VALUES (?, ?, ?, ?)'
    );
    
    return stmt.bind(
        operationId,
        operation.type,
        operation.timestamp,
        JSON.stringify(operation.data)
    ).run();
};

/**
 * 获取索引操作记录
 */
D1Database.prototype.getIndexOperation = function(operationId) {
    var stmt = this.db.prepare('SELECT * FROM index_operations WHERE id = ?');
    return stmt.bind(operationId).first().then(function(result) {
        if (!result) return null;
        
        return {
            type: result.type,
            timestamp: result.timestamp,
            data: JSON.parse(result.data)
        };
    });
};

/**
 * 删除索引操作记录
 */
D1Database.prototype.deleteIndexOperation = function(operationId) {
    var stmt = this.db.prepare('DELETE FROM index_operations WHERE id = ?');
    return stmt.bind(operationId).run();
};

/**
 * 列出索引操作记录
 */
D1Database.prototype.listIndexOperations = function(options) {
    options = options || {};
    var limit = options.limit || 1000;
    var processed = options.processed;
    
    var query = 'SELECT * FROM index_operations';
    var params = [];
    
    if (processed !== null && processed !== undefined) {
        query += ' WHERE processed = ?';
        params.push(processed);
    }
    
    query += ' ORDER BY timestamp LIMIT ?';
    params.push(limit);
    
    var stmt = this.db.prepare(query);
    if (params.length > 0) {
        stmt = stmt.bind.apply(stmt, params);
    }
    return stmt.all().then(function(response) {
        var results = response.results || [];
        return results.map(function(row) {
            return {
                id: row.id,
                type: row.type,
                timestamp: row.timestamp,
                data: JSON.parse(row.data),
                processed: row.processed
            };
        });
    });
};

// ==================== 工具方法 ====================

/**
 * 从metadata中提取字段用于索引
 */
D1Database.prototype.extractMetadataFields = function(metadata) {
    return {
        fileName: metadata.FileName || null,
        fileType: metadata.FileType || null,
        fileSize: metadata.FileSize || null,
        uploadIP: metadata.UploadIP || null,
        uploadAddress: metadata.UploadAddress || null,
        listType: metadata.ListType || null,
        timestamp: metadata.TimeStamp || null,
        label: metadata.Label || null,
        directory: metadata.Directory || null,
        channel: metadata.Channel || null,
        channelName: metadata.ChannelName || null,
        tgFileId: metadata.TgFileId || null,
        tgChatId: null,
        tgBotToken: null,
        isChunked: metadata.IsChunked || false,
        tags: Array.isArray(metadata.Tags) ? JSON.stringify(metadata.Tags) : (typeof metadata.Tags === 'string' ? metadata.Tags : null),
        latitude: metadata.Latitude !== undefined && metadata.Latitude !== null ? Number(metadata.Latitude) : (metadata.latitude !== undefined && metadata.latitude !== null ? Number(metadata.latitude) : null),
        longitude: metadata.Longitude !== undefined && metadata.Longitude !== null ? Number(metadata.Longitude) : (metadata.longitude !== undefined && metadata.longitude !== null ? Number(metadata.longitude) : null),
        locationName: metadata.LocationName || metadata.location_name || null,
        description: metadata.Description || metadata.description || null
    };
};

// ==================== 通用方法 ====================

/**
 * 通用的put方法，根据key类型自动选择存储位置
 */
D1Database.prototype.put = function(key, value, options) {
    options = options || {};

    if (key.startsWith('manage@index@operation_')) {
        var operationId = key.replace('manage@index@operation_', '');
        var operation = JSON.parse(value);
        return this.putIndexOperation(operationId, operation);
    } else if (key.startsWith('manage@')) {
        // 所有 manage@ 前缀的键统一存入 settings 表
        var category = key.split('@')[1] || '';
        return this.putSetting(key, value, category);
    } else {
        return this.putFile(key, value, options);
    }
};

/**
 * 通用的get方法，根据key类型自动选择获取位置
 */
D1Database.prototype.get = function(key) {
    var self = this;

    if (key.startsWith('manage@index@operation_')) {
        var operationId = key.replace('manage@index@operation_', '');
        return this.getIndexOperation(operationId).then(function(operation) {
            return operation ? JSON.stringify(operation) : null;
        });
    } else if (key.startsWith('manage@')) {
        return this.getSetting(key);
    } else {
        return this.getFile(key).then(function(file) {
            return file ? file.value : null;
        });
    }
};

/**
 * 通用的getWithMetadata方法
 */
D1Database.prototype.getWithMetadata = function(key) {
    var self = this;

    if (key.startsWith('manage@')) {
        return this.getSetting(key).then(function(value) {
            return value ? { value: value, metadata: {} } : null;
        });
    } else {
        return this.getFileWithMetadata(key);
    }
};

/**
 * 通用的delete方法
 */
D1Database.prototype.delete = function(key) {
    if (key.startsWith('manage@index@operation_')) {
        var operationId = key.replace('manage@index@operation_', '');
        return this.deleteIndexOperation(operationId);
    } else if (key.startsWith('manage@')) {
        return this.deleteSetting(key);
    } else {
        return this.deleteFile(key);
    }
};

/**
 * 通用的list方法
 */
D1Database.prototype.list = function(options) {
    options = options || {};
    var prefix = options.prefix || '';
    var self = this;

    if (prefix.startsWith('manage@index@operation_')) {
        return this.listIndexOperations(options).then(function(operations) {
            var keys = operations.map(function(op) {
                return {
                    name: 'manage@index@operation_' + op.id
                };
            });
            return { keys: keys };
        });
    } else if (prefix.startsWith('manage@')) {
        return this.listSettings(options);
    } else {
        return this.listFiles(options);
    }
};

// ==================== 图志操作 (Atlases - REQ-002) ====================

/**
 * 列出所有图志
 */
D1Database.prototype.listAtlases = function() {
    var stmt = this.db.prepare(
        'SELECT a.*, ' +
        '(SELECT COUNT(1) FROM files f WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL) as total_geotagged ' +
        'FROM atlases a ORDER BY a.sort_order ASC, a.created_at DESC'
    );
    return stmt.all().then(function(res) {
        return res.results || [];
    }).catch(function(err) {
        return [];
    });
};

/**
 * 获取单个图志详情
 */
D1Database.prototype.getAtlas = function(id) {
    var stmt = this.db.prepare('SELECT * FROM atlases WHERE id = ?');
    return stmt.bind(id).first().then(function(atlas) {
        if (!atlas) return null;
        return atlas;
    }).catch(function() {
        return null;
    });
};

/**
 * 保存/更新图志
 */
D1Database.prototype.putAtlas = function(atlas) {
    var stmt = this.db.prepare(
        'INSERT OR REPLACE INTO atlases (id, name, description, cover_file_id, query_rules, sort_order, is_public, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    );
    return stmt.bind(
        atlas.id,
        atlas.name,
        atlas.description || null,
        atlas.cover_file_id || null,
        typeof atlas.query_rules === 'object' ? JSON.stringify(atlas.query_rules) : (atlas.query_rules || '{}'),
        atlas.sort_order || 0,
        atlas.is_public ? 1 : 0
    ).run();
};

/**
 * 删除图志及级联关系
 */
D1Database.prototype.deleteAtlas = function(id) {
    var self = this;
    return this.db.prepare('DELETE FROM atlases WHERE id = ?').bind(id).run().then(function() {
        return self.db.prepare('DELETE FROM atlas_items WHERE atlas_id = ?').bind(id).run().catch(function() {});
    });
};

/**
 * 获取图志显式关联项
 */
D1Database.prototype.getAtlasItems = function(atlasId) {
    var stmt = this.db.prepare('SELECT * FROM atlas_items WHERE atlas_id = ?');
    return stmt.bind(atlasId).all().then(function(res) {
        return res.results || [];
    }).catch(function() {
        return [];
    });
};

/**
 * 设置图志显式包含/排除项
 */
D1Database.prototype.setAtlasItems = function(atlasId, includedFileIds, excludedFileIds) {
    var self = this;
    includedFileIds = Array.isArray(includedFileIds) ? includedFileIds : [];
    excludedFileIds = Array.isArray(excludedFileIds) ? excludedFileIds : [];

    return this.db.prepare('DELETE FROM atlas_items WHERE atlas_id = ?').bind(atlasId).run().catch(function() {}).then(function() {
        var statements = [];
        includedFileIds.forEach(function(fid) {
            statements.push(self.db.prepare('INSERT INTO atlas_items (atlas_id, file_id, relation_type) VALUES (?, ?, ?)').bind(atlasId, fid, 'include'));
        });
        excludedFileIds.forEach(function(fid) {
            statements.push(self.db.prepare('INSERT INTO atlas_items (atlas_id, file_id, relation_type) VALUES (?, ?, ?)').bind(atlasId, fid, 'exclude'));
        });
        if (statements.length > 0) {
            return self.db.batch(statements);
        }
    });
};

// 导出构造函数
export { D1Database };

