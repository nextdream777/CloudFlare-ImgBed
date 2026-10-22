import { addFileToIndex } from '../../../utils/indexManager.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { purgeCFCache } from '../../../utils/purgeCache.js';
import { normalizeLocationAddress } from '../../../upload/uploadTools.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            message: 'Method not allowed. Use POST.',
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid request body. Expected JSON.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const fileId = body.id;
        if (!fileId) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File ID (id) is required.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 坐标合法性防呆校验 (WGS-84 规范)
        let lat = body.latitude;
        let lng = body.longitude;

        if (lat !== null && lat !== undefined) {
            lat = Number(lat);
            if (isNaN(lat) || lat < -90 || lat > 90) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Latitude must be a valid number between -90 and 90.',
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
        } else {
            lat = null;
        }

        if (lng !== null && lng !== undefined) {
            lng = Number(lng);
            if (isNaN(lng) || lng < -180 || lng > 180) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Longitude must be a valid number between -180 and 180.',
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
        } else {
            lng = null;
        }

        const rawLoc = body.location_name !== undefined ? (body.location_name ? String(body.location_name).trim() : null) : (body.locationName ? String(body.locationName).trim() : null);
        const locationName = rawLoc ? normalizeLocationAddress(rawLoc) : null;
        const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : null;

        const db = getDatabase(env);
        const fileData = await db.getWithMetadata(fileId);

        if (!fileData || !fileData.metadata) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File not found.',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 双写合并：更新 metadata JSON 对象
        const updatedMetadata = { ...fileData.metadata };
        updatedMetadata.Latitude = lat;
        updatedMetadata.Longitude = lng;
        updatedMetadata.LocationName = locationName;
        updatedMetadata.Description = description;

        // 执行持久化保存 (d1Database.js 自动写入列与 metadata JSON)
        await db.putFile(fileId, fileData.value, { metadata: updatedMetadata });

        // 异步同步至 indexManager 与 CDN 缓存清除
        waitUntil(addFileToIndex(context, fileId, updatedMetadata));
        if (typeof purgeCFCache === 'function') {
            waitUntil(purgeCFCache(env, fileId, url.hostname));
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Geographic data and story updated successfully.',
            data: {
                id: fileId,
                latitude: lat,
                longitude: lng,
                locationName: locationName,
                description: description
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

    } catch (error) {
        console.error('Error in geo metadata update:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
