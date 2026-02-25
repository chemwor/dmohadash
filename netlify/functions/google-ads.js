require('dotenv').config();

/**
 * Google Ads API Integration (REST API)
 *
 * Required environment variables:
 * - GOOGLE_ADS_DEVELOPER_TOKEN: Your developer token from Google Ads API Center
 * - GOOGLE_ADS_CUSTOMER_ID: Your 10-digit account ID (without hyphens)
 * - GOOGLE_ADS_CLIENT_ID: OAuth2 client ID from Google Cloud Console
 * - GOOGLE_ADS_CLIENT_SECRET: OAuth2 client secret
 * - GOOGLE_ADS_REFRESH_TOKEN: OAuth2 refresh token
 *
 * To generate refresh token, run: node scripts/google-ads-auth.js
 */

const GOOGLE_ADS_API_VERSION = 'v21';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// Minimum date: January 1, 2026
const MIN_DATE = '2026-01-01';

// Target campaign for detailed analysis
const TARGET_CAMPAIGN = 'DMHOA Initial Test';

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
  // Use search endpoint (not searchStream)
  const url = `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`;

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };

  // If accessing through MCC, add the login-customer-id header
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  console.log('Google Ads API request:', { url, customerId, loginCustomerId, hasToken: !!accessToken });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Ads API response error:', { status: response.status, error });
    throw new Error(`Google Ads API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Google Ads API response:', JSON.stringify(data).substring(0, 500));

  // The search endpoint returns { results: [...] }
  return data.results || [];
}

async function queryKeywords(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId = null) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions_value,
      metrics.cost_per_conversion,
      metrics.search_impression_share,
      metrics.search_top_impression_share
    FROM keyword_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.name = '${TARGET_CAMPAIGN}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const campaign = row.campaign || {};
      const adGroup = row.adGroup || {};
      const criterion = row.adGroupCriterion || {};
      const keyword = criterion.keyword || {};
      const qualityInfo = criterion.qualityInfo || {};
      const metrics = row.metrics || {};

      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);

      return {
        campaignName: campaign.name,
        adGroupName: adGroup.name,
        keyword: keyword.text,
        matchType: keyword.matchType,
        status: criterion.status,
        qualityScore: qualityInfo.qualityScore || null,
        impressions,
        clicks,
        spend: Math.round(spend * 100) / 100,
        conversions: parseFloat(metrics.conversions || 0),
        conversionValue: parseFloat(metrics.conversionsValue || 0),
        costPerConversion: (metrics.costPerConversion || 0) / 1_000_000,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        searchImpressionShare: metrics.searchImpressionShare || null,
        topImpressionShare: metrics.searchTopImpressionShare || null,
      };
    });
  } catch (error) {
    console.error('Error fetching keywords:', error.message);
    return [];
  }
}

async function querySearchTerms(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId = null) {
  const query = `
    SELECT
      campaign.name,
      ad_group.name,
      search_term_view.search_term,
      search_term_view.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.name = '${TARGET_CAMPAIGN}'
    ORDER BY metrics.clicks DESC
    LIMIT 30
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const campaign = row.campaign || {};
      const adGroup = row.adGroup || {};
      const searchTermView = row.searchTermView || {};
      const metrics = row.metrics || {};

      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);

      return {
        campaignName: campaign.name,
        adGroupName: adGroup.name,
        searchTerm: searchTermView.searchTerm,
        status: searchTermView.status,
        impressions,
        clicks,
        spend: Math.round(spend * 100) / 100,
        conversions: parseFloat(metrics.conversions || 0),
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching search terms:', error.message);
    return [];
  }
}

async function queryAdCopy(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId = null) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_ad.ad.id,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.final_urls,
      ad_group_ad.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.name = '${TARGET_CAMPAIGN}'
      AND campaign.status != 'REMOVED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
    ORDER BY metrics.impressions DESC
    LIMIT 20
  `;

  try {
    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);
    return results.map(row => {
      const campaign = row.campaign || {};
      const adGroup = row.adGroup || {};
      const adGroupAd = row.adGroupAd || {};
      const ad = adGroupAd.ad || {};
      const rsa = ad.responsiveSearchAd || {};
      const metrics = row.metrics || {};

      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);

      // Extract headline and description texts
      const headlines = (rsa.headlines || []).map(h => h.text).filter(Boolean);
      const descriptions = (rsa.descriptions || []).map(d => d.text).filter(Boolean);

      return {
        adId: ad.id,
        campaignName: campaign.name,
        adGroupName: adGroup.name,
        headlines,
        descriptions,
        finalUrl: (ad.finalUrls || [])[0] || '',
        status: adGroupAd.status,
        impressions,
        clicks,
        spend: Math.round(spend * 100) / 100,
        conversions: parseFloat(metrics.conversions || 0),
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching ad copy:', error.message);
    return [];
  }
}

function getDateRange(period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  let startDate;
  switch (period) {
    case 'today':
      startDate = today;
      break;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString().split('T')[0];
      break;
    case 'all':
      startDate = MIN_DATE;
      break;
    default:
      startDate = today;
  }

  // Ensure we never go before 2026
  if (startDate < MIN_DATE) {
    startDate = MIN_DATE;
  }

  return { startDate, endDate: today };
}

function getMockData() {
  const variance = () => 0.8 + Math.random() * 0.4;
  const dailyBudget = 150;
  const baseSpend = 85;
  const baseClicks = 120;
  const baseImpressions = 4500;
  const baseConversions = 8;

  const dailySpend = Math.round(baseSpend * variance() * 100) / 100;
  const clicks = Math.round(baseClicks * variance());
  const impressions = Math.round(baseImpressions * variance());
  const conversions = Math.round(baseConversions * variance());
  const cpc = Math.round((dailySpend / clicks) * 100) / 100;

  const campaigns = [
    {
      name: 'HOA Disputes - Search',
      spend: Math.round(dailySpend * 0.45 * 100) / 100,
      clicks: Math.round(clicks * 0.40),
      impressions: Math.round(impressions * 0.35),
      conversions: Math.round(conversions * 0.5),
    },
    {
      name: 'HOA Violations - Broad',
      spend: Math.round(dailySpend * 0.30 * 100) / 100,
      clicks: Math.round(clicks * 0.35),
      impressions: Math.round(impressions * 0.40),
      conversions: Math.round(conversions * 0.3),
    },
    {
      name: 'Retargeting - Website Visitors',
      spend: Math.round(dailySpend * 0.15 * 100) / 100,
      clicks: Math.round(clicks * 0.15),
      impressions: Math.round(impressions * 0.15),
      conversions: Math.round(conversions * 0.15),
    },
    {
      name: 'Brand - DisputeMyHOA',
      spend: Math.round(dailySpend * 0.10 * 100) / 100,
      clicks: Math.round(clicks * 0.10),
      impressions: Math.round(impressions * 0.10),
      conversions: Math.round(conversions * 0.05),
    },
  ];

  campaigns.forEach(campaign => {
    campaign.cpc = campaign.clicks > 0
      ? Math.round((campaign.spend / campaign.clicks) * 100) / 100
      : 0;
    campaign.ctr = campaign.impressions > 0
      ? Math.round((campaign.clicks / campaign.impressions) * 10000) / 100
      : 0;
  });

  return {
    dailySpend,
    clicks,
    impressions,
    cpc,
    ctr: Math.round((clicks / impressions) * 10000) / 100,
    conversions,
    costPerConversion: conversions > 0 ? Math.round((dailySpend / conversions) * 100) / 100 : 0,
    campaigns,
    keywords: [],
    searchTerms: [],
    ads: [],
    targetCampaign: TARGET_CAMPAIGN,
    dailyBudget,
    isMockData: true,
    message: 'Google Ads not configured. Add credentials to .env and run: node scripts/google-ads-auth.js',
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

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;  // Subaccount ID (where campaigns live)
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;  // MCC ID (optional, if accessing via manager account)
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  // Check if all credentials are present
  if (!developerToken || !customerId || !clientId || !clientSecret || !refreshToken) {
    console.log('Google Ads not fully configured, returning mock data');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(getMockData()),
    };
  }

  try {
    const period = event.queryStringParameters?.period || 'today';
    const { startDate, endDate } = getDateRange(period);

    // Get access token
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Query campaign performance
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    const results = await queryGoogleAds(customerId, developerToken, accessToken, query, loginCustomerId);

    // Fetch keywords, search terms, and ad copy for target campaign in parallel
    const [keywords, searchTerms, ads] = await Promise.all([
      queryKeywords(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId),
      querySearchTerms(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId),
      queryAdCopy(customerId, developerToken, accessToken, startDate, endDate, loginCustomerId),
    ]);

    // Process campaign data
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;

    const campaigns = results.map(row => {
      const campaign = row.campaign || {};
      const metrics = row.metrics || {};

      const spend = (metrics.costMicros || 0) / 1_000_000;
      const clicks = parseInt(metrics.clicks || 0, 10);
      const impressions = parseInt(metrics.impressions || 0, 10);
      const conversions = parseFloat(metrics.conversions || 0);

      totalSpend += spend;
      totalClicks += clicks;
      totalImpressions += impressions;
      totalConversions += conversions;

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        spend: Math.round(spend * 100) / 100,
        clicks,
        impressions,
        conversions: Math.round(conversions * 100) / 100,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        dailySpend: Math.round(totalSpend * 100) / 100,
        clicks: totalClicks,
        impressions: totalImpressions,
        cpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
        ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
        conversions: Math.round(totalConversions * 100) / 100,
        costPerConversion: totalConversions > 0 ? Math.round((totalSpend / totalConversions) * 100) / 100 : 0,
        campaigns,
        keywords,
        searchTerms,
        ads,
        targetCampaign: TARGET_CAMPAIGN,
        period,
        dateRange: { startDate, endDate },
        isMockData: false,
        dataFrom: MIN_DATE,
      }),
    };
  } catch (error) {
    console.error('Google Ads API error:', error);

    // Return mock data with error info
    const mockData = getMockData();
    mockData.error = 'Failed to fetch Google Ads data';
    mockData.message = error.message || 'Unknown error';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockData),
    };
  }
};
