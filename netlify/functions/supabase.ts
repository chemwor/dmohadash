import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface FunnelMetrics {
  visitors: number;
  quickPreviews: number;
  fullPreviews: number;
  purchases: number;
  visitorToQuickPreviewRate: number;
  quickToFullPreviewRate: number;
  fullPreviewToPurchaseRate: number;
  overallConversionRate: number;
}

interface SupabaseData {
  quickPreviewCompletions: number;
  fullPreviewCompletions: number;
  purchases: number;
  totalVisitors: number;
  funnel: FunnelMetrics;
  isMockData?: boolean;
  message?: string;
}

function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Return mock data if Supabase is not configured
    console.log('Supabase not configured, returning mock data');

    const mockData: SupabaseData = {
      quickPreviewCompletions: 47,
      fullPreviewCompletions: 23,
      purchases: 8,
      totalVisitors: 312,
      funnel: {
        visitors: 312,
        quickPreviews: 47,
        fullPreviews: 23,
        purchases: 8,
        visitorToQuickPreviewRate: 15.1,
        quickToFullPreviewRate: 48.9,
        fullPreviewToPurchaseRate: 34.8,
        overallConversionRate: 2.6,
      },
      isMockData: true,
      message: 'Supabase not configured. Using mock data.',
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockData),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { start, end } = getTodayRange();

    // Query quick preview completions
    const { count: quickPreviewCount } = await supabase
      .from('previews')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'quick')
      .gte('created_at', start)
      .lte('created_at', end);

    // Query full preview completions
    const { count: fullPreviewCount } = await supabase
      .from('previews')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'full')
      .gte('created_at', start)
      .lte('created_at', end);

    // Query purchases/orders for today
    const { count: purchaseCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end);

    // Query unique visitors for today
    const { count: visitorCount } = await supabase
      .from('sessions')
      .select('visitor_id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end);

    // Calculate metrics
    const visitors = visitorCount || 0;
    const quickPreviews = quickPreviewCount || 0;
    const fullPreviews = fullPreviewCount || 0;
    const purchases = purchaseCount || 0;

    // Calculate funnel conversion rates
    const visitorToQuickPreviewRate = visitors > 0
      ? Math.round((quickPreviews / visitors) * 1000) / 10
      : 0;

    const quickToFullPreviewRate = quickPreviews > 0
      ? Math.round((fullPreviews / quickPreviews) * 1000) / 10
      : 0;

    const fullPreviewToPurchaseRate = fullPreviews > 0
      ? Math.round((purchases / fullPreviews) * 1000) / 10
      : 0;

    const overallConversionRate = visitors > 0
      ? Math.round((purchases / visitors) * 1000) / 10
      : 0;

    const data: SupabaseData = {
      quickPreviewCompletions: quickPreviews,
      fullPreviewCompletions: fullPreviews,
      purchases,
      totalVisitors: visitors,
      funnel: {
        visitors,
        quickPreviews,
        fullPreviews,
        purchases,
        visitorToQuickPreviewRate,
        quickToFullPreviewRate,
        fullPreviewToPurchaseRate,
        overallConversionRate,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Supabase error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Supabase data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
