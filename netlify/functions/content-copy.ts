import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const HUMAN_VOICE_RULES = `

WRITING STYLE RULES (critical):
- Never use em-dashes or en-dashes. Use periods, commas, colons instead.
- Write plain, direct, conversational English. Short sentences.`;

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

const SYSTEM_PROMPT = `You are a social media copywriter for DisputeMyHOA viral HOA content. Write platform-specific copy. Return JSON only, no markdown, no code fences.

CAPTION FORMULA (TikTok, Instagram, Facebook):
"[POV hook line] [relevant emoji]

Drop your HOA horror story below [down arrow emoji]

Got a real violation? disputemyhoa.com"

IMPORTANT FOR FACEBOOK: Do NOT include the disputemyhoa.com link in the caption itself. Instead write it as:
"[POV hook line] [relevant emoji]

Drop your HOA horror story below [down arrow emoji]"
(The link goes as the first comment, not in the caption. Links in Facebook captions reduce reach.)

YOUTUBE FORMAT:
Title: "[Specific violation detail]. HOA [enforcement action] [emoji]"
Description: "[2-3 sentence summary]

Drop your HOA horror story below [down arrow emoji]

Got a real HOA violation? Fight back in 60 seconds.
[right arrow emoji] disputemyhoa.com

#HOA #HOAproblems #homeowner #[topic-specific] #shorts"

HASHTAG RULES (enforce exactly):
- TikTok: exactly 5 hashtags. Always end with #fyp. Third is always #homeowner.
- Instagram: exactly 5 hashtags. Always end with #reels. Third is always #homeowner.
- YouTube: included in the description, not a separate field.
- Facebook: no hashtags.
- Fourth hashtag must be topic-specific to the violation (e.g. #birdbath, #ringcamera, #welcomemat).
- Never use more than 5 hashtags on any platform.`;

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const { video_idea_id, platforms } = JSON.parse(event.body || '{}');

    if (!video_idea_id || !platforms || !platforms.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'video_idea_id and platforms are required' }) };
    }

    const { data: idea, error: ideaError } = await supabase
      .from('video_ideas')
      .select('*')
      .eq('id', video_idea_id)
      .single();

    if (ideaError || !idea) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Video idea not found' }) };
    }

    const { data: prompt } = await supabase
      .from('video_prompts')
      .select('*')
      .eq('video_idea_id', video_idea_id)
      .single();

    const platformInstructions = platforms.map((p: string) => {
      switch (p) {
        case 'tiktok':
          return 'TikTok: { "caption": "POV hook + emoji + drop your story + disputemyhoa.com", "hashtags": ["exactly 5 without #, third=homeowner, last=fyp, fourth=topic-specific"] }';
        case 'instagram':
          return 'Instagram: { "caption": "POV hook + emoji + drop your story + disputemyhoa.com", "hashtags": ["exactly 5 without #, third=homeowner, last=reels, fourth=topic-specific"] }';
        case 'youtube':
          return 'YouTube: { "title": "violation detail. HOA enforcement action emoji (under 100 chars)", "description": "full description with hashtags as specified in the format above", "tags": ["relevant tags"] }';
        case 'facebook':
          return 'Facebook: { "caption": "POV hook + emoji + drop your story. NO link in caption. NO hashtags.", "link_comment": "disputemyhoa.com (post this as first comment)" }';
        default:
          return '';
      }
    }).filter(Boolean).join('\n');

    const userPrompt = `Generate platform-specific copy for this video:
Scenario: ${idea.scenario}
Violation: ${idea.violation_type}
Fine: $${idea.fine_amount}
${prompt ? `Script: ${prompt.script}` : ''}
${idea.viral_hook ? `Viral hook: ${idea.viral_hook}` : ''}

Generate copy for these platforms:
${platformInstructions}

Return as JSON with platform names as keys: { ${platforms.map((p: string) => `"${p}": { ... }`).join(', ')} }`;

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
        system: SYSTEM_PROMPT + HUMAN_VOICE_RULES,
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
