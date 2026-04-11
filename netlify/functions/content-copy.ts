import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const HUMAN_VOICE_RULES = `

WRITING STYLE RULES (critical, must follow):
- Never use em-dashes (—) or en-dashes (–). Use periods, commas, colons, or parentheses instead.
- Never use these words/phrases: delve, leverage, robust, seamlessly, comprehensive, holistic, empower, streamline, cutting-edge, state-of-the-art, embark, harness, tapestry, vibrant, transformative, paramount, pivotal, moreover, furthermore, in essence, it is worth noting, in conclusion, ultimately, navigate the complexities, in today's, in the realm of.
- Do not start sentences with "Indeed", "Notably", "Importantly", or "However,".
- Do not end with a "Conclusion" or "In summary" paragraph that just restates the body.
- Write plain, direct, conversational English. Short sentences. No throat-clearing.
- Sound like a real person wrote this, not like a press release.`;

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
    const { video_idea_id, platforms } = JSON.parse(event.body || '{}');

    if (!video_idea_id || !platforms || !platforms.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'video_idea_id and platforms are required' }),
      };
    }

    // Fetch idea
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

    // Fetch prompt
    const { data: prompt } = await supabase
      .from('video_prompts')
      .select('*')
      .eq('video_idea_id', video_idea_id)
      .single();

    const systemPrompt = `You are a social media copywriter for DisputeMyHOA, a service that helps homeowners fight unfair HOA fines. Write engaging, viral copy for social media video posts. The tone should be sarcastic, relatable, and champion the homeowner. Return JSON only, no markdown, no code fences.`;

    const platformInstructions = platforms.map((p: string) => {
      switch (p) {
        case 'tiktok':
          return 'TikTok: { "caption": "<POV format caption with emoji>", "hashtags": ["<max 5 hashtags without # symbol>"] }';
        case 'instagram':
          return 'Instagram: { "caption": "<POV format caption with emoji>", "hashtags": ["<max 5 hashtags without # symbol>"] }';
        case 'youtube':
          return 'YouTube: { "title": "<clickbait-style title under 100 chars>", "description": "<2-3 sentence description>", "tags": ["<relevant tags>"] }';
        case 'facebook':
          return 'Facebook: { "caption": "<POV format caption>" }';
        default:
          return '';
      }
    }).filter(Boolean).join('\n');

    const userPrompt = `Generate platform-specific copy for this video:
Scenario: ${idea.scenario}
Violation: ${idea.violation_type}
Fine: $${idea.fine_amount}
${prompt ? `Script: ${prompt.script}` : ''}

Caption format for TikTok/Instagram/Facebook:
"POV: [scenario hook] [relevant emoji]
Comments are open, Karen
Got a real violation? disputemyhoa.com"

Generate copy for these platforms:
${platformInstructions}

Return as JSON with platform names as keys:
{ ${platforms.map((p: string) => `"${p}": { ... }`).join(', ')} }`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt + HUMAN_VOICE_RULES,
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('content-copy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate copy',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
