require('dotenv').config();
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// API Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const GOOGLE_ADS_API_VERSION = 'v21';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// Test accounts to exclude
const EXCLUDED_EMAILS = ['chemworeric@gmail.com'];

// Wrong-intent words to filter out from keyword opportunities
const WRONG_INTENT_WORDS = [
  'lawyer', 'lawyers', 'attorney', 'attorneys', 'near me', 'legal advice',
  'free consultation', 'pro bono', 'lawsuit', 'sue', 'court',
  'template', 'templates', 'free', 'sample', 'example', 'diy template',
  'word doc', 'download'
];

// High-intent words for scoring search terms
const HIGH_INTENT_WORDS = [
  'respond', 'response', 'letter', 'dispute', 'fight', 'violation',
  'notice', 'write', 'help', 'fine'
];

// In-memory job store (works within same process for netlify dev)
const jobStore = new Map();

// ============================================================================
// JOB MANAGEMENT (Using Supabase for persistence across invocations)
// ============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function saveJob(jobId, data) {
  console.log(`[${jobId}] saveJob called with status: ${data.status}`);

  // Save to in-memory store first (for same-process polling)
  jobStore.set(jobId, data);

  // Also save to Supabase for cross-invocation persistence
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn(`[${jobId}] Supabase client not available - job will only persist in-memory`);
    return;
  }

  try {
    const { data: result, error } = await supabase
      .from('ad_suggestion_jobs')
      .upsert({
        job_id: jobId,
        status: data.status,
        result: data.result || null,
        error: data.error || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_id' })
      .select();

    if (error) {
      console.error(`[${jobId}] Supabase upsert error:`, error.message, error.details);
    } else {
      console.log(`[${jobId}] Job saved to Supabase successfully`);
    }
  } catch (err) {
    console.error(`[${jobId}] Failed to save job to Supabase:`, err.message);
  }
}

async function loadJob(jobId) {
  // Check in-memory store first
  if (jobStore.has(jobId)) {
    const job = jobStore.get(jobId);
    console.log(`[${jobId}] Loaded from in-memory: status=${job.status}`);
    return job;
  }

  // Fall back to Supabase
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn(`[${jobId}] Supabase client not available for loading`);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('ad_suggestion_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error) {
      console.log(`[${jobId}] Supabase load error:`, error.message, error.code);
      return null;
    }

    if (data) {
      console.log(`[${jobId}] Loaded from Supabase: status=${data.status}`);
      return {
        status: data.status,
        result: data.result,
        error: data.error
      };
    }
  } catch (err) {
    console.error(`[${jobId}] Failed to load job from Supabase:`, err.message);
  }

  console.log(`[${jobId}] Job not found in memory or Supabase`);
  return null;
}

// ============================================================================
// GOOGLE ADS API HELPERS
// ============================================================================

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId = null) {
  const url = `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`;

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };

  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Ads API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.results || [];
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchCampaignData(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId) {
  const query = `
    SELECT
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const campaign = row.campaign || {};
      const metrics = row.metrics || {};
      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);

      return {
        name: campaign.name,
        status: campaign.status,
        spend: Math.round(spend * 100) / 100,
        clicks,
        impressions,
        conversions: parseFloat(metrics.conversions || 0),
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchKeywordData(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId) {
  const query = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      ad_group_criterion.quality_info.quality_score,
      metrics.search_impression_share
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const criterion = row.adGroupCriterion || {};
      const keyword = criterion.keyword || {};
      const qualityInfo = criterion.qualityInfo || {};
      const metrics = row.metrics || {};
      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);

      return {
        keyword: keyword.text,
        matchType: keyword.matchType,
        status: criterion.status,
        qualityScore: qualityInfo.qualityScore || null,
        spend: Math.round(spend * 100) / 100,
        clicks,
        impressions,
        conversions: parseFloat(metrics.conversions || 0),
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        searchImpressionShare: metrics.searchImpressionShare || null,
      };
    });
  } catch (error) {
    console.error('Error fetching keywords:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchSearchTermData(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId) {
  const query = `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.ctr
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const searchTermView = row.searchTermView || {};
      const metrics = row.metrics || {};
      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);

      return {
        searchTerm: searchTermView.searchTerm,
        status: searchTermView.status,
        spend: Math.round(spend * 100) / 100,
        clicks,
        impressions,
        conversions: parseFloat(metrics.conversions || 0),
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching search terms:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchDeviceData(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId) {
  const query = `
    SELECT
      segments.device,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND metrics.cost_micros > 0
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);

    const deviceMap = {};
    results.forEach(row => {
      const device = row.segments?.device || 'UNKNOWN';
      const metrics = row.metrics || {};

      if (!deviceMap[device]) {
        deviceMap[device] = { device, spend: 0, clicks: 0, impressions: 0, conversions: 0 };
      }

      deviceMap[device].spend += (metrics.costMicros || 0) / 1_000_000;
      deviceMap[device].clicks += parseInt(metrics.clicks || 0, 10);
      deviceMap[device].impressions += parseInt(metrics.impressions || 0, 10);
      deviceMap[device].conversions += parseFloat(metrics.conversions || 0);
    });

    return Object.values(deviceMap).map(d => ({
      ...d,
      spend: Math.round(d.spend * 100) / 100,
      conversions: Math.round(d.conversions * 100) / 100,
    }));
  } catch (error) {
    console.error('Error fetching device data:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchHourOfDayData(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId) {
  const query = `
    SELECT
      segments.hour,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
      AND metrics.cost_micros > 0
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);

    const hourMap = {};
    for (let i = 0; i < 24; i++) {
      hourMap[i] = { hour: i, impressions: 0, clicks: 0, spend: 0 };
    }

    results.forEach(row => {
      const hour = row.segments?.hour ?? 0;
      const metrics = row.metrics || {};

      hourMap[hour].impressions += parseInt(metrics.impressions || 0, 10);
      hourMap[hour].clicks += parseInt(metrics.clicks || 0, 10);
      hourMap[hour].spend += (metrics.costMicros || 0) / 1_000_000;
    });

    return Object.values(hourMap).map(h => ({
      ...h,
      spend: Math.round(h.spend * 100) / 100,
    }));
  } catch (error) {
    console.error('Error fetching hour data:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchGeographicData(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId) {
  const query = `
    SELECT
      geographic_view.country_criterion_id,
      geographic_view.location_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM geographic_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 20
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const geoView = row.geographicView || {};
      const metrics = row.metrics || {};
      const spend = (metrics.costMicros || 0) / 1_000_000;

      return {
        countryCriterionId: geoView.countryCriterionId,
        locationType: geoView.locationType,
        spend: Math.round(spend * 100) / 100,
        clicks: parseInt(metrics.clicks || 0, 10),
        impressions: parseInt(metrics.impressions || 0, 10),
        conversions: parseFloat(metrics.conversions || 0),
      };
    });
  } catch (error) {
    console.error('Error fetching geographic data:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchCampaignNegativeKeywords(customerId, developerToken, accessToken, loginCustomerId) {
  const query = `
    SELECT
      campaign.name,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.negative
    FROM campaign_criterion
    WHERE campaign_criterion.negative = TRUE
      AND campaign_criterion.type = 'KEYWORD'
      AND campaign.status != 'REMOVED'
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const campaign = row.campaign || {};
      const criterion = row.campaignCriterion || {};
      const keyword = criterion.keyword || {};

      return {
        keyword: keyword.text || '',
        matchType: keyword.matchType || 'UNKNOWN',
        campaignName: campaign.name || '',
        scope: 'campaign',
      };
    });
  } catch (error) {
    console.error('Error fetching campaign negative keywords:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchSharedSetNegativeKeywords(customerId, developerToken, accessToken, loginCustomerId) {
  const query = `
    SELECT
      shared_set.name,
      shared_criterion.keyword.text,
      shared_criterion.keyword.match_type,
      shared_criterion.type
    FROM shared_criterion
    WHERE shared_criterion.type = 'KEYWORD'
      AND shared_set.type = 'NEGATIVE_KEYWORDS'
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const sharedSet = row.sharedSet || {};
      const criterion = row.sharedCriterion || {};
      const keyword = criterion.keyword || {};

      return {
        keyword: keyword.text || '',
        matchType: keyword.matchType || 'UNKNOWN',
        sharedSetName: sharedSet.name || '',
        scope: 'account',
      };
    });
  } catch (error) {
    console.error('Error fetching shared set negative keywords:', error.message);
    return { error: error.message, data: null };
  }
}

/**
 * Combine campaign and shared set negative keywords into a single normalized set.
 * Returns both the flat set (for lookups) and the detailed list (for reporting).
 */
function combineNegativeKeywords(campaignNegatives, sharedSetNegatives) {
  const existingNegatives = [];
  const negativeKeywordsSet = new Set();

  // Process campaign-level negatives
  if (campaignNegatives && Array.isArray(campaignNegatives) && !campaignNegatives.error) {
    campaignNegatives.forEach(neg => {
      if (neg.keyword) {
        const normalizedKeyword = neg.keyword.toLowerCase().trim();
        negativeKeywordsSet.add(normalizedKeyword);
        existingNegatives.push({
          keyword: neg.keyword,
          matchType: neg.matchType,
          scope: 'campaign',
          campaignName: neg.campaignName,
        });
      }
    });
  }

  // Process account-level (shared set) negatives
  if (sharedSetNegatives && Array.isArray(sharedSetNegatives) && !sharedSetNegatives.error) {
    sharedSetNegatives.forEach(neg => {
      if (neg.keyword) {
        const normalizedKeyword = neg.keyword.toLowerCase().trim();
        negativeKeywordsSet.add(normalizedKeyword);
        existingNegatives.push({
          keyword: neg.keyword,
          matchType: neg.matchType,
          scope: 'account',
          sharedSetName: neg.sharedSetName,
        });
      }
    });
  }

  console.log(`[NegativeKeywords] Combined ${existingNegatives.length} existing negatives (${negativeKeywordsSet.size} unique)`);

  return { existingNegatives, negativeKeywordsSet };
}

/**
 * Analyze search terms to find confirmed gaps.
 * These are search terms with clicks that aren't yet formal keywords.
 * Uses intent scoring based on HIGH_INTENT_WORDS.
 * Cross-references waste terms against existing negative keywords.
 */
function analyzeSearchTermsForGaps(searchTermData, keywordData, negativeKeywordsSet = new Set()) {
  const analysis = {
    totalSearchTerms: 0,
    confirmedGaps: 0,
    confirmedWaste: 0,
    totalWastedOnWrongIntent: 0,
    alreadyNegated: 0,
  };

  if (!searchTermData || searchTermData.error || !Array.isArray(searchTermData)) {
    console.log('[SearchTermAnalysis] No search term data available');
    return { opportunities: [], wasteTerms: [], alreadyCovered: [], analysis };
  }

  analysis.totalSearchTerms = searchTermData.length;
  console.log(`[SearchTermAnalysis] Analyzing ${analysis.totalSearchTerms} search terms`);

  // Build a set of existing keywords for comparison (lowercase for matching)
  const existingKeywords = new Set();
  if (keywordData && Array.isArray(keywordData)) {
    keywordData.forEach(kw => {
      if (kw.keyword) {
        existingKeywords.add(kw.keyword.toLowerCase().trim());
      }
    });
  }
  console.log(`[SearchTermAnalysis] Found ${existingKeywords.size} existing keywords in account`);

  // Helper to check if term contains wrong-intent words
  const hasWrongIntent = (term) => {
    const lowerTerm = term.toLowerCase();
    return WRONG_INTENT_WORDS.some(word => lowerTerm.includes(word.toLowerCase()));
  };

  // Helper to score intent based on HIGH_INTENT_WORDS
  const scoreIntent = (term) => {
    const lowerTerm = term.toLowerCase();
    const matchCount = HIGH_INTENT_WORDS.filter(word => lowerTerm.includes(word.toLowerCase())).length;
    return matchCount >= 2 ? 'high' : 'medium';
  };

  // Helper to check if a term is already covered by a negative keyword
  const isAlreadyNegated = (term) => {
    const lowerTerm = term.toLowerCase().trim();
    // Direct match
    if (negativeKeywordsSet.has(lowerTerm)) return true;
    // Check if any negative keyword is contained in the search term
    for (const negative of negativeKeywordsSet) {
      if (lowerTerm.includes(negative)) return true;
    }
    return false;
  };

  // Find opportunity terms:
  // - No wrong-intent words
  // - clicks >= 1
  // - Not already an exact/phrase match keyword
  const opportunities = searchTermData
    .filter(st => {
      const term = st.searchTerm || '';
      const clicks = st.clicks || 0;
      const isExistingKeyword = existingKeywords.has(term.toLowerCase().trim());

      return clicks >= 1 && !hasWrongIntent(term) && !isExistingKeyword;
    })
    .map(st => ({
      searchTerm: st.searchTerm,
      clicks: st.clicks,
      impressions: st.impressions,
      spend: st.spend,
      conversions: st.conversions,
      ctr: st.ctr,
      actualCpc: st.clicks > 0 ? Math.round((st.spend / st.clicks) * 100) / 100 : 0,
      intentScore: scoreIntent(st.searchTerm),
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);

  analysis.confirmedGaps = opportunities.length;
  console.log(`[SearchTermAnalysis] Found ${opportunities.length} opportunity terms`);

  // Find waste terms:
  // - Contains wrong-intent words
  // - clicks >= 1
  // - conversions == 0
  // - spend > $2 (lowered from $3)
  const allWasteTerms = searchTermData
    .filter(st => {
      const term = st.searchTerm || '';
      const clicks = st.clicks || 0;
      const conversions = st.conversions || 0;
      const spend = st.spend || 0;

      return clicks >= 1 && conversions === 0 && spend > 2 && hasWrongIntent(term);
    })
    .map(st => ({
      searchTerm: st.searchTerm,
      clicks: st.clicks,
      spend: st.spend,
      conversions: st.conversions,
      actualCpc: st.clicks > 0 ? Math.round((st.spend / st.clicks) * 100) / 100 : 0,
      alreadyNegative: isAlreadyNegated(st.searchTerm),
    }))
    .sort((a, b) => b.spend - a.spend);

  // Split into new waste terms and already covered
  const wasteTerms = allWasteTerms
    .filter(wt => !wt.alreadyNegative)
    .slice(0, 15);

  const alreadyCovered = allWasteTerms
    .filter(wt => wt.alreadyNegative)
    .map(wt => ({
      keyword: wt.searchTerm,
      wastedSpend: wt.spend,
      note: 'already negated',
    }));

  analysis.confirmedWaste = wasteTerms.length;
  analysis.alreadyNegated = alreadyCovered.length;
  analysis.totalWastedOnWrongIntent = Math.round(wasteTerms.reduce((sum, wt) => sum + wt.spend, 0) * 100) / 100;
  console.log(`[SearchTermAnalysis] Found ${wasteTerms.length} new waste terms ($${analysis.totalWastedOnWrongIntent} wasted), ${alreadyCovered.length} already negated`);

  return { opportunities, wasteTerms, alreadyCovered, analysis };
}

async function fetchStripeData(startDate, endDate) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { error: 'Stripe not configured', data: null };
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    const gte = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
    const lte = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);

    const charges = await stripe.charges.list({
      created: { gte, lte },
      limit: 100,
    });

    const successfulCharges = charges.data.filter(c => c.status === 'succeeded' && !c.refunded);
    const revenue = successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100;
    const transactions = successfulCharges.length;
    const avgOrderValue = transactions > 0 ? revenue / transactions : 0;

    const refunds = await stripe.refunds.list({
      created: { gte, lte },
      limit: 100,
    });

    const refundCount = refunds.data.length;
    const refundAmount = refunds.data.reduce((sum, r) => sum + r.amount, 0) / 100;

    return {
      revenue: Math.round(revenue * 100) / 100,
      transactions,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      refunds: {
        count: refundCount,
        amount: Math.round(refundAmount * 100) / 100,
      },
    };
  } catch (error) {
    console.error('Error fetching Stripe data:', error.message);
    return { error: error.message, data: null };
  }
}

async function fetchSupabaseData(startDate, endDate) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase not configured', data: null };
  }

  try {
    const start = startDate + 'T00:00:00.000Z';
    const end = endDate + 'T23:59:59.999Z';

    const { data: cases, error } = await supabase
      .from('dmhoa_cases')
      .select('id, token, email, created_at, unlocked, stripe_payment_intent_id, amount_total, status, payload')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const filteredCases = (cases || []).filter(caseItem => {
      let payload = caseItem.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
      }
      const email = (payload?.email || caseItem.email || '').toLowerCase();
      return !EXCLUDED_EMAILS.some(excluded => email === excluded.toLowerCase());
    });

    const stateCount = {};
    const violationCount = {};
    let totalCases = 0;
    let paidCases = 0;

    filteredCases.forEach(caseItem => {
      let payload = caseItem.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
      }

      totalCases++;

      if (caseItem.unlocked || caseItem.stripe_payment_intent_id) {
        paidCases++;
      }

      const state = payload?.state || 'Unknown';
      stateCount[state] = (stateCount[state] || 0) + 1;

      const violationType = payload?.noticeType || payload?.violationType || 'Unknown';
      violationCount[violationType] = (violationCount[violationType] || 0) + 1;
    });

    return {
      totalCases,
      paidCases,
      casesByState: Object.entries(stateCount).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count),
      casesByViolation: Object.entries(violationCount).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error('Error fetching Supabase data:', error.message);
    return { error: error.message, data: null };
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatKeywordsTable(keywords) {
  if (!keywords || keywords.length === 0 || keywords.error) {
    return 'No keyword data available.';
  }

  const header = '| Keyword | Match | QS | Clicks | Impr | CTR | CPC | Conv | Spend |';
  const separator = '|---------|-------|-----|--------|------|-----|-----|------|-------|';
  const rows = keywords.slice(0, 20).map(k => {
    const qs = k.qualityScore !== null ? k.qualityScore : 'N/A';
    return `| ${k.keyword} | ${k.matchType} | ${qs} | ${k.clicks} | ${k.impressions} | ${k.ctr}% | $${k.cpc} | ${k.conversions} | $${k.spend} |`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatSearchTermsTable(searchTerms) {
  if (!searchTerms || searchTerms.length === 0 || searchTerms.error) {
    return 'No search term data available.';
  }

  const header = '| Search Term | Status | Clicks | Impr | CTR | Conv | Spend |';
  const separator = '|-------------|--------|--------|------|-----|------|-------|';
  const rows = searchTerms.slice(0, 30).map(st =>
    `| ${st.searchTerm} | ${st.status || 'NONE'} | ${st.clicks} | ${st.impressions} | ${st.ctr}% | ${st.conversions} | $${st.spend} |`
  );

  return [header, separator, ...rows].join('\n');
}

function formatDeviceTable(devices) {
  if (!devices || devices.length === 0 || devices.error) {
    return 'No device data available.';
  }

  const totalSpend = devices.reduce((sum, d) => sum + d.spend, 0);
  const header = '| Device | Spend | % of Total | Clicks | Impr | Conv |';
  const separator = '|--------|-------|------------|--------|------|------|';
  const rows = devices.map(d => {
    const pct = totalSpend > 0 ? Math.round((d.spend / totalSpend) * 100) : 0;
    return `| ${d.device} | $${d.spend} | ${pct}% | ${d.clicks} | ${d.impressions} | ${d.conversions} |`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatHourTable(hours) {
  if (!hours || hours.length === 0 || hours.error) {
    return 'No hour-of-day data available.';
  }

  const totalSpend = hours.reduce((sum, h) => sum + h.spend, 0);

  const blocks = [
    { label: '12AM-6AM (overnight)', hours: hours.filter(h => h.hour >= 0 && h.hour < 6) },
    { label: '6AM-12PM (morning)', hours: hours.filter(h => h.hour >= 6 && h.hour < 12) },
    { label: '12PM-6PM (afternoon)', hours: hours.filter(h => h.hour >= 12 && h.hour < 18) },
    { label: '6PM-12AM (evening)', hours: hours.filter(h => h.hour >= 18 && h.hour < 24) },
  ];

  return blocks.map(block => {
    const spend = block.hours.reduce((sum, h) => sum + h.spend, 0);
    const clicks = block.hours.reduce((sum, h) => sum + h.clicks, 0);
    const impr = block.hours.reduce((sum, h) => sum + h.impressions, 0);
    const pct = totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0;
    return `${block.label}: $${spend.toFixed(2)} (${pct}%), ${clicks} clicks, ${impr} impressions`;
  }).join('\n');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSearchTermOpportunities(opportunities) {
  if (!opportunities || opportunities.length === 0) {
    return 'No keyword opportunities found in your search terms.';
  }

  const header = '| Search Term | Clicks | Impressions | CPC Paid | Spend | Conv |';
  const separator = '|-------------|--------|-------------|----------|-------|------|';
  const rows = opportunities.map(opp =>
    `| ${opp.searchTerm} | ${opp.clicks} | ${opp.impressions} | $${opp.actualCpc} | $${opp.spend} | ${opp.conversions} |`
  );

  return [header, separator, ...rows].join('\n');
}

function formatSearchTermWaste(wasteTerms) {
  if (!wasteTerms || wasteTerms.length === 0) {
    return 'No confirmed waste terms found.';
  }

  const header = '| Search Term | Clicks | CPC Paid | Spend | Conv |';
  const separator = '|-------------|--------|----------|-------|------|';
  const rows = wasteTerms.map(wt =>
    `| ${wt.searchTerm} | ${wt.clicks} | $${wt.actualCpc} | $${wt.spend} | ${wt.conversions} |`
  );

  return [header, separator, ...rows].join('\n');
}

function formatExistingNegatives(existingNegatives) {
  if (!existingNegatives || existingNegatives.length === 0) {
    return 'No existing negative keywords found in account.';
  }

  const header = '| Keyword | Match Type | Scope |';
  const separator = '|---------|------------|-------|';
  const rows = existingNegatives.slice(0, 30).map(neg => {
    const scopeInfo = neg.scope === 'campaign' ? `Campaign: ${neg.campaignName || 'Unknown'}` : `Account: ${neg.sharedSetName || 'Shared'}`;
    return `| ${neg.keyword} | ${neg.matchType} | ${scopeInfo} |`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatAlreadyCovered(alreadyCovered) {
  if (!alreadyCovered || alreadyCovered.length === 0) {
    return 'None — no waste terms are already negated.';
  }

  const header = '| Search Term | Wasted Spend | Status |';
  const separator = '|-------------|--------------|--------|';
  const rows = alreadyCovered.map(ac =>
    `| ${ac.keyword} | $${ac.wastedSpend.toFixed(2)} | ${ac.note} |`
  );

  return [header, separator, ...rows].join('\n');
}

// ============================================================================
// CLAUDE API
// ============================================================================

async function callClaudeAPI(prompt, systemPrompt) {
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
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ============================================================================
// BACKGROUND PROCESSING
// ============================================================================

async function processAnalysis(jobId, startDate, endDate, customerId) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysAnalyzed = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Google Ads credentials
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const googleCustomerId = customerId || process.env.GOOGLE_ADS_CUSTOMER_ID;
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    const hasGoogleAdsCredentials = developerToken && googleCustomerId && clientId && clientSecret && refreshToken;

    console.log(`[${jobId}] Fetching data for ${startDate} to ${endDate}...`);

    let accessToken = null;
    if (hasGoogleAdsCredentials) {
      try {
        accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
      } catch (error) {
        console.error(`[${jobId}] Failed to get Google Ads access token:`, error.message);
      }
    }

    // Parallel fetch all data sources
    const [
      campaignData,
      keywordData,
      searchTermData,
      deviceData,
      hourData,
      geoData,
      campaignNegatives,
      sharedSetNegatives,
      stripeData,
      supabaseData,
    ] = await Promise.all([
      accessToken ? fetchCampaignData(googleCustomerId, developerToken, accessToken, startDate, endDate, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchKeywordData(googleCustomerId, developerToken, accessToken, startDate, endDate, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchSearchTermData(googleCustomerId, developerToken, accessToken, startDate, endDate, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchDeviceData(googleCustomerId, developerToken, accessToken, startDate, endDate, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchHourOfDayData(googleCustomerId, developerToken, accessToken, startDate, endDate, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchGeographicData(googleCustomerId, developerToken, accessToken, startDate, endDate, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchCampaignNegativeKeywords(googleCustomerId, developerToken, accessToken, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      accessToken ? fetchSharedSetNegativeKeywords(googleCustomerId, developerToken, accessToken, loginCustomerId) : Promise.resolve({ error: 'Google Ads not configured' }),
      fetchStripeData(startDate, endDate),
      fetchSupabaseData(startDate, endDate),
    ]);

    console.log(`[${jobId}] Data fetched, combining negative keywords...`);

    // Combine negative keywords from campaign and shared set levels
    const { existingNegatives, negativeKeywordsSet } = combineNegativeKeywords(campaignNegatives, sharedSetNegatives);

    console.log(`[${jobId}] Analyzing search terms for gaps...`);

    // Analyze search terms to find confirmed gaps and waste (cross-referencing negatives)
    const searchTermsGaps = analyzeSearchTermsForGaps(searchTermData, keywordData, negativeKeywordsSet);

    console.log(`[${jobId}] Search term analysis complete: ${searchTermsGaps.analysis.confirmedGaps} gaps, ${searchTermsGaps.analysis.confirmedWaste} waste ($${searchTermsGaps.analysis.totalWastedOnWrongIntent} wasted), ${searchTermsGaps.analysis.alreadyNegated} already negated`);
    console.log(`[${jobId}] Building prompt...`);

    // Calculate totals
    const campaigns = Array.isArray(campaignData) ? campaignData : [];
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

    const stripeRevenue = stripeData?.revenue || 0;
    const stripePaidCount = stripeData?.transactions || 0;
    const supabaseTotalCases = supabaseData?.totalCases || 0;

    // Cross-source metrics
    const costPerCaseStart = supabaseTotalCases > 0 ? totalSpend / supabaseTotalCases : 0;
    const costPerPaidConversion = stripePaidCount > 0 ? totalSpend / stripePaidCount : 0;
    const revenueToSpendRatio = totalSpend > 0 ? stripeRevenue / totalSpend : 0;

    // Build the prompt
    const systemPrompt = `You are a Google Ads optimization expert. Your role is to analyze campaign data and provide actionable suggestions.

CRITICAL BUSINESS MODEL CONSTRAINTS — READ BEFORE MAKING ANY RECOMMENDATIONS:

DisputeMyHOA is a $49 self-service SaaS tool that generates HOA violation response letters using AI. It is NOT a law firm, NOT a legal referral service, and NOT a consultation service.

The target customer is a homeowner who wants to handle their own HOA dispute without hiring an attorney. They are comfortable with a self-serve digital product.

WRONG-INTENT TRAFFIC (do NOT recommend targeting these):
- Any search containing: lawyer, attorney, lawyers, attorneys, near me, legal advice, free consultation, pro bono, lawsuit, sue, court
- Also wrong-intent: template, templates, free, sample, example, diy template, word doc, download
- These users want human legal representation OR free resources and will not convert at $49

RIGHT-INTENT TRAFFIC (DO recommend targeting these):
- Searches about responding to HOA notices themselves
- Searches about HOA violation letters, dispute letters, response letters
- Searches about HOA fines, how to fight an HOA fine
- Searches showing the user wants to take action themselves

AD COPY CONSTRAINTS:
- Never suggest copy that implies legal representation, attorneys, or lawyers
- Never suggest copy that implies phone consultations or human advisors
- The product disclaimer "Not legal advice" must remain
- Copy should emphasize: fast, affordable, self-serve, AI-generated letters, $49 price point

NEGATIVE KEYWORD LOGIC:
- Any search term with zero conversions AND containing wrong-intent words (attorney, lawyer, near me, template, free, sample, download, etc.) should be flagged as a NEGATIVE keyword candidate, not an ADD candidate — regardless of CTR or click volume
- High CTR on wrong-intent terms means the ad is compelling to the wrong audience, not that the audience is right

CONVERSION BASELINE:
- This is an early-stage campaign with very few conversions
- Be conservative with "this keyword is working" claims
- Focus on eliminating wrong-intent traffic first

HARD RULE — ZERO HALLUCINATION POLICY:
Every keyword, search term, campaign name, and metric you reference in your response MUST appear verbatim in the data provided above.

Before writing any recommendation, ask yourself: "Can I point to the exact row in the data that supports this?" If no, do not write it.

Specifically forbidden:
- Referencing keyword categories not present in the data (e.g. "pet collar", "dog", "unrelated product" keywords)
- Claiming a search term generated clicks unless that exact term appears in the search terms table with clicks > 0
- Referencing campaigns by name unless that exact name appears in the campaign data

If the General Recommendations section has fewer than 5 genuine data-backed issues, return 3 or 4 items. An accurate short list is better than a padded list with invented items.

When recommending to pause campaigns with $0 spend, check the campaign status field first. If status is already 'PAUSED', do not recommend pausing — recommend removing or archiving instead. Only flag as an action item if status is 'ENABLED' but spend is $0, which indicates a structural problem worth investigating.

RECOMMENDATION PRIORITY OVERRIDE:
- If Google Ads conversion count and Stripe transaction count do not match for the same period, always surface this as the FIRST high-priority recommendation in generalRecommendations, regardless of other findings
- Misaligned conversion tracking corrupts all optimization decisions and must be addressed before any other changes`;

    const prompt = `Analyze this Google Ads campaign data and provide optimization suggestions.

## Analysis Period: ${formatDate(startDate)} to ${formatDate(endDate)} (${daysAnalyzed} days)

## Overall Performance Metrics:
- Total Spend: $${totalSpend.toFixed(2)}
- Total Clicks: ${totalClicks}
- Total Impressions: ${totalImpressions}
- CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%
- Average CPC: $${totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0}
- Conversions (Google Ads): ${totalConversions}
- Cost per Conversion: ${totalConversions > 0 ? '$' + (totalSpend / totalConversions).toFixed(2) : 'N/A'}

## Campaign Breakdown:
${campaigns.length > 0 ? campaigns.map(c => `- ${c.name}: $${c.spend} spend, ${c.clicks} clicks, ${c.conversions} conv, ${c.ctr}% CTR`).join('\n') : 'No campaign data available.'}

## Keywords Performance:
${formatKeywordsTable(keywordData)}

## Search Terms (actual searches triggering ads):
${formatSearchTermsTable(searchTermData)}

## Device Breakdown:
${formatDeviceTable(deviceData)}

## Hour of Day Performance:
${formatHourTable(hourData)}

## Stripe Revenue Data (${daysAnalyzed}-day period):
- Total Revenue: $${stripeRevenue.toFixed(2)}
- Transactions: ${stripePaidCount}
- Avg Order Value: $${stripeData?.avgOrderValue?.toFixed(2) || 0}
- Refunds: ${stripeData?.refunds?.count || 0} ($${stripeData?.refunds?.amount?.toFixed(2) || 0})

## Supabase Case Data (${daysAnalyzed}-day period):
- Total Cases Started: ${supabaseTotalCases}
- Paid Cases: ${supabaseData?.paidCases || 0}
- Top States: ${supabaseData?.casesByState?.slice(0, 5).map(s => `${s.state} (${s.count})`).join(', ') || 'N/A'}
- Top Violation Types: ${supabaseData?.casesByViolation?.slice(0, 3).map(v => `${v.type} (${v.count})`).join(', ') || 'N/A'}

## Cross-Source Metrics:
- Cost per Case Start: $${costPerCaseStart.toFixed(2)} (ad spend / total cases started)
- Cost per Paid Conversion: $${costPerPaidConversion.toFixed(2)} (ad spend / Stripe transactions)
- Revenue vs Spend Ratio: ${revenueToSpendRatio.toFixed(2)}x (Stripe revenue / ad spend)
- Net Position: $${(stripeRevenue - totalSpend).toFixed(2)}

## SEARCH TERMS GAP ANALYSIS:

### CONFIRMED GAPS (search terms with clicks NOT yet keywords):
These are actual searches that triggered your ads and got clicks but are NOT yet formal keywords.
They have PROVEN real traffic in YOUR account — highest priority.
(${searchTermsGaps.analysis.confirmedGaps} gaps found from ${searchTermsGaps.analysis.totalSearchTerms} search terms)

${formatSearchTermOpportunities(searchTermsGaps.opportunities)}

## NEGATIVE KEYWORD AUDIT:

### EXISTING NEGATIVE KEYWORDS IN ACCOUNT:
These are already excluded — do NOT recommend adding them again.
(${existingNegatives.length} existing negatives)

${formatExistingNegatives(existingNegatives)}

### NEW NEGATIVE KEYWORD CANDIDATES (not yet in account):
These are search terms with wrong-intent words that cost real money ($2+) with zero conversions.
Add these as negative keywords immediately.
(${searchTermsGaps.analysis.confirmedWaste} new candidates, $${searchTermsGaps.analysis.totalWastedOnWrongIntent} total wasted)

${formatSearchTermWaste(searchTermsGaps.wasteTerms)}

### ALREADY COVERED (for awareness only):
These waste terms are already excluded by existing negative keywords.
(${searchTermsGaps.analysis.alreadyNegated} terms already negated)

${formatAlreadyCovered(searchTermsGaps.alreadyCovered)}

## KEYWORD OPPORTUNITY INSTRUCTIONS:

For keyword opportunities, work from ONLY the data above:

1. CONFIRMED GAPS: Promote search terms with clicks to formal keywords
   - Use EXACT match for specific long-tail terms
   - Use PHRASE match for broader terms with high intent
   - Priority based on clicks and intent score

2. HYPOTHESIS KEYWORDS: If you notice patterns in the search terms that suggest missing keyword coverage, you may suggest these BUT:
   - Label source as "claude_hypothesis"
   - Be conservative — only suggest if the pattern is clear
   - Focus on DIY/self-serve intent variations

Based on this data, provide optimization suggestions in the following JSON format. Be specific and actionable:

{
  "periodInsights": {
    "dateRange": "${formatDate(startDate)} - ${formatDate(endDate)}",
    "daysAnalyzed": ${daysAnalyzed},
    "totalSpend": ${Math.round(totalSpend * 100) / 100},
    "totalRevenue": ${Math.round(stripeRevenue * 100) / 100},
    "netPosition": ${Math.round((stripeRevenue - totalSpend) * 100) / 100},
    "costPerCaseStart": ${Math.round(costPerCaseStart * 100) / 100},
    "costPerPaidConversion": ${Math.round(costPerPaidConversion * 100) / 100},
    "revenueToSpendRatio": ${Math.round(revenueToSpendRatio * 100) / 100},
    "dataQualityNote": "string — note if period is too short for reliable conclusions on any metric, or if any data source had errors"
  },
  "performanceSummary": "2-3 sentence analysis focusing on: (1) what % of traffic appears to be wrong-intent attorney-seekers, (2) whether the current keywords align with self-serve DIY customers, (3) revenue vs spend efficiency",
  "negativeKeywordSuggestions": [
    {
      "keyword": "keyword to add as negative",
      "rationale": "why this attracts wrong-intent traffic (attorney-seekers)",
      "priority": "high|medium|low"
    }
  ],
  "keywordSuggestions": [
    {
      "action": "add|pause|modify",
      "keyword": "the specific keyword - must align with DIY self-serve intent",
      "matchType": "EXACT|PHRASE|BROAD",
      "rationale": "why this attracts self-serve customers willing to pay $49",
      "priority": "high|medium|low"
    }
  ],
  "adCopySuggestions": [
    {
      "type": "headline|description",
      "current": "current text if modifying, or null if adding new",
      "suggested": "new text - must emphasize self-serve, AI, $49, fast, NOT legal advice",
      "rationale": "why this better qualifies DIY customers and repels attorney-seekers",
      "priority": "high|medium|low"
    }
  ],
  "generalRecommendations": [
    {
      "recommendation": "specific actionable recommendation",
      "category": "budget|targeting|bidding|creative|landing_page",
      "priority": "high|medium|low",
      "expectedImpact": "expected result"
    }
  ],
  "keywordOpportunities": [
    {
      "keyword": "exact keyword text to add",
      "matchType": "EXACT|PHRASE",
      "source": "confirmed_gap|claude_hypothesis",
      "evidence": "e.g. '5 clicks, $12.50 spent' for confirmed_gap, or 'pattern observed in X terms' for hypothesis",
      "intentScore": "high|medium - high if 2+ HIGH_INTENT_WORDS present",
      "actualCpcPaid": "number or null - from search term data if confirmed_gap",
      "priority": "high|medium|low",
      "rationale": "why this fits DIY customer intent"
    }
  ],
  "negativeKeywordAudit": {
    "existingNegatives": [
      { "keyword": "string", "matchType": "EXACT|PHRASE|BROAD", "scope": "campaign|account" }
    ],
    "alreadyCovered": [
      { "keyword": "string", "wastedSpend": "number", "note": "already negated" }
    ],
    "gaps": [
      { "keyword": "string", "rationale": "string", "priority": "high|medium|low" }
    ],
    "coverageScore": "X of Y wrong-intent terms are negated"
  }
}

IMPORTANT ANALYSIS RULES:
1. First, analyze search terms for attorney/lawyer intent - these should ALL be negative keyword candidates
2. Any keyword with "lawyer", "attorney", "near me", "consultation" = recommend as NEGATIVE, never as ADD
3. High CTR on wrong-intent terms is BAD, not good - it means ads are attracting the wrong audience
4. Focus on keywords that indicate DIY/self-serve intent: "how to write", "template", "respond to", "fight fine myself"
5. Ad copy must never imply human help, phone calls, or legal representation

DEVICE ANALYSIS: If mobile spend exceeds 60% of total spend, recommend a mobile bid reduction of 20-30%. Desktop users convert better for a $49 self-serve web product.

HOUR OF DAY: Identify the 3 lowest-impression hours. If overnight hours (12AM-6AM) represent more than 15% of spend, recommend ad scheduling to suppress those hours.

TIME PERIOD CONTEXT: Frame all observations relative to the ${daysAnalyzed}-day analysis window. Note whether the period is too short to draw conclusions on some metrics.

Provide 3-5 suggestions in each category. Prioritize negative keywords to stop wasting budget on wrong-intent clicks.`;

    console.log(`[${jobId}] Calling Claude API...`);
    const responseText = await callClaudeAPI(prompt, systemPrompt);
    console.log(`[${jobId}] Claude API responded`);

    // Parse the JSON response
    let suggestions;
    try {
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      suggestions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error(`[${jobId}] Failed to parse Claude response:`, parseError);
      await saveJob(jobId, {
        status: 'error',
        error: 'Failed to parse AI response',
      });
      return;
    }

    // Build negative keyword audit summary
    const totalWrongIntentTerms = searchTermsGaps.analysis.confirmedWaste + searchTermsGaps.analysis.alreadyNegated;
    const negativeKeywordAudit = {
      existingNegatives: existingNegatives.slice(0, 50).map(neg => ({
        keyword: neg.keyword,
        matchType: neg.matchType,
        scope: neg.scope,
      })),
      alreadyCovered: searchTermsGaps.alreadyCovered,
      gaps: suggestions.negativeKeywordSuggestions || [],
      coverageScore: `${searchTermsGaps.analysis.alreadyNegated} of ${totalWrongIntentTerms} wrong-intent terms are negated`,
    };

    // Save successful result
    await saveJob(jobId, {
      status: 'complete',
      result: {
        ...suggestions,
        generatedAt: new Date().toISOString(),
        dateRange: { startDate, endDate, daysAnalyzed },
        searchTermsAnalysis: searchTermsGaps.analysis,
        negativeKeywordAudit,
      },
    });
    console.log(`[${jobId}] Job complete and saved`);

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    await saveJob(jobId, {
      status: 'error',
      error: error.message,
    });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Log configuration status on each request
  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAnthropic = !!ANTHROPIC_API_KEY;
  console.log(`[ad-suggestions] Config: Supabase=${hasSupabase}, Anthropic=${hasAnthropic}, Method=${event.httpMethod}`);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // GET request - check job status
  if (event.httpMethod === 'GET') {
    const jobId = event.queryStringParameters?.jobId;

    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 'error', error: 'jobId parameter required' }),
      };
    }

    const job = await loadJob(jobId);
    console.log(`[${jobId}] GET request, job status:`, job?.status || 'not found');

    if (!job) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'processing', jobId, message: 'Job still initializing...' }),
      };
    }

    if (job.status === 'complete') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'complete', result: job.result }),
      };
    }

    if (job.status === 'error') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'error', error: job.error }),
      };
    }

    // Still processing
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'processing', jobId }),
    };
  }

  // POST request - start new job
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ status: 'error', error: 'Method not allowed' }),
    };
  }

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: 'AI suggestions not configured. Add ANTHROPIC_API_KEY.',
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { startDate, endDate, customerId } = body;

    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 'error', error: 'startDate and endDate are required' }),
      };
    }

    // Generate job ID and save initial status
    const jobId = generateJobId();
    await saveJob(jobId, { status: 'processing' });

    // Start processing in background (don't await)
    processAnalysis(jobId, startDate, endDate, customerId).catch(err => {
      console.error(`[${jobId}] Background processing error:`, err);
      saveJob(jobId, { status: 'error', error: err.message });
    });

    // Return immediately with job ID
    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        status: 'processing',
        jobId,
        message: 'Analysis started. Poll GET /api/ad-suggestions?jobId=' + jobId,
      }),
    };

  } catch (error) {
    console.error('Ad suggestions error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message || 'Failed to start analysis',
      }),
    };
  }
};
