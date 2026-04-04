import { Handler } from '@netlify/functions';

const KLAVIYO_BASE_URL = 'https://a.klaviyo.com/api';
const API_VERSION = '2023-10-15';

interface FlowStats {
  name: string;
  sends: number;
  opens: number;
  clicks: number;
  revenue: number;
  openRate: number;
  clickRate: number;
}

async function klaviyoFetch(endpoint: string, apiKey: string): Promise<Response> {
  return fetch(`${KLAVIYO_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'accept': 'application/json',
      'revision': API_VERSION,
    },
  });
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const apiKey = process.env.KLAVIYO_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Klaviyo API key not configured' }),
    };
  }

  try {
    // Get profiles created in last 24 hours for list growth
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    const newProfilesResponse = await klaviyoFetch(
      `/profiles/?filter=greater-or-equal(created,${yesterdayISO})&page[size]=100`,
      apiKey
    );

    let listGrowthToday = 0;
    if (newProfilesResponse.ok) {
      const newProfilesData = await newProfilesResponse.json();
      listGrowthToday = newProfilesData.data?.length || 0;
    }

    // Get flows
    const flowsResponse = await klaviyoFetch('/flows/', apiKey);
    const flowsData = await flowsResponse.json();
    const flows = flowsData.data || [];

    // Build flow stats
    const flowStats: FlowStats[] = flows.slice(0, 5).map((flow: { attributes: { name: string } }) => ({
      name: flow.attributes.name,
      sends: 0,
      opens: 0,
      clicks: 0,
      revenue: 0,
      openRate: 0,
      clickRate: 0,
    }));

    // Try to get subscriber count from lists
    let subscriberCount = 0;
    try {
      const listsResponse = await klaviyoFetch('/lists/', apiKey);
      if (listsResponse.ok) {
        const listsData = await listsResponse.json();
        const lists = listsData.data || [];

        if (lists.length > 0) {
          const mainListId = lists[0].id;
          const listProfilesResponse = await klaviyoFetch(
            `/lists/${mainListId}/profiles/?page[size]=1`,
            apiKey
          );
          if (listProfilesResponse.ok) {
            const listProfilesData = await listProfilesResponse.json();
            subscriberCount = listProfilesData.meta?.total || listProfilesData.data?.length || 0;
          }
        }
      }
    } catch (e) {
      console.error('Error fetching list profiles:', e);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        subscriberCount,
        listGrowthToday,
        flowStats,
        unsubscribeRate: 0,
        totalFlows: flows.length,
      }),
    };
  } catch (error) {
    console.error('Klaviyo API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Klaviyo data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
