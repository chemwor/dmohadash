require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * Microsoft Clarity API Integration
 *
 * To get your Clarity API credentials:
 * 1. Go to https://clarity.microsoft.com
 * 2. Select your project
 * 3. Go to Settings > Data Export
 * 4. Generate an API token (token is project-specific)
 *
 * Environment variables needed:
 * - CLARITY_API_TOKEN: Your API bearer token (includes project access)
 *
 * API Documentation:
 * https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 *
 * IMPORTANT: API limit is 10 requests per day per project!
 * This function caches data in Supabase to persist across cold starts.
 */

const CLARITY_API_URL = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
const CACHE_KEY = 'clarity_data';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours (to stay well under 10/day limit)
const MAX_DAILY_REQUESTS = 10;

// Helper to get Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Get cached data and request counter from Supabase
async function getCacheAndCounter(supabase) {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('data, updated_at, requests_today, request_date')
      .eq('cache_key', CACHE_KEY)
      .single();

    if (error || !data) {
      return { cache: null, requestsToday: 0, remainingRequests: MAX_DAILY_REQUESTS };
    }

    const today = getTodayDate();
    // Reset counter if it's a new day
    const requestsToday = data.request_date === today ? (data.requests_today || 0) : 0;
    const remainingRequests = MAX_DAILY_REQUESTS - requestsToday;

    const cacheAge = Date.now() - new Date(data.updated_at).getTime();
    const cacheValid = cacheAge <= CACHE_DURATION_MS;

    return {
      cache: cacheValid ? {
        data: data.data,
        timestamp: new Date(data.updated_at).getTime(),
        age: cacheAge,
      } : null,
      staleCache: !cacheValid ? {
        data: data.data,
        timestamp: new Date(data.updated_at).getTime(),
        age: cacheAge,
      } : null,
      requestsToday,
      remainingRequests,
    };
  } catch (err) {
    console.error('Error reading cache:', err);
    return { cache: null, requestsToday: 0, remainingRequests: MAX_DAILY_REQUESTS };
  }
}

// Save data to Supabase cache and increment request counter
async function setCachedDataAndIncrementCounter(supabase, data, currentRequestsToday) {
  try {
    const today = getTodayDate();
    const { error } = await supabase
      .from('api_cache')
      .upsert({
        cache_key: CACHE_KEY,
        data: data,
        updated_at: new Date().toISOString(),
        requests_today: currentRequestsToday + 1,
        request_date: today,
      }, { onConflict: 'cache_key' });

    if (error) {
      console.error('Error writing cache:', error);
    }
    return currentRequestsToday + 1;
  } catch (err) {
    console.error('Error saving cache:', err);
    return currentRequestsToday;
  }
}

async function clarityFetch(token, numOfDays = 3, dimensions = []) {
  const params = new URLSearchParams({ numOfDays: numOfDays.toString() });

  dimensions.forEach((dim, index) => {
    if (dim) params.append(`dimension${index + 1}`, dim);
  });

  const response = await fetch(`${CLARITY_API_URL}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Clarity API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function parseMetrics(apiResponse) {
  const metrics = {};
  const debugInfo = {};  // Collect debug info about what the API returns

  if (!Array.isArray(apiResponse)) {
    console.log('API response is not an array:', typeof apiResponse);
    metrics._debug = { error: 'Response is not an array', type: typeof apiResponse };
    return metrics;
  }

  // Collect all metric names and their field structures
  apiResponse.forEach(item => {
    const metricName = item.metricName;
    const firstEntry = item.information?.[0];
    debugInfo[metricName] = {
      entryCount: item.information?.length || 0,
      fields: firstEntry ? Object.keys(firstEntry) : [],
      sample: firstEntry
    };
  });

  metrics._debug = debugInfo;
  console.log('Clarity API Debug Info:', JSON.stringify(debugInfo, null, 2));

  apiResponse.forEach(item => {
    const metricName = item.metricName;
    const info = item.information || [];

    switch (metricName) {
      case 'Traffic':
        // Sum sessions (each session is unique), but DON'T sum unique visitors
        // (same user visiting multiple days would be double-counted)
        let totalSessions = 0;
        let totalBotSessions = 0;
        let maxUniqueUsers = 0;  // Track max instead of sum to avoid double-counting
        let totalPagesPerSession = 0;
        let ppsCount = 0;

        info.forEach(entry => {
          totalSessions += parseInt(entry.totalSessionCount || 0, 10);
          totalBotSessions += parseInt(entry.totalBotSessionCount || 0, 10);
          // For unique visitors, track the max from any single entry
          // Summing would double-count users who visited on multiple days
          const entryUsers = parseInt(entry.distantUserCount || 0, 10);
          if (entryUsers > maxUniqueUsers) {
            maxUniqueUsers = entryUsers;
          }
          if (entry.PagesPerSessionPercentage) {
            totalPagesPerSession += parseFloat(entry.PagesPerSessionPercentage);
            ppsCount++;
          }
        });

        metrics.totalSessions = totalSessions;
        metrics.totalBotSessions = totalBotSessions;
        metrics.uniqueVisitors = maxUniqueUsers;
        metrics.pagesPerSession = ppsCount > 0 ? (totalPagesPerSession / ppsCount).toFixed(2) : 0;
        break;

      case 'Scroll Depth':
        let totalScrollDepth = 0;
        let scrollCount = 0;
        info.forEach(entry => {
          if (entry.avgScrollDepth) {
            totalScrollDepth += parseFloat(entry.avgScrollDepth);
            scrollCount++;
          }
        });
        metrics.avgScrollDepth = scrollCount > 0 ? Math.round(totalScrollDepth / scrollCount) : 0;
        break;

      case 'Engagement Time':
        let totalEngagement = 0;
        let engagementCount = 0;
        info.forEach(entry => {
          if (entry.avgEngagementTime) {
            totalEngagement += parseFloat(entry.avgEngagementTime);
            engagementCount++;
          }
        });
        metrics.avgTimeOnPage = engagementCount > 0 ? Math.round(totalEngagement / engagementCount) : 0;
        break;

      case 'Dead Click Count':
        let deadClicks = 0;
        info.forEach(entry => {
          deadClicks += parseInt(entry.count || entry.deadClickCount || 0, 10);
        });
        metrics.deadClicks = deadClicks;
        break;

      case 'Rage Click Count':
        let rageClicks = 0;
        info.forEach(entry => {
          rageClicks += parseInt(entry.count || entry.rageClickCount || 0, 10);
        });
        metrics.rageClicks = rageClicks;
        break;

      case 'Quickback Click':
        let quickBacks = 0;
        info.forEach(entry => {
          quickBacks += parseInt(entry.count || entry.quickbackCount || 0, 10);
        });
        metrics.quickBacks = quickBacks;
        break;

      case 'Excessive Scroll':
        let excessiveScrolling = 0;
        info.forEach(entry => {
          excessiveScrolling += parseInt(entry.count || entry.excessiveScrollCount || 0, 10);
        });
        metrics.excessiveScrolling = excessiveScrolling;
        break;

      case 'Script Error Count':
        let jsErrors = 0;
        info.forEach(entry => {
          jsErrors += parseInt(entry.count || entry.scriptErrorCount || 0, 10);
        });
        metrics.jsErrors = jsErrors;
        break;

      case 'Popular Pages':
        metrics.popularPages = info.slice(0, 10).map(entry => ({
          page: entry.url || entry.pageTitle || 'Unknown',
          views: parseInt(entry.pageViews || entry.count || 0, 10)
        }));
        break;
    }
  });

  return metrics;
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

  const apiToken = process.env.CLARITY_API_TOKEN;

  if (!apiToken) {
    // Return mock data if Clarity is not configured
    console.log('Clarity not configured, returning mock data');

    const mockData = {
      // User Behavior
      totalSessions: 1247,
      totalPageViews: 3892,
      pagesPerSession: 3.1,
      avgScrollDepth: 68,
      avgTimeOnPage: 142, // seconds
      bounceRate: 34.2,

      // Visits
      totalVisits: 1089,
      uniqueVisitors: 876,
      returningVisitors: 213,

      // Frustration Signals
      rageClicks: 23,
      deadClicks: 89,
      quickBacks: 45,
      excessiveScrolling: 31,

      // Technical Issues
      jsErrors: 12,
      slowPageLoads: 34,

      // Trends (last 7 days)
      dailyVisits: [
        { date: '2026-02-13', visits: 142, sessions: 168 },
        { date: '2026-02-14', visits: 156, sessions: 184 },
        { date: '2026-02-15', visits: 134, sessions: 158 },
        { date: '2026-02-16', visits: 98, sessions: 112 },
        { date: '2026-02-17', visits: 87, sessions: 102 },
        { date: '2026-02-18', visits: 178, sessions: 210 },
        { date: '2026-02-19', visits: 194, sessions: 228 },
      ],

      // Top pages with issues
      pagesWithIssues: [
        { page: '/preview', rageClicks: 12, deadClicks: 34 },
        { page: '/checkout', rageClicks: 8, deadClicks: 21 },
        { page: '/pricing', rageClicks: 3, deadClicks: 18 },
      ],

      isMockData: true,
      message: 'Clarity not configured. Using mock data. Add CLARITY_API_TOKEN to .env',
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockData),
    };
  }

  try {
    const now = Date.now();
    const forceRefresh = event.queryStringParameters?.refresh === 'true';
    const supabase = getSupabaseClient();

    // Get cache and request counter from Supabase
    let cacheInfo = { cache: null, staleCache: null, requestsToday: 0, remainingRequests: MAX_DAILY_REQUESTS };
    if (supabase) {
      cacheInfo = await getCacheAndCounter(supabase);
    }

    const { cache, staleCache, requestsToday, remainingRequests } = cacheInfo;

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cache) {
      console.log('Returning cached Clarity data from Supabase');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...cache.data,
          fromCache: true,
          cacheAge: Math.round(cache.age / 1000 / 60) + ' minutes',
          remainingRequests,
          requestsUsedToday: requestsToday,
        }),
      };
    }

    // Block refresh if no requests remaining
    if (remainingRequests <= 0) {
      console.log('No API requests remaining today, returning stale cache');
      const cacheToUse = cache || staleCache;
      if (cacheToUse) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...cacheToUse.data,
            fromCache: true,
            cacheAge: Math.round(cacheToUse.age / 1000 / 60) + ' minutes',
            remainingRequests: 0,
            requestsUsedToday: requestsToday,
            message: 'Daily API limit exhausted (10/day). Using cached data. Resets at midnight.',
          }),
        };
      }
      // No cache available
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          totalSessions: 0,
          totalPageViews: 0,
          error: 'No API requests remaining',
          message: 'Daily API limit exhausted (10/day). No cached data available. Resets at midnight.',
          remainingRequests: 0,
          requestsUsedToday: requestsToday,
          isMockData: false,
        }),
      };
    }

    // Fetch data for last 3 days (max allowed by API)
    // API limits: max 10 requests/day, max 3 days of data, max 1000 rows
    console.log(`Fetching fresh Clarity data from API (${remainingRequests} requests remaining)`);
    const apiResponse = await clarityFetch(apiToken, 3);

    // Parse the metrics from the API response
    const metrics = parseMetrics(apiResponse);

    // Structure the response data
    const data = {
      // User Behavior
      totalSessions: metrics.totalSessions || 0,
      totalPageViews: Math.round((metrics.totalSessions || 0) * (parseFloat(metrics.pagesPerSession) || 1)),
      pagesPerSession: parseFloat(metrics.pagesPerSession) || 0,
      avgScrollDepth: metrics.avgScrollDepth || 0,
      avgTimeOnPage: metrics.avgTimeOnPage || 0,
      bounceRate: 0, // Not directly available in API

      // Visits
      totalVisits: metrics.totalSessions || 0,
      uniqueVisitors: metrics.uniqueVisitors || 0,
      returningVisitors: 0, // Not directly available in API

      // Frustration Signals
      rageClicks: metrics.rageClicks || 0,
      deadClicks: metrics.deadClicks || 0,
      quickBacks: metrics.quickBacks || 0,
      excessiveScrolling: metrics.excessiveScrolling || 0,

      // Technical Issues
      jsErrors: metrics.jsErrors || 0,
      slowPageLoads: 0, // Not directly available in API

      // Popular pages
      popularPages: metrics.popularPages || [],

      isMockData: false,
      dataRange: 'Last 3 days',
      lastFetched: new Date().toISOString(),

      // Debug: shows all metric names and their field structures from the API
      // Remove this after fixing field names
      _debug: metrics._debug,
    };

    // Cache the data in Supabase and increment counter
    let newRequestsUsed = requestsToday;
    if (supabase) {
      newRequestsUsed = await setCachedDataAndIncrementCounter(supabase, data, requestsToday);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...data,
        remainingRequests: MAX_DAILY_REQUESTS - newRequestsUsed,
        requestsUsedToday: newRequestsUsed,
      }),
    };
  } catch (error) {
    console.error('Clarity API error:', error);

    // If rate limited (429), try to return cached data from Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      const cacheInfo = await getCacheAndCounter(supabase);
      const cacheToUse = cacheInfo.cache || cacheInfo.staleCache;

      if (cacheToUse) {
        console.log('API error, returning cached data from Supabase');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...cacheToUse.data,
            fromCache: true,
            rateLimited: error.message.includes('429'),
            cacheAge: Math.round(cacheToUse.age / 1000 / 60) + ' minutes',
            remainingRequests: cacheInfo.remainingRequests,
            requestsUsedToday: cacheInfo.requestsToday,
            message: error.message.includes('429')
              ? 'API rate limit reached (10/day). Using cached data.'
              : 'API error. Using cached data.',
          }),
        };
      }
    }

    // If API fails and no cache, return error response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalSessions: 0,
        totalPageViews: 0,
        pagesPerSession: 0,
        avgScrollDepth: 0,
        avgTimeOnPage: 0,
        bounceRate: 0,
        totalVisits: 0,
        uniqueVisitors: 0,
        returningVisitors: 0,
        rageClicks: 0,
        deadClicks: 0,
        quickBacks: 0,
        excessiveScrolling: 0,
        jsErrors: 0,
        slowPageLoads: 0,
        popularPages: [],
        error: 'Failed to fetch Clarity data',
        message: error.message.includes('429')
          ? 'API rate limit reached (10 requests/day). Try again tomorrow.'
          : (error.message || 'Unknown error'),
        remainingRequests: 0,
        isMockData: false,
      }),
    };
  }
};
