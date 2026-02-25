require('dotenv').config();
const KLAVIYO_BASE_URL = 'https://a.klaviyo.com/api';
const API_VERSION = '2024-02-15';

// Your specific list IDs
const FULL_PREVIEW_LIST_ID = 'T6LY99';
const QUICK_PREVIEW_LIST_ID = 'QS6zfC';

async function klaviyoFetch(endpoint, apiKey) {
  const response = await fetch(`${KLAVIYO_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'accept': 'application/json',
      'revision': API_VERSION,
    },
  });
  return response;
}

async function getListProfileCount(listId, apiKey) {
  try {
    // Use relationships endpoint to get all profile IDs in the list
    // This is more reliable for counting
    let totalCount = 0;
    let nextPageUrl = `/lists/${listId}/relationships/profiles/`;

    // Paginate through all results to get accurate count
    while (nextPageUrl) {
      const response = await klaviyoFetch(nextPageUrl, apiKey);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching list ${listId}:`, response.status, errorText);
        return 0;
      }

      const data = await response.json();
      totalCount += data.data?.length || 0;

      // Check for next page
      if (data.links?.next) {
        // Extract path from full URL
        const nextUrl = new URL(data.links.next);
        nextPageUrl = nextUrl.pathname + nextUrl.search;
      } else {
        nextPageUrl = null;
      }
    }

    console.log(`List ${listId} count: ${totalCount}`);
    return totalCount;
  } catch (error) {
    console.error(`Error fetching list ${listId}:`, error);
    return 0;
  }
}

async function getTotalProfileCount(apiKey) {
  try {
    // Get total profiles count - fetch first page to get total from meta
    const response = await klaviyoFetch('/profiles/?page[size]=1', apiKey);

    if (!response.ok) {
      console.error('Error fetching profiles:', response.status);
      return 0;
    }

    const data = await response.json();

    // Try to get total from meta, otherwise count manually
    if (data.meta?.page_info?.total) {
      return data.meta.page_info.total;
    }

    // If no total in meta, we need to paginate (not ideal but accurate)
    // For now, let's try a larger page size to estimate
    const largePageResponse = await klaviyoFetch('/profiles/?page[size]=100', apiKey);
    if (largePageResponse.ok) {
      const largePageData = await largePageResponse.json();
      // If there's no next page, this is the total
      if (!largePageData.links?.next) {
        return largePageData.data?.length || 0;
      }
      // Otherwise, we'd need to paginate - for now return what we have
      // and indicate it might be more
      return largePageData.data?.length || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error fetching total profiles:', error);
    return 0;
  }
}

async function getNewProfilesCount(apiKey, hours = 24) {
  try {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    const sinceISO = since.toISOString();

    const response = await klaviyoFetch(
      `/profiles/?filter=greater-or-equal(created,${sinceISO})&page[size]=100`,
      apiKey
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.data?.length || 0;
  } catch (error) {
    console.error('Error fetching new profiles:', error);
    return 0;
  }
}

async function getFlows(apiKey) {
  try {
    const response = await klaviyoFetch('/flows/', apiKey);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching flows:', error);
    return [];
  }
}

exports.handler = async (event) => {
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
      statusCode: 200,
      headers,
      body: JSON.stringify({
        isMockData: true,
        error: 'Klaviyo API key not configured',
        totalProfiles: 0,
        totalEmailsInFlow: 0,
        fullPreviewEmails: 0,
        quickPreviewEmails: 0,
        emailsCollectedToday: 0,
        lists: [],
        flowStats: [],
      }),
    };
  }

  try {
    console.log('Fetching Klaviyo data...');

    // Fetch all data in parallel
    const [
      fullPreviewCount,
      quickPreviewCount,
      totalProfiles,
      emailsCollectedToday,
      flows
    ] = await Promise.all([
      getListProfileCount(FULL_PREVIEW_LIST_ID, apiKey),
      getListProfileCount(QUICK_PREVIEW_LIST_ID, apiKey),
      getTotalProfileCount(apiKey),
      getNewProfilesCount(apiKey, 24),
      getFlows(apiKey),
    ]);

    const totalEmailsInFlow = fullPreviewCount + quickPreviewCount;

    const flowStats = flows.slice(0, 5).map((flow) => ({
      name: flow.attributes?.name || 'Unknown Flow',
      status: flow.attributes?.status || 'unknown',
    }));

    const responseData = {
      // Total emails in the platform (all profiles)
      totalProfiles,
      // Emails in the abandonment flow (both lists combined)
      totalEmailsInFlow,
      // Individual list counts
      fullPreviewEmails: fullPreviewCount,
      quickPreviewEmails: quickPreviewCount,
      // New emails in last 24 hours
      emailsCollectedToday,
      // List details
      lists: [
        {
          id: FULL_PREVIEW_LIST_ID,
          name: 'Full Preview Abandonment',
          count: fullPreviewCount,
        },
        {
          id: QUICK_PREVIEW_LIST_ID,
          name: 'Quick Preview Abandonment',
          count: quickPreviewCount,
        },
      ],
      flowStats,
      totalFlows: flows.length,
      isMockData: false,
    };

    console.log('Klaviyo response:', JSON.stringify(responseData));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error('Klaviyo API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Klaviyo data',
        message: error.message || 'Unknown error',
      }),
    };
  }
};
