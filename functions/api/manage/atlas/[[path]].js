import { getDatabase } from '../../../utils/databaseAdapter.js';
import { authenticate, AUTH_SCOPE } from '../../../utils/auth/authCore.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, params } = context;
    const url = new URL(request.url);

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

    // 检查管理员身份
    const authResult = await authenticate({ env, request, authScope: AUTH_SCOPE.ADMIN });
    const isAdmin = Boolean(authResult && authResult.authorized);

    const pathArray = params.path || [];
    const subAction = pathArray[0] || '';

    try {
        // 1. GET 请求
        if (request.method === 'GET') {
            // 列出所有图志
            if (subAction === 'list' || subAction === '') {
                let atlases = await db.listAtlases();

                // 非管理员仅返回公开的图志
                if (!isAdmin) {
                    atlases = atlases.filter(a => Boolean(a.is_public));
                }
                
                // 格式化输出，处理自愈封面
                const formatted = await Promise.all(atlases.map(async (a) => {
                    let coverUrl = a.cover_file_id ? `/file/${a.cover_file_id}` : null;
                    
                    // 若无封面或封面照片可能失效，自愈查找第一张有坐标的照片
                    if (!coverUrl) {
                        try {
                            const firstPhoto = await db.db.prepare(
                                'SELECT id FROM files WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY timestamp DESC LIMIT 1'
                            ).first();
                            if (firstPhoto) {
                                coverUrl = `/file/${firstPhoto.id}`;
                            }
                        } catch (e) {}
                    }

                    return {
                        id: a.id,
                        name: a.name,
                        description: a.description || '',
                        coverFileId: a.cover_file_id,
                        coverUrl: coverUrl || '/static/media/logo.png',
                        queryRules: typeof a.query_rules === 'string' ? JSON.parse(a.query_rules || '{}') : (a.query_rules || {}),
                        sortOrder: a.sort_order || 0,
                        isPublic: Boolean(a.is_public),
                        createdAt: a.created_at,
                        updatedAt: a.updated_at
                    };
                }));

                return new Response(JSON.stringify({ success: true, data: formatted }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            // 获取单个图志详情
            const atlasId = subAction;
            const atlas = await db.getAtlas(atlasId);
            if (!atlas) {
                return new Response(JSON.stringify({ success: false, message: 'Atlas not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            // 若为私密图志且非管理员，拒绝访问并返回 401
            if (!isAdmin && !atlas.is_public) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized. This atlas is private.' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const items = await db.getAtlasItems(atlasId);
            const included = items.filter(i => i.relation_type === 'include').map(i => i.file_id);
            const excluded = items.filter(i => i.relation_type === 'exclude').map(i => i.file_id);

            return new Response(JSON.stringify({
                success: true,
                data: {
                    id: atlas.id,
                    name: atlas.name,
                    description: atlas.description || '',
                    coverFileId: atlas.cover_file_id,
                    queryRules: typeof atlas.query_rules === 'string' ? JSON.parse(atlas.query_rules || '{}') : (atlas.query_rules || {}),
                    sortOrder: atlas.sort_order || 0,
                    isPublic: Boolean(atlas.is_public),
                    includedFileIds: included,
                    excludedFileIds: excluded,
                    createdAt: atlas.created_at,
                    updatedAt: atlas.updated_at
                }
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 2. POST 请求 (创建或更新图志，必须管理员)
        if (request.method === 'POST') {
            if (!isAdmin) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized. Admin login required.' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const body = await request.json();
            const name = (body.name || '').trim();
            if (!name) {
                return new Response(JSON.stringify({ success: false, message: 'Atlas name is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const id = body.id || `atlas_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const atlasData = {
                id: id,
                name: name,
                description: body.description || '',
                cover_file_id: body.coverFileId || body.cover_file_id || null,
                query_rules: body.queryRules || body.query_rules || body.rules || {},
                sort_order: parseInt(body.sortOrder || body.sort_order, 10) || 0,
                is_public: Boolean(body.isPublic || body.is_public)
            };

            await db.putAtlas(atlasData);
            
            // 显式包含与排除项
            const included = Array.isArray(body.includedFileIds) ? body.includedFileIds : [];
            const excluded = Array.isArray(body.excludedFileIds) ? body.excludedFileIds : [];
            await db.setAtlasItems(id, included, excluded);

            return new Response(JSON.stringify({ success: true, id: id, message: 'Atlas saved successfully' }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 3. DELETE 请求 (必须管理员)
        if (request.method === 'DELETE') {
            if (!isAdmin) {
                return new Response(JSON.stringify({ success: false, message: 'Unauthorized. Admin login required.' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const id = url.searchParams.get('id') || subAction;
            if (!id) {
                return new Response(JSON.stringify({ success: false, message: 'Atlas ID is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            await db.deleteAtlas(id);
            return new Response(JSON.stringify({ success: true, message: 'Atlas deleted successfully' }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (err) {
        console.error('Error in atlas API:', err);
        return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
