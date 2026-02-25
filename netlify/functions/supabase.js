require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Minimum date: January 1, 2026
const MIN_DATE = '2026-01-01T00:00:00.000Z';

// Test accounts to exclude from all counts
const EXCLUDED_EMAILS = ['chemworeric@gmail.com'];

function getDateRange(period) {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let start;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all':
      start = new Date(MIN_DATE);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  // Ensure we never go before 2026
  const minDate = new Date(MIN_DATE);
  if (start < minDate) {
    start = minDate;
  }

  return {
    start: start.toISOString(),
    end: endOfDay.toISOString(),
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('Supabase not configured, returning mock data');

    const mockData = {
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
    const period = event.queryStringParameters?.period || 'today';
    const { start, end } = getDateRange(period);

    // Fetch all cases for the period
    const { data: cases, error } = await supabase
      .from('dmhoa_cases')
      .select('id, token, email, created_at, unlocked, stripe_payment_intent_id, amount_total, status, payload')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Fetch case outputs (completed/paid cases)
    const { data: caseOutputs, error: outputsError } = await supabase
      .from('dmhoa_case_outputs')
      .select('id, case_token, status, model, prompt_version, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (outputsError) {
      console.error('Error fetching case outputs:', outputsError);
    }

    // Create a map of case outputs by token
    const outputsMap = new Map();
    (caseOutputs || []).forEach(output => {
      outputsMap.set(output.case_token, output);
    });

    // Filter out test accounts
    const filteredCases = (cases || []).filter(caseItem => {
      let payload = caseItem.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          payload = {};
        }
      }
      const email = (payload?.email || caseItem.email || '').toLowerCase();
      return !EXCLUDED_EMAILS.some(excluded => email === excluded.toLowerCase());
    });

    // Process cases to categorize them
    let quickPreviews = 0;
    let fullPreviews = 0;
    let purchases = 0;
    let totalRevenue = 0;

    const recentCases = [];
    const completedCases = []; // Cases with outputs (fully paid and processed)

    filteredCases.forEach(caseItem => {
      // Parse payload if it's a string
      let payload = caseItem.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          payload = {};
        }
      }

      // Determine case type based on payload
      const isQuickPreview = payload?.completionPhase === 'simple';
      const isFullPreview = !isQuickPreview && payload?.pastedText;
      const isPurchase = caseItem.unlocked === true || caseItem.stripe_payment_intent_id;

      // Check if this case has an output (fully processed)
      const caseOutput = outputsMap.get(caseItem.token);
      const hasOutput = !!caseOutput;

      if (isPurchase) {
        purchases++;
        if (caseItem.amount_total) {
          totalRevenue += caseItem.amount_total / 100; // Convert cents to dollars
        }
      }

      if (isQuickPreview) {
        quickPreviews++;
      } else if (isFullPreview || payload?.issueText) {
        // Full preview has pastedText or at least issueText without completionPhase=simple
        fullPreviews++;
      }

      // Add to recent cases list (limit to 10)
      if (recentCases.length < 10) {
        recentCases.push({
          id: caseItem.id,
          token: caseItem.token,
          email: payload?.email || caseItem.email || null,
          created_at: caseItem.created_at,
          status: caseItem.status,
          type: isQuickPreview ? 'quick' : 'full',
          unlocked: caseItem.unlocked || false,
          noticeType: payload?.noticeType || null,
          issueText: payload?.issueText ? payload.issueText.substring(0, 100) + '...' : null,
          amount: caseItem.amount_total ? caseItem.amount_total / 100 : null,
          hasOutput,
          outputStatus: caseOutput?.status || null,
        });
      }

      // Track completed/paid cases with outputs
      if (isPurchase && completedCases.length < 20) {
        completedCases.push({
          id: caseItem.id,
          token: caseItem.token,
          email: payload?.email || caseItem.email || null,
          created_at: caseItem.created_at,
          noticeType: payload?.noticeType || null,
          amount: caseItem.amount_total ? caseItem.amount_total / 100 : null,
          hasOutput,
          outputStatus: caseOutput?.status || 'no_output',
          outputModel: caseOutput?.model || null,
          outputCreatedAt: caseOutput?.created_at || null,
        });
      }
    });

    // Count output statuses
    const outputStats = {
      total: completedCases.length,
      ready: completedCases.filter(c => c.outputStatus === 'ready').length,
      pending: completedCases.filter(c => c.outputStatus === 'pending').length,
      error: completedCases.filter(c => c.outputStatus === 'error').length,
      noOutput: completedCases.filter(c => c.outputStatus === 'no_output').length,
    };

    // Total cases as proxy for visitors (people who started the form)
    const totalCases = filteredCases.length;

    // Calculate funnel conversion rates
    const visitorToQuickPreviewRate = totalCases > 0
      ? Math.round((quickPreviews / totalCases) * 1000) / 10
      : 0;

    const quickToFullPreviewRate = quickPreviews > 0
      ? Math.round((fullPreviews / quickPreviews) * 1000) / 10
      : 0;

    const fullPreviewToPurchaseRate = fullPreviews > 0
      ? Math.round((purchases / fullPreviews) * 1000) / 10
      : 0;

    const overallConversionRate = totalCases > 0
      ? Math.round((purchases / totalCases) * 1000) / 10
      : 0;

    const data = {
      quickPreviewCompletions: quickPreviews,
      fullPreviewCompletions: fullPreviews,
      purchases,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCases,
      funnel: {
        visitors: totalCases,
        quickPreviews,
        fullPreviews,
        purchases,
        visitorToQuickPreviewRate,
        quickToFullPreviewRate,
        fullPreviewToPurchaseRate,
        overallConversionRate,
      },
      recentCases,
      completedCases,
      outputStats,
      period,
      dateRange: { start, end },
      dataFrom: '2026-01-01',
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
        message: error.message || 'Unknown error',
      }),
    };
  }
};
