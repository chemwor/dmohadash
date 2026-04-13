import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const HUMAN_VOICE_RULES = `

WRITING STYLE RULES (critical, must follow):
- Never use em-dashes or en-dashes. Use periods, commas, colons, or parentheses instead.
- Never use: delve, leverage, robust, seamlessly, comprehensive, holistic, empower, streamline, cutting-edge, state-of-the-art, embark, harness, tapestry, vibrant, transformative, paramount, pivotal, moreover, furthermore, in essence, it is worth noting, in conclusion, ultimately, navigate the complexities, in today's, in the realm of.
- Write plain, direct, conversational English. Short sentences.`;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Video types that are implemented vs coming soon
const IMPLEMENTED_TYPES = ['board_meeting', 'doorbell_footage', 'news_broadcast'];
const COMING_SOON_TYPES = ['street_confrontation', 'official_document', 'homeowner_pov'];

const TYPE_DESCRIPTIONS: Record<string, string> = {
  board_meeting: 'an HOA board meeting where the board president announces an absurd violation and fine to a stunned homeowner',
  doorbell_footage: 'Ring doorbell camera footage catching an HOA representative performing an absurd inspection at the front door',
  news_broadcast: 'a local news anchor delivering a breaking story about a ridiculous HOA fine with completely straight delivery',
};

// Top-performing content insights from actual account data (YouTube analytics)
const PERFORMANCE_CONTEXT = `
TOP-PERFORMING CONTENT DATA FROM OUR ACCOUNT:
- "HOA Dog Incident" = 5,623 views (BEST performer)
- "HOA Rep Caught Measuring My Tulip at 6:47am" = 4,207 views
- "Cat HOA Incident" = 2,671 views
- "Light HOA Incident" = 1,984 views
- "Wrong Font on Welcome Mat" = 1,440 views
- "HOA Spotify Incident" = 1,273 views
- "HOA Garden Gnome Incident" = 1,187 views
FLOPS (under 20 views): news about grass, tree shadows, Amazon packages, trash cans

PATTERNS THAT WORK:
- Animals/pets in the violation (dogs, cats, birds) get 2-5x more views
- "HOA [Subject] Incident" naming gets the most clicks
- Ring camera "caught on camera" angle feels voyeuristic, high engagement
- Absurd measurement specifics (measuring tulips, counting decibels)
- Mundane everyday objects being treated as serious violations

PATTERNS THAT FLOP:
- Generic violations everyone has (trash cans, generic landscaping)
- Abstract concepts (shadows, generic "noise")
- News broadcast format gets low views unless the content is extremely absurd

USE THIS DATA: Weight your ideas toward the patterns that work. Animals, specific measurements, caught-on-camera angles, and everyday objects treated as crimes.`;

const SYSTEM_PROMPT = `You are a script writer for viral HOA content. Generate exactly 4 video scenario ideas for the given video type. Return only valid JSON, no markdown, no preamble.

${PERFORMANCE_CONTEXT}

Rules:
- Fine amounts must be between $8,000 and $25,000
- Scenario must be one sentence maximum
- Do not describe character reactions or board behavior in the scenario. That is written at script stage.
- The violation must be trivially mundane
- The enforcement action must be absurdly serious
- Lean into animals, pets, specific measurements, and everyday objects based on what performs best
- The viral_hook is the single most quotable phrase from the scenario. The thing someone would repeat to a friend.

Return this exact format:
{"ideas":[{"scenario":"one sentence","violation_type":"short label","fine_amount":number,"viral_hook":"the most shareable phrase"}]}`;

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

  try {
    const { type, seed } = JSON.parse(event.body || '{}');

    if (!type) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'type is required' }) };
    }

    if (COMING_SOON_TYPES.includes(type)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `${type} is coming soon. Use: ${IMPLEMENTED_TYPES.join(', ')}` }) };
    }

    const typeDesc = TYPE_DESCRIPTIONS[type] || type;
    const seedText = seed ? `\n\nUser wants ideas inspired by: "${seed}"` : '';

    // Fetch existing scenarios from Supabase to avoid duplicates
    let usedScenariosText = '';
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: existingIdeas } = await supabase
          .from('video_ideas')
          .select('scenario, violation_type')
          .order('created_at', { ascending: false })
          .limit(50);

        if (existingIdeas && existingIdeas.length > 0) {
          const usedList = existingIdeas
            .map((i: any) => `- ${i.scenario} (${i.violation_type})`)
            .join('\n');
          usedScenariosText = `\n\nALREADY USED SCENARIOS (do NOT repeat any of these topics or similar variations):\n${usedList}\n\nGenerate completely different scenarios from the above.`;
        }
      } catch (e) {
        // Non-fatal: proceed without duplicate check
        console.warn('Could not fetch existing scenarios:', e);
      }
    }

    // Also fetch titles of videos already posted on YouTube for awareness
    let postedVideosText = '';
    try {
      const ytResp = await fetch(
        'https://www.youtube.com/feeds/videos.xml?channel_id=UCB2_1EyFakAwhXvtvkbl19g',
        { headers: { 'User-Agent': 'DMHOA-ContentPipeline/1.0' } }
      );
      if (ytResp.ok) {
        const xml = await ytResp.text();
        const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)]
          .map(m => m[1])
          .filter(t => t !== 'DisputeMyHOA' && !t.includes('YouTube'));
        if (titles.length > 0) {
          postedVideosText = `\n\nVIDEOS ALREADY POSTED ON YOUTUBE (avoid these exact topics):\n${titles.map(t => `- ${t}`).join('\n')}`;
        }
      }
    } catch (e) {
      // Non-fatal
    }

    const userPrompt = `Generate exactly 4 video scenario ideas for this type: ${typeDesc}.${seedText}${usedScenariosText}${postedVideosText}

Each idea must have a fine between $8,000 and $25,000. Return exactly 4 ideas in the JSON format specified. Make sure every idea is DIFFERENT from the already-used scenarios listed above.`;

    // Call Claude with retry on 529/503/overloaded
    let claudeResponse: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: SYSTEM_PROMPT + HUMAN_VOICE_RULES,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (response.ok) {
        claudeResponse = await response.json();
        break;
      }

      // Retry on overloaded/rate limit
      if ([429, 503, 529].includes(response.status) && attempt < 2) {
        const delay = (attempt + 1) * 3000;
        console.warn(`Claude API ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/3)`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    if (!claudeResponse) {
      throw new Error('Claude API failed after 3 attempts');
    }

    const raw = claudeResponse.content[0].text;
    const text = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(text);

    // Validate fine amounts
    if (parsed.ideas) {
      parsed.ideas = parsed.ideas.filter((idea: any) => {
        const amt = idea.fine_amount;
        return typeof amt === 'number' && amt >= 8000 && amt <= 25000;
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('content-ideas error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate ideas',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
