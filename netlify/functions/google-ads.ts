import { Handler } from '@netlify/functions';

interface Campaign {
  name: string;
  spend: number;
  clicks: number;
  impressions: number;
  cpc: number;
  conversions: number;
}

function generateMockData() {
  const baseMetrics = {
    dailyBudget: 150,
    baseSpend: 85,
    baseClicks: 120,
    baseImpressions: 4500,
    baseConversions: 8,
  };

  const variance = () => 0.8 + Math.random() * 0.4;

  const dailySpend = Math.round(baseMetrics.baseSpend * variance() * 100) / 100;
  const clicks = Math.round(baseMetrics.baseClicks * variance());
  const impressions = Math.round(baseMetrics.baseImpressions * variance());
  const conversions = Math.round(baseMetrics.baseConversions * variance());
  const cpc = Math.round((dailySpend / clicks) * 100) / 100;

  const campaigns: Campaign[] = [
    {
      name: 'HOA Disputes - Search',
      spend: Math.round(dailySpend * 0.45 * 100) / 100,
      clicks: Math.round(clicks * 0.40),
      impressions: Math.round(impressions * 0.35),
      cpc: 0,
      conversions: Math.round(conversions * 0.5),
    },
    {
      name: 'HOA Violations - Broad',
      spend: Math.round(dailySpend * 0.30 * 100) / 100,
      clicks: Math.round(clicks * 0.35),
      impressions: Math.round(impressions * 0.40),
      cpc: 0,
      conversions: Math.round(conversions * 0.3),
    },
    {
      name: 'Retargeting - Website Visitors',
      spend: Math.round(dailySpend * 0.15 * 100) / 100,
      clicks: Math.round(clicks * 0.15),
      impressions: Math.round(impressions * 0.15),
      cpc: 0,
      conversions: Math.round(conversions * 0.15),
    },
    {
      name: 'Brand - DisputeMyHOA',
      spend: Math.round(dailySpend * 0.10 * 100) / 100,
      clicks: Math.round(clicks * 0.10),
      impressions: Math.round(impressions * 0.10),
      cpc: 0,
      conversions: Math.round(conversions * 0.05),
    },
  ];

  campaigns.forEach(campaign => {
    campaign.cpc = campaign.clicks > 0
      ? Math.round((campaign.spend / campaign.clicks) * 100) / 100
      : 0;
  });

  return {
    dailySpend,
    clicks,
    impressions,
    cpc,
    conversions,
    campaigns,
    dailyBudget: baseMetrics.dailyBudget,
  };
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

  try {
    const data = generateMockData();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...data,
        isMockData: true,
        message: 'This is mock data. See README for instructions on wiring real API.',
      }),
    };
  } catch (error) {
    console.error('Google Ads API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Google Ads data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
