import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
    };
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
    const { video_idea_id } = JSON.parse(event.body || '{}');

    if (!video_idea_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'video_idea_id is required' }),
      };
    }

    // Fetch the idea
    const { data: idea, error: ideaError } = await supabase
      .from('video_ideas')
      .select('*')
      .eq('id', video_idea_id)
      .single();

    if (ideaError || !idea) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Video idea not found' }),
      };
    }

    const systemPrompt = `You are a video production director for DisputeMyHOA viral social media content. You create shot-by-shot breakdowns for short-form vertical video (TikTok/Reels). Each video should feel like raw, authentic documentary footage. Return JSON only, no markdown, no code fences.`;

    const userPrompt = `Create a complete shot breakdown for this video:
Type: ${idea.type}
Scenario: ${idea.scenario}
Violation: ${idea.violation_type}
Fine: $${idea.fine_amount}

Return this exact JSON structure:
{
  "script": "<full script with all dialogue, formatted with character names before each line>",
  "shots": [
    {
      "shot_number": 1,
      "character": "<character name/role, e.g. 'HOA Board President Linda'>",
      "line": "<the dialogue this character says in this shot>",
      "duration": 5,
      "kling_prompt": "VERTICAL 9:16, 1080p, raw documentary footage, handheld camera, cinema verite style, single static <duration> second take, small HOA meeting room, drop ceiling fluorescent lights, beige cinder block walls, folding table wrinkled plastic tablecloth styrofoam cups hand-written nameplates reading BOARD OF DIRECTORS, American flag back right corner, analog wall clock showing 7pm, audience POV low angle, back of head of resident out of focus in bottom left foreground, <detailed character description including age, appearance, clothing, expression, body language>, only character visible in frame, mouth moving in sync with speech, subtle handheld camera shake, grainy texture, harsh fluorescent lighting, no color grading, no watermarks, no text overlays, authentic candid feel. Character says: <dialogue>"
    }
  ]
}

Create exactly 3 shots that tell the story. Each shot must be exactly 5 seconds. Total video duration must be exactly 15 seconds. Keep dialogue short and punchy — one line per shot.`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const raw = data.content[0].text;
    const text = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(text);

    const totalDuration = parsed.shots.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);

    // Save prompt record
    const { data: prompt, error: promptError } = await supabase
      .from('video_prompts')
      .insert({
        video_idea_id,
        shots: parsed.shots,
        script: parsed.script,
        shot_count: parsed.shots.length,
        total_duration: totalDuration,
        status: 'draft',
      })
      .select()
      .single();

    if (promptError) {
      throw new Error(`Failed to save prompt: ${promptError.message}`);
    }

    // Update idea status
    await supabase
      .from('video_ideas')
      .update({ status: 'prompt_ready' })
      .eq('id', video_idea_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(prompt),
    };
  } catch (error) {
    console.error('content-prompts error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate prompts',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
