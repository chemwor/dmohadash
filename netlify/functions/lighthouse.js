require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * Google PageSpeed Insights API Integration (Lighthouse)
 *
 * SETUP REQUIRED:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project or select an existing one
 * 3. Enable the "PageSpeed Insights API" at:
 *    https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com
 * 4. Go to "Credentials" and create an API key
 * 5. Add to .env: GOOGLE_PAGESPEED_API_KEY=your_api_key
 *
 * Free tier: 25,000 queries/day with API key
 *
 * API Documentation:
 * https://developers.google.com/speed/docs/insights/v5/get-started
 */

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const TARGET_URL = 'https://disputemyhoa.com/';
const CACHE_KEY = 'lighthouse_data';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours (site speed doesn't change often)
const MAX_DAILY_REQUESTS = 100; // Conservative limit to stay well under 25k/day

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
      return { cache: null, staleCache: null, requestsToday: 0, remainingRequests: MAX_DAILY_REQUESTS };
    }

    const today = getTodayDate();
    const requestsToday = data.request_date === today ? (data.requests_today || 0) : 0;
    const remainingRequests = MAX_DAILY_REQUESTS - requestsToday;

    const cacheAge = Date.now() - new Date(data.updated_at).getTime();
    const cacheValid = cacheAge <= CACHE_DURATION_MS;

    return {
      cache: cacheValid ? { data: data.data, age: cacheAge } : null,
      staleCache: !cacheValid ? { data: data.data, age: cacheAge } : null,
      requestsToday,
      remainingRequests,
    };
  } catch (err) {
    console.error('Error reading cache:', err);
    return { cache: null, staleCache: null, requestsToday: 0, remainingRequests: MAX_DAILY_REQUESTS };
  }
}

// Save data to Supabase cache and increment counter
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

// Fetch PageSpeed Insights data
async function fetchPageSpeedData(url, strategy = 'mobile') {
  const params = new URLSearchParams({
    url: url,
    strategy: strategy,
  });

  // Request all categories
  ['performance', 'seo', 'accessibility', 'best-practices'].forEach(cat => {
    params.append('category', cat);
  });

  // Add API key (required for reliable access)
  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    params.append('key', process.env.GOOGLE_PAGESPEED_API_KEY);
  }

  const response = await fetch(`${PAGESPEED_API_URL}?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PageSpeed API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

// Parse Lighthouse results into clean metrics
function parseMetrics(apiResponse) {
  const lighthouse = apiResponse.lighthouseResult;
  if (!lighthouse) {
    throw new Error('No Lighthouse result in API response');
  }

  const categories = lighthouse.categories || {};
  const audits = lighthouse.audits || {};

  // Debug: Log available categories
  console.log('Available categories:', Object.keys(categories));
  console.log('Category scores:', {
    performance: categories.performance?.score,
    seo: categories.seo?.score,
    accessibility: categories.accessibility?.score,
    'best-practices': categories['best-practices']?.score,
  });

  // Get all category scores (0-100)
  const metrics = {
    // Category scores
    performanceScore: Math.round((categories.performance?.score || 0) * 100),
    seoScore: Math.round((categories.seo?.score || 0) * 100),
    accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
    bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),

    // Core Web Vitals
    firstContentfulPaint: {
      value: audits['first-contentful-paint']?.numericValue || 0,
      displayValue: audits['first-contentful-paint']?.displayValue || 'N/A',
      score: Math.round((audits['first-contentful-paint']?.score || 0) * 100),
    },
    largestContentfulPaint: {
      value: audits['largest-contentful-paint']?.numericValue || 0,
      displayValue: audits['largest-contentful-paint']?.displayValue || 'N/A',
      score: Math.round((audits['largest-contentful-paint']?.score || 0) * 100),
    },
    totalBlockingTime: {
      value: audits['total-blocking-time']?.numericValue || 0,
      displayValue: audits['total-blocking-time']?.displayValue || 'N/A',
      score: Math.round((audits['total-blocking-time']?.score || 0) * 100),
    },
    cumulativeLayoutShift: {
      value: audits['cumulative-layout-shift']?.numericValue || 0,
      displayValue: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      score: Math.round((audits['cumulative-layout-shift']?.score || 0) * 100),
    },
    speedIndex: {
      value: audits['speed-index']?.numericValue || 0,
      displayValue: audits['speed-index']?.displayValue || 'N/A',
      score: Math.round((audits['speed-index']?.score || 0) * 100),
    },

    // Additional useful metrics
    timeToInteractive: {
      value: audits['interactive']?.numericValue || 0,
      displayValue: audits['interactive']?.displayValue || 'N/A',
      score: Math.round((audits['interactive']?.score || 0) * 100),
    },
    serverResponseTime: {
      value: audits['server-response-time']?.numericValue || 0,
      displayValue: audits['server-response-time']?.displayValue || 'N/A',
      score: Math.round((audits['server-response-time']?.score || 0) * 100),
    },

    // Metadata
    fetchTime: lighthouse.fetchTime,
    finalUrl: lighthouse.finalUrl,
    strategy: apiResponse.lighthouseResult?.configSettings?.formFactor || 'mobile',
  };

  return metrics;
}

// Get score category (good, needs-improvement, poor)
function getScoreCategory(score) {
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

// Get empty response structure for errors
function getEmptyResponse(error, message, isMockData = false) {
  const emptyMetric = { value: 0, displayValue: 'N/A', score: 0 };
  return {
    url: TARGET_URL,
    strategy: 'mobile',
    performanceScore: 0,
    seoScore: 0,
    accessibilityScore: 0,
    bestPracticesScore: 0,
    performanceCategory: 'unknown',
    seoCategory: 'unknown',
    accessibilityCategory: 'unknown',
    bestPracticesCategory: 'unknown',
    fcp: emptyMetric,
    lcp: emptyMetric,
    tbt: emptyMetric,
    cls: emptyMetric,
    speedIndex: emptyMetric,
    tti: emptyMetric,
    serverResponseTime: emptyMetric,
    error,
    message,
    isMockData,
  };
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

  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  // Check if API key is configured
  if (!apiKey) {
    console.log('PageSpeed API key not configured');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(getEmptyResponse(
        'API key not configured',
        'Add GOOGLE_PAGESPEED_API_KEY to enable site speed monitoring. Get one free at console.cloud.google.com',
        true
      )),
    };
  }

  try {
    const forceRefresh = event.queryStringParameters?.refresh === 'true';
    const supabase = getSupabaseClient();

    // Get cache and request counter
    let cacheInfo = { cache: null, staleCache: null, requestsToday: 0, remainingRequests: MAX_DAILY_REQUESTS };
    if (supabase) {
      cacheInfo = await getCacheAndCounter(supabase);
    }

    const { cache, staleCache, requestsToday, remainingRequests } = cacheInfo;

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cache) {
      console.log('Returning cached Lighthouse data');
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

    // Block if no requests remaining
    if (remainingRequests <= 0) {
      console.log('No API requests remaining, returning stale cache');
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
            message: 'Daily request limit reached. Using cached data.',
          }),
        };
      }
    }

    // Fetch fresh data from PageSpeed Insights
    console.log(`Fetching fresh Lighthouse data (${remainingRequests} requests remaining)`);
    const apiResponse = await fetchPageSpeedData(TARGET_URL, 'mobile');

    // Parse the metrics
    const metrics = parseMetrics(apiResponse);

    // Structure the response
    const data = {
      url: TARGET_URL,
      strategy: 'mobile',

      // Category scores
      performanceScore: metrics.performanceScore,
      seoScore: metrics.seoScore,
      accessibilityScore: metrics.accessibilityScore,
      bestPracticesScore: metrics.bestPracticesScore,

      // Score categories
      performanceCategory: getScoreCategory(metrics.performanceScore),
      seoCategory: getScoreCategory(metrics.seoScore),
      accessibilityCategory: getScoreCategory(metrics.accessibilityScore),
      bestPracticesCategory: getScoreCategory(metrics.bestPracticesScore),

      // Core Web Vitals
      fcp: metrics.firstContentfulPaint,
      lcp: metrics.largestContentfulPaint,
      tbt: metrics.totalBlockingTime,
      cls: metrics.cumulativeLayoutShift,
      speedIndex: metrics.speedIndex,
      tti: metrics.timeToInteractive,
      serverResponseTime: metrics.serverResponseTime,

      lastTested: new Date().toISOString(),
      isMockData: false,
    };

    // Cache and increment counter
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
    console.error('Lighthouse API error:', error);

    // Try to return cached data on error
    const supabase = getSupabaseClient();
    if (supabase) {
      const cacheInfo = await getCacheAndCounter(supabase);
      const cacheToUse = cacheInfo.cache || cacheInfo.staleCache;

      if (cacheToUse) {
        console.log('API error, returning cached data');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...cacheToUse.data,
            fromCache: true,
            cacheAge: Math.round(cacheToUse.age / 1000 / 60) + ' minutes',
            remainingRequests: cacheInfo.remainingRequests,
            requestsUsedToday: cacheInfo.requestsToday,
            message: error.message.includes('429')
              ? 'API rate limit reached. Using cached data.'
              : 'API error. Using cached data.',
          }),
        };
      }
    }

    // Return error response
    const errorMessage = error.message.includes('429')
      ? 'API quota exceeded. Add GOOGLE_PAGESPEED_API_KEY for 25,000 free requests/day.'
      : (error.message || 'Unknown error');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...getEmptyResponse('Failed to fetch Lighthouse data', errorMessage),
        remainingRequests: 0,
      }),
    };
  }
};
