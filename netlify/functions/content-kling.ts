import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;
const KLING_API_URL = 'https://api.klingai.com/v1/videos/text2video';
const KLING_STATUS_URL = 'https://api.klingai.com/v1/videos/text2video';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function generateJWT(): string {
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    throw new Error('Kling API keys not configured');
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    iss: KLING_ACCESS_KEY,
    exp: now + 1800,
    nbf: now - 5,
  };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signature = crypto
    .createHmac('sha256', KLING_SECRET_KEY)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Kling API keys not configured' }) };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    if (action === 'generate') {
      // Submit video generation for all shots of an idea
      const { video_idea_id } = body;

      if (!video_idea_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'video_idea_id is required' }) };
      }

      // Get the prompt shots
      const { data: prompt } = await supabase
        .from('video_prompts')
        .select('*')
        .eq('video_idea_id', video_idea_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!prompt?.shots) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'No approved prompts found' }) };
      }

      // Get existing assets
      const { data: assets } = await supabase
        .from('video_assets')
        .select('*')
        .eq('video_idea_id', video_idea_id)
        .order('shot_number', { ascending: true });

      if (!assets || assets.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'No asset slots found' }) };
      }

      const token = generateJWT();
      const results = [];

      // Submit each shot that is still in 'generating' status (no kling_job_id yet)
      for (const asset of assets) {
        if (asset.kling_job_id && asset.status !== 'rejected') {
          results.push(asset);
          continue;
        }

        const shot = prompt.shots.find((s: { shot_number: number }) => s.shot_number === asset.shot_number);
        if (!shot) {
          results.push(asset);
          continue;
        }

        const klingResponse = await fetch(KLING_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: shot.kling_prompt,
            duration: String(Math.min(Math.max(shot.duration, 5), 10)),
            aspect_ratio: '9:16',
            model_name: 'kling-v1-6',
            mode: 'std',
            enable_audio: true,
          }),
        });

        const klingData = await klingResponse.json();

        if (!klingResponse.ok || klingData.code) {
          const errMsg = klingData.message || `HTTP ${klingResponse.status}`;
          console.error(`Kling API error for shot ${asset.shot_number}:`, errMsg);
          // Return the error on first shot failure so user sees the real message
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              assets: [],
              error: `Kling API: ${errMsg}`,
            }),
          };
        }
        const taskId = klingData.data?.task_id || klingData.data?.id || klingData.task_id || klingData.id;

        if (taskId) {
          const { data: updated } = await supabase
            .from('video_assets')
            .update({ kling_job_id: taskId, status: 'generating' })
            .eq('id', asset.id)
            .select()
            .single();

          results.push(updated || asset);
        } else {
          console.error('No task_id in Kling response:', klingData);
          results.push({ ...asset, error: 'No task_id returned' });
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ assets: results }) };
    }

    if (action === 'check_status') {
      // Poll status for all generating assets of an idea
      const { video_idea_id } = body;

      if (!video_idea_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'video_idea_id is required' }) };
      }

      const { data: assets } = await supabase
        .from('video_assets')
        .select('*')
        .eq('video_idea_id', video_idea_id)
        .eq('status', 'generating')
        .order('shot_number', { ascending: true });

      if (!assets || assets.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ assets: [], all_complete: true }) };
      }

      const token = generateJWT();
      const updated = [];

      for (const asset of assets) {
        if (!asset.kling_job_id) continue;

        const statusResponse = await fetch(`${KLING_STATUS_URL}/${asset.kling_job_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!statusResponse.ok) {
          updated.push(asset);
          continue;
        }

        const statusData = await statusResponse.json();
        const taskData = statusData.data || statusData;
        const taskStatus = taskData.task_status || taskData.status;

        if (taskStatus === 'succeed' || taskStatus === 'completed') {
          // Extract video URL from response
          const videoUrl =
            taskData.task_result?.videos?.[0]?.url ||
            taskData.video?.url ||
            taskData.works?.[0]?.video?.resource ||
            taskData.output?.video_url ||
            null;

          if (videoUrl) {
            const { data: updatedAsset } = await supabase
              .from('video_assets')
              .update({ file_url: videoUrl, status: 'ready' })
              .eq('id', asset.id)
              .select()
              .single();

            updated.push(updatedAsset || asset);
          } else {
            updated.push(asset);
          }
        } else if (taskStatus === 'failed') {
          const { data: updatedAsset } = await supabase
            .from('video_assets')
            .update({ status: 'rejected' })
            .eq('id', asset.id)
            .select()
            .single();

          updated.push(updatedAsset || asset);
        } else {
          // Still processing
          updated.push(asset);
        }
      }

      // Check if all assets are now done
      const { data: allAssets } = await supabase
        .from('video_assets')
        .select('*')
        .eq('video_idea_id', video_idea_id)
        .order('shot_number', { ascending: true });

      const allComplete = allAssets?.every(a => a.status === 'ready' || a.status === 'rejected') ?? false;

      // If all complete, update idea status to review
      if (allComplete && allAssets && allAssets.length > 0) {
        await supabase
          .from('video_ideas')
          .update({ status: 'review' })
          .eq('id', video_idea_id);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ assets: allAssets || [], all_complete: allComplete }),
      };
    }

    if (action === 'regenerate_shot') {
      // Regenerate a single rejected shot
      const { asset_id } = body;

      if (!asset_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'asset_id is required' }) };
      }

      const { data: asset } = await supabase
        .from('video_assets')
        .select('*')
        .eq('id', asset_id)
        .single();

      if (!asset) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Asset not found' }) };
      }

      const { data: prompt } = await supabase
        .from('video_prompts')
        .select('*')
        .eq('video_idea_id', asset.video_idea_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const shot = prompt?.shots?.find((s: { shot_number: number }) => s.shot_number === asset.shot_number);
      if (!shot) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Shot prompt not found' }) };
      }

      const token = generateJWT();

      const klingResponse = await fetch(KLING_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: shot.kling_prompt,
          duration: String(Math.min(Math.max(shot.duration, 5), 10)),
          aspect_ratio: '9:16',
          model_name: 'kling-v1-6',
          mode: 'std',
        }),
      });

      if (!klingResponse.ok) {
        const errText = await klingResponse.text();
        return { statusCode: 500, headers, body: JSON.stringify({ error: `Kling API error: ${errText}` }) };
      }

      const klingData = await klingResponse.json();
      const taskId = klingData.data?.task_id || klingData.data?.id || klingData.task_id || klingData.id;

      const { data: updated } = await supabase
        .from('video_assets')
        .update({ kling_job_id: taskId, status: 'generating', file_url: null })
        .eq('id', asset_id)
        .select()
        .single();

      return { statusCode: 200, headers, body: JSON.stringify(updated) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (error) {
    console.error('content-kling error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Kling operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
