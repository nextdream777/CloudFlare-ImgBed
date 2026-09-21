import { getDatabase } from '../../../utils/databaseAdapter.js';
import { normalizeTags } from '../../../utils/tagHelpers.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    const db = getDatabase(env);
    if (!db) {
        return new Response(JSON.stringify({ success: false, message: 'Database not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        // 1. GET 请求: 统计全系统标签概览与图卷分布
        if (request.method === 'GET') {
            const rows = await db.db.prepare(
                'SELECT tags, latitude, longitude, timestamp FROM files WHERE tags IS NOT NULL AND tags != "" AND tags != "[]"'
            ).all().then(res => res.results || []);

            const tagMap = new Map(); // tag -> { count, geotaggedCount, lastUsed }

            rows.forEach(row => {
                let tags = [];
                try {
                    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (Array.isArray(row.tags) ? row.tags : []);
                } catch (e) {}

                const hasGeo = (row.latitude !== null && row.longitude !== null);
                const ts = row.timestamp || 0;

                tags.forEach(t => {
                    if (!t || typeof t !== 'string') return;
                    const cleanTag = t.trim();
                    if (!cleanTag) return;

                    if (!tagMap.has(cleanTag)) {
                        tagMap.set(cleanTag, {
                            tag: cleanTag,
                            count: 0,
                            geotaggedCount: 0,
                            lastUsed: ts
                        });
                    }

                    const item = tagMap.get(cleanTag);
                    item.count += 1;
                    if (hasGeo) item.geotaggedCount += 1;
                    if (ts > item.lastUsed) item.lastUsed = ts;
                });
            });

            const result = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);

            return new Response(JSON.stringify({ success: true, data: result }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 2. POST 请求: 标签重命名合并或清理
        if (request.method === 'POST') {
            const body = await request.json();
            const action = body.action; // 'merge' | 'rename' | 'delete'
            const sourceTags = Array.isArray(body.sourceTags) ? body.sourceTags.map(t => t.trim().toLowerCase()) : [];
            const targetTag = (body.targetTag || '').trim();

            if (sourceTags.length === 0) {
                return new Response(JSON.stringify({ success: false, message: 'Source tags are required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            if ((action === 'merge' || action === 'rename') && !targetTag) {
                return new Response(JSON.stringify({ success: false, message: 'Target tag is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            // 查询所有包含任意 sourceTags 的文件
            const files = await db.db.prepare(
                'SELECT id, metadata, tags FROM files WHERE tags IS NOT NULL'
            ).all().then(res => res.results || []);

            let updatedCount = 0;
            const updateStatements = [];

            for (const file of files) {
                let tags = [];
                try {
                    tags = typeof file.tags === 'string' ? JSON.parse(file.tags) : (Array.isArray(file.tags) ? file.tags : []);
                } catch (e) {
                    continue;
                }

                let modified = false;
                let newTags = [];

                if (action === 'delete') {
                    // 过滤掉所有 sourceTags
                    newTags = tags.filter(t => !sourceTags.includes(t.toLowerCase()));
                    if (newTags.length !== tags.length) modified = true;
                } else if (action === 'merge' || action === 'rename') {
                    let hasSource = false;
                    newTags = tags.map(t => {
                        if (sourceTags.includes(t.toLowerCase())) {
                            hasSource = true;
                            return targetTag;
                        }
                        return t;
                    });
                    if (hasSource) modified = true;
                }

                if (modified) {
                    newTags = normalizeTags(newTags);
                    
                    // 同步更新 metadata JSON
                    let metadata = {};
                    try {
                        metadata = JSON.parse(file.metadata || '{}');
                    } catch (e) {}
                    metadata.Tags = newTags;

                    updateStatements.push(
                        db.db.prepare(
                            'UPDATE files SET tags = ?, metadata = ? WHERE id = ?'
                        ).bind(JSON.stringify(newTags), JSON.stringify(metadata), file.id)
                    );
                    updatedCount++;
                }
            }

            // 批量执行原子更新
            if (updateStatements.length > 0) {
                // SQLite 批处理分片执行（每批 50 条，防止超限）
                const batchSize = 50;
                for (let i = 0; i < updateStatements.length; i += batchSize) {
                    const chunk = updateStatements.slice(i, i + batchSize);
                    await db.db.batch(chunk);
                }
            }

            return new Response(JSON.stringify({
                success: true,
                updatedCount: updatedCount,
                message: `Successfully processed ${updatedCount} files`
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (err) {
        console.error('Error in tag governance API:', err);
        return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
