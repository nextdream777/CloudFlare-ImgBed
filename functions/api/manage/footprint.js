import { getDatabase } from '../../utils/databaseAdapter.js';
import { authenticate, AUTH_SCOPE } from '../../utils/auth/authCore.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    const action = url.searchParams.get('action') || '';
    const id = url.searchParams.get('id') || '';
    const dir = url.searchParams.get('dir') || '';
    const atlasId = url.searchParams.get('atlasId') || '';
    const includeTags = url.searchParams.get('includeTags') || '';
    const startTime = parseInt(url.searchParams.get('startTime'), 10) || 0;
    const endTime = parseInt(url.searchParams.get('endTime'), 10) || 0;

    const db = getDatabase(env);
    if (!db) {
        return new Response(JSON.stringify({ success: false, message: 'Database not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    // 检查管理员身份
    const authResult = await authenticate({ env, request, authScope: AUTH_SCOPE.ADMIN });
    const isAdmin = Boolean(authResult && authResult.authorized);

    // 若非管理员：必须指定具体的 atlasId，且该 atlasId 对应的图志必须是公开的 (is_public = 1)
    if (!isAdmin) {
        if (!atlasId || atlasId === 'all') {
            return new Response(JSON.stringify({ success: false, message: 'Unauthorized. Admin login required to view all footprints.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const atlas = await db.getAtlas(atlasId);
        if (!atlas || !atlas.is_public) {
            return new Response(JSON.stringify({ success: false, message: 'Unauthorized. This atlas is private.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }

    try {
        // ==================== 阶段二：详情按需拉取 ====================
        if (action === 'detail') {
            if (!id) {
                return new Response(JSON.stringify({ success: false, message: 'File ID is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            const fileRecord = await db.getFile(id);
            if (!fileRecord) {
                return new Response(JSON.stringify({ success: false, message: 'File not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            const meta = fileRecord.metadata || {};
            const rawUrl = `/file/${id}`;
            const thumbUrl = `/file/${id}?width=400&fit=cover`;

            return new Response(JSON.stringify({
                success: true,
                data: [{
                    id: id,
                    rawUrl: rawUrl,
                    thumbUrl: thumbUrl,
                    name: meta.locationName || meta.location_name || '',
                    description: meta.description || '',
                    date: meta.TimeStamp || meta.timestamp || 0,
                    dir: meta.Directory || meta.directory || '',
                    tags: Array.isArray(meta.Tags) ? meta.Tags : []
                }]
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // ==================== 阶段一：足迹散点列表拉取 (支持 atlasId) ====================
        // 若指定了具体图志，先读取图志规则与包含/排除项
        let atlasRules = null;
        let atlasIncluded = [];
        let atlasExcluded = [];

        if (atlasId && atlasId !== 'all' && typeof db.getAtlas === 'function') {
            const atlas = await db.getAtlas(atlasId);
            if (atlas) {
                atlasRules = typeof atlas.query_rules === 'string' ? JSON.parse(atlas.query_rules || '{}') : (atlas.query_rules || {});
                const items = await db.getAtlasItems(atlasId);
                atlasIncluded = items.filter(i => i.relation_type === 'include').map(i => i.file_id);
                atlasExcluded = items.filter(i => i.relation_type === 'exclude').map(i => i.file_id);
            }
        }

        // 若底层为 D1，直接执行极速空间索引查询
        if (db.db && typeof db.db.prepare === 'function') {
            let query = 'SELECT id, file_name, timestamp, directory, tags, latitude, longitude, location_name FROM files WHERE latitude IS NOT NULL AND longitude IS NOT NULL';
            const params = [];

            if (dir && dir !== 'all') {
                query += ' AND directory LIKE ?';
                params.push(dir.endsWith('/') ? `${dir}%` : `${dir}/%`);
            }

            if (startTime > 0) {
                query += ' AND timestamp >= ?';
                params.push(startTime);
            }

            if (endTime > 0) {
                query += ' AND timestamp <= ?';
                params.push(endTime);
            }

            query += ' ORDER BY timestamp DESC LIMIT 5000';

            let stmt = db.db.prepare(query);
            if (params.length > 0) {
                stmt = stmt.bind(...params);
            }

            const result = await stmt.all();
            let rows = result.results || [];

            // 图志规则与黑白名单过滤 (REQ-002)
            if (atlasRules || atlasIncluded.length > 0 || atlasExcluded.length > 0) {
                const targetDirs = Array.isArray(atlasRules?.directories) ? atlasRules.directories : [];
                const targetTags = Array.isArray(atlasRules?.tags) ? atlasRules.tags.map(t => t.toLowerCase()) : [];

                rows = rows.filter(row => {
                    // 1. 显式排除项强拦截
                    if (atlasExcluded.includes(row.id)) return false;

                    // 2. 显式包含项优先命中
                    if (atlasIncluded.includes(row.id)) return true;

                    // 3. 规则命中判定
                    let matched = false;
                    if (targetDirs.length > 0 && row.directory) {
                        matched = targetDirs.some(td => row.directory.startsWith(td));
                    }
                    if (!matched && targetTags.length > 0 && row.tags) {
                        let rowTags = [];
                        try {
                            rowTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (Array.isArray(row.tags) ? row.tags : []);
                        } catch (e) {}
                        const lower = rowTags.map(t => String(t).toLowerCase());
                        matched = targetTags.some(tt => lower.includes(tt));
                    }

                    return matched;
                });
            }

            // 内存过滤多标签（若有指定）
            if (includeTags) {
                const requiredTags = includeTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                if (requiredTags.length > 0) {
                    rows = rows.filter(row => {
                        let rowTags = [];
                        try {
                            rowTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (Array.isArray(row.tags) ? row.tags : []);
                        } catch (e) {
                            rowTags = [];
                        }
                        const lowerTags = rowTags.map(t => String(t).toLowerCase());
                        return requiredTags.some(rt => lowerTags.includes(rt));
                    });
                }
            }

            const lightMarkers = rows.map(r => {
                let parsedTags = [];
                try {
                    parsedTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : (Array.isArray(r.tags) ? r.tags : []);
                } catch (e) {
                    parsedTags = [];
                }

                return {
                    id: r.id,
                    lat: Number(r.latitude),
                    lng: Number(r.longitude),
                    name: r.location_name || '',
                    dir: r.directory || '',
                    date: r.timestamp || 0,
                    tags: parsedTags
                };
            });

            return new Response(JSON.stringify({
                success: true,
                total: lightMarkers.length,
                data: lightMarkers
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // KV 降级遍历实现
        const listResult = await db.listFiles({ limit: 1000 });
        const keys = listResult.keys || [];
        const lightMarkers = [];

        for (const item of keys) {
            const meta = item.metadata || {};
            const lat = meta.Latitude !== undefined ? Number(meta.Latitude) : (meta.latitude !== undefined ? Number(meta.latitude) : null);
            const lng = meta.Longitude !== undefined ? Number(meta.Longitude) : (meta.longitude !== undefined ? Number(meta.longitude) : null);

            if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
                if (dir && dir !== 'all' && !(meta.Directory || '').startsWith(dir)) {
                    continue;
                }
                lightMarkers.push({
                    id: item.name,
                    lat,
                    lng,
                    name: meta.LocationName || meta.location_name || '',
                    dir: meta.Directory || '',
                    date: meta.TimeStamp || 0,
                    tags: Array.isArray(meta.Tags) ? meta.Tags : []
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total: lightMarkers.length,
            data: lightMarkers
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

    } catch (error) {
        console.error('Error in footprint API:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
