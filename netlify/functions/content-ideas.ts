import { Handler } from '@netlify/functions';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

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

  try {
    const { type, seed } = JSON.parse(event.body || '{}');

    if (!type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'type is required' }),
      };
    }

    const typeDescriptions: Record<string, string> = {
      board_meeting: 'an HOA board meeting scenario with board members and residents',
      doorbell_footage: 'a Ring/doorbell camera capturing an HOA violation encounter',
      street_confrontation: 'a neighborhood street confrontation over an HOA rule',
      official_document: 'a dramatic reading or reveal of an absurd HOA violation letter',
      news_broadcast: 'a local news broadcast covering a ridiculous HOA dispute',
      homeowner_pov: 'a first-person homeowner perspective dealing with HOA overreach',
    };

    const typeDesc = typeDescriptions[type] || type;
    const seedText = seed ? `\n\nUse this as inspiration: "${seed}"` : '';

    const systemPrompt = `You are a viral social media content strategist for DisputeMyHOA, a service that helps homeowners fight unfair HOA fines. Generate creative, entertaining, and relatable video scenario ideas that would go viral on TikTok/Instagram Reels. Each scenario should feel authentic and tap into the frustration homeowners feel with overreaching HOAs. Return JSON only, no markdown, no code fences.`;

    const userPrompt = `Generate exactly 3 different video idea variants for this type: ${typeDesc}.${seedText}

Return this exact JSON structure:
{"ideas":[{"scenario":"<2-3 sentence description of what happens in the video>","violation_type":"<the specific HOA violation, e.g. 'Trash can visible from street', 'Wrong shade of beige paint'>","fine_amount":<realistic fine amount as integer, between 25 and 5000>}]}`;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    const parsed = JSON.parse(text);

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
