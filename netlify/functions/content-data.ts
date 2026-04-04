import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Supabase not configured' }),
    };
  }

  try {
    // GET: fetch ideas or a single idea with relations
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id;
      const status = event.queryStringParameters?.status;

      if (id) {
        // Fetch single idea with related data
        const { data: idea, error } = await supabase
          .from('video_ideas')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !idea) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Idea not found' }),
          };
        }

        const { data: prompt } = await supabase
          .from('video_prompts')
          .select('*')
          .eq('video_idea_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: assets } = await supabase
          .from('video_assets')
          .select('*')
          .eq('video_idea_id', id)
          .order('shot_number', { ascending: true });

        const { data: post } = await supabase
          .from('video_posts')
          .select('*')
          .eq('video_idea_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...idea,
            prompt: prompt || undefined,
            assets: assets || [],
            post: post || undefined,
          }),
        };
      }

      // Fetch list of ideas
      let query = supabase
        .from('video_ideas')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: ideas, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(ideas || []),
      };
    }

    // POST: handle various write actions
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action } = body;

      switch (action) {
        case 'save_idea': {
          const { data, error } = await supabase
            .from('video_ideas')
            .insert({
              type: body.type,
              scenario: body.scenario,
              violation_type: body.violation_type,
              fine_amount: body.fine_amount,
              status: 'idea',
            })
            .select()
            .single();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        case 'update_idea_status': {
          const { error } = await supabase
            .from('video_ideas')
            .update({ status: body.status })
            .eq('id', body.id);

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        case 'update_prompt': {
          const { data, error } = await supabase
            .from('video_prompts')
            .update({ shots: body.shots })
            .eq('id', body.id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        case 'approve_prompts': {
          // Mark prompt as approved
          const { data: approvedPrompt } = await supabase
            .from('video_prompts')
            .update({ status: 'approved' })
            .eq('video_idea_id', body.video_idea_id)
            .select()
            .single();

          // Auto-create asset slots from the prompt shots
          if (approvedPrompt?.shots && Array.isArray(approvedPrompt.shots)) {
            const assets = approvedPrompt.shots.map((shot: { shot_number: number; duration: number }) => ({
              video_idea_id: body.video_idea_id,
              shot_number: shot.shot_number,
              duration: shot.duration,
              status: 'generating',
            }));

            await supabase
              .from('video_assets')
              .insert(assets);
          }

          // Update idea status to generating
          await supabase
            .from('video_ideas')
            .update({ status: 'generating' })
            .eq('id', body.video_idea_id);

          // Return the full idea with relations so the UI updates in one call
          const { data: fullIdea } = await supabase
            .from('video_ideas')
            .select('*')
            .eq('id', body.video_idea_id)
            .single();

          const { data: newAssets } = await supabase
            .from('video_assets')
            .select('*')
            .eq('video_idea_id', body.video_idea_id)
            .order('shot_number', { ascending: true });

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              ok: true,
              idea: fullIdea,
              assets: newAssets || [],
              prompt: approvedPrompt,
            }),
          };
        }

        case 'create_assets': {
          const assets = body.shots.map((shot: { shot_number: number; duration: number }) => ({
            video_idea_id: body.video_idea_id,
            shot_number: shot.shot_number,
            duration: shot.duration,
            status: 'generating',
          }));

          const { data, error } = await supabase
            .from('video_assets')
            .insert(assets)
            .select();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        case 'update_asset': {
          const updates: Record<string, unknown> = {};
          if (body.status) updates.status = body.status;
          if (body.file_url) updates.file_url = body.file_url;
          if (body.kling_job_id) updates.kling_job_id = body.kling_job_id;

          const { data, error } = await supabase
            .from('video_assets')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        case 'save_post': {
          const { data, error } = await supabase
            .from('video_posts')
            .insert({
              video_idea_id: body.video_idea_id,
              platforms: body.platforms,
              copy: body.copy,
              status: 'draft',
            })
            .select()
            .single();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        case 'update_copy': {
          const { data, error } = await supabase
            .from('video_posts')
            .update({ copy: body.copy })
            .eq('id', body.id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        case 'approve_copy': {
          await supabase
            .from('video_posts')
            .update({ status: 'copy_approved' })
            .eq('video_idea_id', body.video_idea_id);

          return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        case 'publish_platform': {
          // TODO: Wire in TikTok/Meta/YouTube API calls in a future phase.
          // For now, this just marks the platform as published in the copy metadata.
          const { data: post, error: fetchError } = await supabase
            .from('video_posts')
            .select('*')
            .eq('id', body.id)
            .single();

          if (fetchError || !post) throw new Error('Post not found');

          const copy = post.copy || {};
          if (copy[body.platform]) {
            copy[body.platform].published = true;
          }

          // Check if all platforms are published
          const platforms = post.platforms || [];
          const allPublished = platforms.every((p: string) => copy[p]?.published);

          const updates: Record<string, unknown> = { copy };
          if (allPublished) {
            updates.status = 'published';
            // Also update the idea status
            await supabase
              .from('video_ideas')
              .update({ status: 'published' })
              .eq('id', post.video_idea_id);
          }

          const { data, error } = await supabase
            .from('video_posts')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single();

          if (error) throw new Error(error.message);
          return { statusCode: 200, headers, body: JSON.stringify(data) };
        }

        default:
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Unknown action: ${action}` }),
          };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('content-data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
