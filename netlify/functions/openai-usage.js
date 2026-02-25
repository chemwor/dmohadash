require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * OpenAI Usage & Cost Tracker
 *
 * Fetches usage data from OpenAI's Admin API to track costs.
 *
 * Required environment variables:
 * - OPENAI_ADMIN_KEY: Admin API key from https://platform.openai.com/settings/organization/admin-keys
 *   (This is different from a regular API key - you need to create an Admin key)
 *
 * Note: For feature-level breakdown (quick preview, full preview, letter generation),
 * you'll need to implement logging in your backend that writes to Supabase.
 */

const CACHE_KEY = 'openai_usage_data';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// OpenAI pricing per 1K tokens (as of 2024 - update as needed)
const PRICING = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },
  // Default fallback
  'default': { input: 0.002, output: 0.002 },
};

// Your price point for cost analysis
const PRICE_PER_PURCHASE = 29;

// Daily spend alert threshold
const DAILY_SPEND_ALERT_THRESHOLD = 50; // Alert if daily spend exceeds $50

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function getCachedData(supabase) {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('data, updated_at')
      .eq('cache_key', CACHE_KEY)
      .single();

    if (error || !data) return null;

    const cacheAge = Date.now() - new Date(data.updated_at).getTime();
    if (cacheAge > CACHE_DURATION_MS) {
      return { data: data.data, age: cacheAge, expired: true };
    }

    return { data: data.data, age: cacheAge, expired: false };
  } catch (err) {
    console.error('Error reading cache:', err);
    return null;
  }
}

async function setCachedData(supabase, data) {
  try {
    await supabase
      .from('api_cache')
      .upsert({
        cache_key: CACHE_KEY,
        data: data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });
  } catch (err) {
    console.error('Error saving cache:', err);
  }
}

// Budget limit configuration (set via environment variable since API doesn't expose this)
// Set OPENAI_MONTHLY_BUDGET in your .env file to your OpenAI monthly budget limit
const MONTHLY_BUDGET_LIMIT = parseFloat(process.env.OPENAI_MONTHLY_BUDGET) || 0;

// Note: OpenAI's billing endpoints (/v1/dashboard/billing/...) require session-based
// authentication and are not accessible via Admin API keys. Credits and budget limits
// must be configured manually or checked in the OpenAI dashboard.

// Fetch usage from OpenAI Admin API
// Requires an Admin API key from: https://platform.openai.com/settings/organization/admin-keys
async function fetchOpenAIUsage(apiKey, startDate, endDate) {
  // Use the Completions usage endpoint (Admin API)
  const url = new URL('https://api.openai.com/v1/organization/usage/completions');
  url.searchParams.append('start_time', Math.floor(new Date(startDate).getTime() / 1000));
  url.searchParams.append('end_time', Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000));
  url.searchParams.append('bucket_width', '1d'); // Daily buckets

  console.log('Fetching OpenAI usage from:', url.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API response:', response.status, errorText);

    // Check if it's an auth error (wrong type of API key)
    if (response.status === 401 || response.status === 403) {
      throw new Error('Admin API key required. Get one from: platform.openai.com/settings/organization/admin-keys');
    }

    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Calculate cost from token usage
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = PRICING[model] || PRICING['default'];
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

// Get date string in YYYY-MM-DD format
function getDateString(date) {
  return date.toISOString().split('T')[0];
}

// Fetch usage data for the last N days
async function getUsageData(apiKey, days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = getDateString(startDate);
  const endDateStr = getDateString(endDate);
  const today = getDateString(new Date());

  console.log(`Fetching usage from ${startDateStr} to ${endDateStr}`);

  const usage = await fetchOpenAIUsage(apiKey, startDateStr, endDateStr);

  console.log('OpenAI API response:', JSON.stringify(usage, null, 2).substring(0, 500));

  const dailyData = [];
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalRequests = 0;
  let todayCost = 0;

  // Process the response - Admin API returns buckets
  const buckets = usage.data || usage.buckets || [];

  buckets.forEach(bucket => {
    // Get date from bucket
    const bucketDate = bucket.start_time
      ? getDateString(new Date(bucket.start_time * 1000))
      : bucket.date || 'unknown';

    let dayCost = 0;
    let dayInputTokens = 0;
    let dayOutputTokens = 0;
    let dayRequests = 0;

    // Process results within the bucket
    const results = bucket.results || [bucket];

    results.forEach(item => {
      const inputTokens = item.input_tokens || item.prompt_tokens || item.n_context_tokens_total || 0;
      const outputTokens = item.output_tokens || item.completion_tokens || item.n_generated_tokens_total || 0;
      const model = item.model || item.snapshot_id || 'default';
      const requests = item.num_model_requests || item.n_requests || 1;

      const cost = calculateCost(model, inputTokens, outputTokens);

      dayCost += cost;
      dayInputTokens += inputTokens;
      dayOutputTokens += outputTokens;
      dayRequests += requests;
    });

    if (bucketDate === today) {
      todayCost = dayCost;
    }

    if (dayInputTokens > 0 || dayOutputTokens > 0) {
      dailyData.push({
        date: bucketDate,
        cost: Math.round(dayCost * 100) / 100,
        inputTokens: dayInputTokens,
        outputTokens: dayOutputTokens,
        requests: dayRequests,
      });
    }

    totalCost += dayCost;
    totalInputTokens += dayInputTokens;
    totalOutputTokens += dayOutputTokens;
    totalRequests += dayRequests;
  });

  // Sort by date
  dailyData.sort((a, b) => a.date.localeCompare(b.date));

  return {
    dailyData,
    totalCost: Math.round(totalCost * 100) / 100,
    totalInputTokens,
    totalOutputTokens,
    totalRequests,
    todayCost: Math.round(todayCost * 100) / 100,
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

  // Try OPENAI_ADMIN_KEY first, fall back to OPENAI_API_KEY
  const apiKey = process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY;

  // Debug: Log if key is found (not the actual key for security)
  console.log('OpenAI Admin key configured:', !!apiKey, apiKey ? `(${apiKey.substring(0, 15)}...)` : 'not set');

  if (!apiKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: 'OpenAI Admin API key not configured',
        message: 'Add OPENAI_ADMIN_KEY (from platform.openai.com/settings/organization/admin-keys)',
        isMockData: true,
        // Return mock data structure
        totalCost: 0,
        todayCost: 0,
        totalRequests: 0,
        avgCostPerRequest: 0,
        costPerPurchase: 0,
        profitMargin: 0,
        dailySpendAlert: false,
        dailyData: [],
      }),
    };
  }

  try {
    const forceRefresh = event.queryStringParameters?.refresh === 'true';
    const supabase = getSupabaseClient();

    // Check cache
    if (!forceRefresh && supabase) {
      const cached = await getCachedData(supabase);
      if (cached && !cached.expired) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...cached.data,
            fromCache: true,
            cacheAge: Math.round(cached.age / 1000 / 60) + ' minutes',
          }),
        };
      }
    }

    // Fetch usage data for last 30 days
    console.log('Fetching OpenAI usage data...');
    const usageData = await getUsageData(apiKey, 30);

    // Get purchase count from Supabase for cost analysis
    let purchaseCount = 0;
    if (supabase) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: purchases } = await supabase
        .from('dmhoa_cases')
        .select('id')
        .eq('unlocked', true)
        .gte('created_at', thirtyDaysAgo.toISOString());

      purchaseCount = purchases?.length || 0;
    }

    // Calculate metrics
    const avgCostPerRequest = usageData.totalRequests > 0
      ? Math.round((usageData.totalCost / usageData.totalRequests) * 1000) / 1000
      : 0;

    const costPerPurchase = purchaseCount > 0
      ? Math.round((usageData.totalCost / purchaseCount) * 100) / 100
      : 0;

    const profitPerPurchase = PRICE_PER_PURCHASE - costPerPurchase;
    const profitMargin = costPerPurchase > 0
      ? Math.round(((profitPerPurchase / PRICE_PER_PURCHASE) * 100) * 10) / 10
      : 100;

    const dailySpendAlert = usageData.todayCost > DAILY_SPEND_ALERT_THRESHOLD;

    // Get last 7 days for chart
    const last7Days = usageData.dailyData.slice(-7);

    const data = {
      // Summary
      totalCost: usageData.totalCost,
      todayCost: usageData.todayCost,
      totalRequests: usageData.totalRequests,
      totalInputTokens: usageData.totalInputTokens,
      totalOutputTokens: usageData.totalOutputTokens,

      // Per-request metrics
      avgCostPerRequest,

      // Business metrics
      purchaseCount,
      costPerPurchase,
      pricePerPurchase: PRICE_PER_PURCHASE,
      profitPerPurchase: Math.round(profitPerPurchase * 100) / 100,
      profitMargin,

      // Account/Billing info (configured via environment variables)
      // Note: OpenAI billing API requires dashboard session auth, not available via Admin API
      credits: null,  // Check OpenAI dashboard for credits
      budgetLimit: MONTHLY_BUDGET_LIMIT > 0 ? {
        monthlyLimit: MONTHLY_BUDGET_LIMIT,
        remaining: Math.max(0, MONTHLY_BUDGET_LIMIT - usageData.totalCost),
        percentUsed: MONTHLY_BUDGET_LIMIT > 0 ? Math.round((usageData.totalCost / MONTHLY_BUDGET_LIMIT) * 100) : 0,
      } : null,

      // Alerts
      dailySpendAlert,
      dailySpendThreshold: DAILY_SPEND_ALERT_THRESHOLD,

      // Chart data
      dailyData: last7Days,

      // Metadata
      period: '30 days',
      lastUpdated: new Date().toISOString(),
      isMockData: false,
    };

    // Cache the data
    if (supabase) {
      await setCachedData(supabase, data);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('OpenAI usage error:', error);

    // Try to return cached data on error
    const supabase = getSupabaseClient();
    if (supabase) {
      const cached = await getCachedData(supabase);
      if (cached) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...cached.data,
            fromCache: true,
            staleCache: true,
            message: 'API error. Using cached data.',
          }),
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch OpenAI usage data',
        message: error.message,
        isMockData: false,
        totalCost: 0,
        todayCost: 0,
        totalRequests: 0,
        avgCostPerRequest: 0,
        costPerPurchase: 0,
        profitMargin: 0,
        dailySpendAlert: false,
        dailyData: [],
      }),
    };
  }
};
