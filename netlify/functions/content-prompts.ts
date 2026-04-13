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

// ============================================================================
// LOCKED KLING TEMPLATES PER FORMAT
// ============================================================================

const KLING_TEMPLATES: Record<string, any> = {
  board_meeting: {
    shots: [
      {
        shot_number: 1,
        character: 'Board President',
        duration_seconds: 10,
        template: `VERTICAL 9:16, 1080p, raw documentary footage, handheld camera, cinema verite style, single static 10 second take, small HOA meeting room, drop ceiling fluorescent lights, beige cinder block walls, folding table wrinkled plastic tablecloth styrofoam cups hand-written nameplate reading BOARD OF DIRECTORS taped to front of table, whiteboard behind reading HOA BOARD MEETING - AGENDA in marker, American flag back right corner, analog wall clock showing 7pm, CHARACTER: White male board president 60s receding grey hair reading glasses short sleeve button down shirt, seated behind table, looking directly into camera, completely expressionless flat monotone delivery, only character visible in frame, mouth moving in perfect sync with speech, back of head of resident slightly out of focus in bottom left foreground, audience POV low angle, subtle continuous handheld camera shake throughout, grainy texture, harsh fluorescent lighting, no color grading, no watermarks, no text overlays, authentic candid feel, single uncut take.\nCharacter says: [DIALOGUE]`,
        elevenlabs: {
          voice_type: 'Older male, 60s, deep, authoritative',
          stability: 95,
          expressiveness: 10,
          delivery_notes: 'Completely dead inside. Reads $XX,XXX fine like a grocery list. Zero emotional range.',
        },
      },
      {
        shot_number: 2,
        character: 'Homeowner',
        duration_seconds: 5,
        template: `VERTICAL 9:16, 1080p, raw documentary footage, handheld camera, cinema verite style, single static 5 second take, same HOA meeting room, drop ceiling fluorescent lights, beige cinder block walls, metal folding chairs visible in background, other residents partially visible blurred behind, CHARACTER: [HOMEOWNER_DESC] seated in metal folding chair facing camera, only character visible in frame, expression of pure disbelief shifting to outrage, eyes wide, mouth open, shaking head, mouth moving in perfect sync with speech, eye level camera angle, significant handheld camera shake as if person filming jolted toward them, grainy texture, harsh fluorescent lighting, no color grading, no watermarks, no text overlays, authentic candid feel, single uncut take.\nCharacter says: [DIALOGUE]`,
        elevenlabs: {
          voice_type: 'Varies per video. Match demographic description.',
          stability: 30,
          expressiveness: 95,
          delivery_notes: 'Full disbelief cracking into outrage. Peak expressiveness on the capitalized word.',
        },
      },
    ],
  },
  doorbell_footage: {
    shots: [
      {
        shot_number: 1,
        character: 'HOA Representative',
        duration_seconds: 15,
        template: `VERTICAL 9:16, 1080p, Ring doorbell camera POV footage, wide angle fisheye lens distortion, full color [TIME_OF_DAY] footage, timestamp watermark in top left corner reading [TIMESTAMP], motion detection banner across top reading FRONT DOOR - MOTION DETECTED, static camera mounted high looking down at front [LOCATION] at slight downward angle, SETTING: [LOCATION_DESC], CHARACTER: White male HOA representative 40s khaki pants polo shirt with HOA logo, [PROP], completely serious expression, treating [SUBJECT] like a crime scene, SCENE PLAYS OUT AS FOLLOWS: [ACTION_SEQUENCE], subtle camera grain throughout, slight fisheye distortion on edges, timestamp and motion banner persistent throughout entire clip, natural color, authentic Ring doorbell footage feel, single uncut 15 second take, no color grading, no additional watermarks, no text overlays`,
        elevenlabs: {
          voice_type: 'Male, 40s, clinical, self-important',
          stability: 90,
          expressiveness: 15,
          delivery_notes: 'Documentary narration style. Treats mundane objects like crime scene evidence.',
        },
      },
    ],
  },
  news_broadcast: {
    shots: [
      {
        shot_number: 1,
        character: 'News Anchor',
        duration_seconds: 15,
        template: `VERTICAL 9:16, 1080p, raw documentary footage, single static 15 second take, fake local news broadcast, professional studio lighting, shallow depth of field, SETTING: Local news studio, dark blue and grey background with out of focus city skyline graphic behind anchor, [STATION_NAME] logo visible in background, bottom of screen has red breaking news chyron banner reading BREAKING: [HEADLINE], scrolling news ticker along very bottom reading [TICKER_TEXT], top right corner bug logo reading [STATION_NAME], CHARACTER: Female news anchor late 30s, professional blazer, hair styled, light makeup, seated at news desk, looking directly into camera with completely serious expression, only character visible in frame, mouth moving in perfect sync with speech, SCENE PLAYS OUT AS FOLLOWS: [DIALOGUE], professional broadcast camera quality, studio lighting, no camera shake, crisp and clean, chyron and ticker persistent throughout, no color grading, no additional watermarks, single uncut 15 second take`,
        elevenlabs: {
          voice_type: 'Female, late 30s, professional broadcaster',
          stability: 85,
          expressiveness: 20,
          delivery_notes: 'Completely straight delivery. The flatness against the absurd content is the joke.',
        },
      },
    ],
  },
};

// ============================================================================
// FORMAT-SPECIFIC CLAUDE PROMPTS
// ============================================================================

function buildSystemPrompt(type: string, idea: any): string {
  const format = KLING_TEMPLATES[type];
  if (!format) throw new Error(`Unknown video type: ${type}`);

  const base = `You are a script writer for viral HOA content videos. You write scripts for the "${type}" format.

SCENARIO: ${idea.scenario}
VIOLATION: ${idea.violation_type}
FINE AMOUNT: $${idea.fine_amount.toLocaleString()} (DO NOT change this amount)

Your job: write the exact dialogue for each character and fill in the template placeholders. Return JSON only, no markdown.`;

  if (type === 'board_meeting') {
    return base + `

FORMAT: 2 shots, 15 seconds total.
- Shot 1 (10s): Board president delivers the violation + fine in a flat monotone.
  The dialogue must include: the specific violation detail (a measurement, time, count), and the exact fine amount $${idea.fine_amount.toLocaleString()}.
- Shot 2 (5s): Homeowner reacts with one shocked line that quotes the most absurd detail and ends with a question mark.

The homeowner description should vary per video. Alternate gender, age, ethnicity, and clothing. Examples: "Young Black woman 20s, braids, college hoodie", "Middle-aged white man 40s, beard, flannel shirt", "Older Hispanic woman 50s, reading glasses, cardigan". Pick one that feels fresh.

Return this exact JSON:
{
  "script": "full formatted script with character names",
  "shots": [
    {
      "shot_number": 1,
      "character": "Board President",
      "dialogue": "the exact words they say",
      "duration_seconds": 10,
      "kling_prompt": "the complete Kling prompt with [DIALOGUE] replaced by the actual dialogue",
      "elevenlabs_direction": { "voice_type": "Older male, 60s, deep, authoritative", "stability": 95, "expressiveness": 10, "delivery_notes": "Completely dead inside. Reads fine like a grocery list. Zero emotional range." }
    },
    {
      "shot_number": 2,
      "character": "Homeowner",
      "dialogue": "their shocked reaction line",
      "duration_seconds": 5,
      "kling_prompt": "the complete Kling prompt with [HOMEOWNER_DESC] and [DIALOGUE] filled in",
      "elevenlabs_direction": { "voice_type": "match the demographic description you chose", "stability": 30, "expressiveness": 95, "delivery_notes": "Full disbelief cracking into outrage. Peak expressiveness on the capitalized word." }
    }
  ]
}`;
  }

  if (type === 'doorbell_footage') {
    return base + `

FORMAT: 1 shot, 15 seconds total.
Single shot: Ring doorbell POV. HOA rep performing an absurd inspection while narrating.
4 beats: identify subject, take measurement/reading, confirm violation, state fine + threat of foreclosure.
Fine amount: $${idea.fine_amount.toLocaleString()}. Ends with threat of foreclosure proceedings.

Fill in ALL template placeholders: [TIME_OF_DAY], [TIMESTAMP], [LOCATION], [LOCATION_DESC], [PROP], [SUBJECT], [ACTION_SEQUENCE].

Return this exact JSON:
{
  "script": "full narration with timestamps",
  "shots": [
    {
      "shot_number": 1,
      "character": "HOA Representative",
      "dialogue": "the full narration",
      "duration_seconds": 15,
      "kling_prompt": "the complete Kling prompt with ALL placeholders filled in",
      "elevenlabs_direction": { "voice_type": "Male, 40s, clinical, self-important", "stability": 90, "expressiveness": 15, "delivery_notes": "Documentary narration style. Treats mundane objects like crime scene evidence." }
    }
  ]
}`;
  }

  if (type === 'news_broadcast') {
    return base + `

FORMAT: 1 shot, 15 seconds total.
Single shot: Fake news anchor delivers the story completely straight.
Script formula:
- Opening: "Breaking tonight. [Homeowner name]. [Absurd violation]."
- Middle: "The violation was discovered during [absurd enforcement method]. The homeowner has 48 hours to comply or face foreclosure proceedings."
- Close: "[Absurd final detail]. Reporting live, I'm [anchor name]. Back to you."
Fine amount: $${idea.fine_amount.toLocaleString()}.

Fill in ALL placeholders: [STATION_NAME], [HEADLINE], [TICKER_TEXT], [DIALOGUE].

Return this exact JSON:
{
  "script": "full anchor script",
  "shots": [
    {
      "shot_number": 1,
      "character": "News Anchor",
      "dialogue": "the full anchor script",
      "duration_seconds": 15,
      "kling_prompt": "the complete Kling prompt with ALL placeholders filled in",
      "elevenlabs_direction": { "voice_type": "Female, late 30s, professional broadcaster", "stability": 85, "expressiveness": 20, "delivery_notes": "Completely straight delivery. The flatness against the absurd content is the joke." }
    }
  ]
}`;
  }

  return base;
}

// ============================================================================
// HANDLER
// ============================================================================

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
    const { video_idea_id } = JSON.parse(event.body || '{}');

    if (!video_idea_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'video_idea_id is required' }) };
    }

    // Fetch the idea
    const { data: idea, error: ideaError } = await supabase
      .from('video_ideas')
      .select('*')
      .eq('id', video_idea_id)
      .single();

    if (ideaError || !idea) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Video idea not found' }) };
    }

    if (!KLING_TEMPLATES[idea.type]) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Video type "${idea.type}" not yet implemented` }) };
    }

    const systemPrompt = buildSystemPrompt(idea.type, idea);

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
          max_tokens: 4096,
          system: systemPrompt + HUMAN_VOICE_RULES,
          messages: [{ role: 'user', content: 'Generate the script and Kling prompts now. Return JSON only.' }],
        }),
      });

      if (response.ok) {
        claudeResponse = await response.json();
        break;
      }

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

    const totalDuration = (parsed.shots || []).reduce((sum: number, s: { duration_seconds: number }) => sum + (s.duration_seconds || 0), 0);

    // Save prompt record
    const { data: prompt, error: promptError } = await supabase
      .from('video_prompts')
      .insert({
        video_idea_id,
        shots: parsed.shots,
        script: parsed.script,
        shot_count: (parsed.shots || []).length,
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
