require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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

// Fetch cases (limit to last 1000 for performance)
async function getAllCases(supabase) {
  const { data: cases, error } = await supabase
    .from('dmhoa_cases')
    .select('id, token, email, created_at, unlocked, status, payload, amount_total, stripe_payment_intent_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching cases:', error);
    return [];
  }

  return (cases || []).map(c => ({
    ...c,
    notice_type: c.payload?.noticeType || c.payload?.notice_type || c.payload?.violationType || 'Unknown',
    state: c.payload?.state || c.payload?.hoaState || 'Unknown',
    hoa_name: c.payload?.hoaName || c.payload?.associationName || null,
  }));
}

// Fetch case outputs
async function getCaseOutputs(supabase) {
  const { data: outputs, error } = await supabase
    .from('dmhoa_case_outputs')
    .select('id, case_token, status, model, prompt_version, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching case outputs:', error);
    return [];
  }

  return outputs || [];
}

// Fetch documents (just get counts by type, not full content)
async function getDocuments(supabase) {
  const { data: documents, error } = await supabase
    .from('dmhoa_documents')
    .select('id, case_token, type, document_type, file_type, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }

  return documents || [];
}

// Fetch messages (just metadata, not full content)
async function getMessages(supabase) {
  const { data: messages, error } = await supabase
    .from('dmhoa_messages')
    .select('id, case_token, session_id, role, sender, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return messages || [];
}

// Fetch legislation news
async function getLegislationNews(supabase) {
  const { data: articles, error } = await supabase
    .from('hoa_news_articles')
    .select('title, description, category, priority, pub_date, source')
    .in('category', ['legislation', 'enforcement', 'legal'])
    .eq('dismissed', false)
    .order('pub_date', { ascending: false, nullsFirst: false })
    .limit(30);

  if (error) {
    console.error('Error fetching legislation news:', error);
    return [];
  }

  return articles || [];
}

// Get latest scorecard
async function getLatestScorecard(supabase) {
  const { data, error } = await supabase
    .from('legality_scorecard')
    .select('*')
    .eq('status', 'completed')
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest scorecard:', error);
    return null;
  }

  return data;
}

// Analyze seasonal trends
function analyzeSeasonalTrends(cases) {
  const byMonth = {};
  const byDayOfWeek = {};
  const byHour = {};

  cases.forEach(c => {
    const date = new Date(c.created_at);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
    const hour = date.getHours();

    byMonth[month] = (byMonth[month] || 0) + 1;
    byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + 1;
    byHour[hour] = (byHour[hour] || 0) + 1;
  });

  // Find peaks
  const peakMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];
  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];

  return {
    byMonth,
    byDayOfWeek,
    byHour,
    peakMonth: peakMonth ? peakMonth[0] : null,
    peakDay: peakDay ? peakDay[0] : null,
    peakHour: peakHour ? `${peakHour[0]}:00` : null,
  };
}

// Analyze conversion funnel
function analyzeConversionFunnel(cases, outputs) {
  const outputTokens = new Set(outputs.map(o => o.case_token));

  const totalCases = cases.length;
  const unlockedCases = cases.filter(c => c.unlocked).length;
  const completedCases = cases.filter(c => outputTokens.has(c.token)).length;
  const paidCases = cases.filter(c => c.stripe_payment_intent_id).length;

  // Conversion by notice type
  const conversionByType = {};
  cases.forEach(c => {
    const type = c.notice_type;
    if (!conversionByType[type]) {
      conversionByType[type] = { total: 0, unlocked: 0, completed: 0, revenue: 0 };
    }
    conversionByType[type].total++;
    if (c.unlocked) {
      conversionByType[type].unlocked++;
      conversionByType[type].revenue += (c.amount_total || 0) / 100;
    }
    if (outputTokens.has(c.token)) {
      conversionByType[type].completed++;
    }
  });

  // Calculate conversion rates
  Object.keys(conversionByType).forEach(type => {
    const t = conversionByType[type];
    t.conversionRate = t.total > 0 ? (t.unlocked / t.total * 100).toFixed(1) : 0;
  });

  return {
    totalCases,
    unlockedCases,
    completedCases,
    paidCases,
    overallConversionRate: totalCases > 0 ? (unlockedCases / totalCases * 100).toFixed(1) : 0,
    completionRate: unlockedCases > 0 ? (completedCases / unlockedCases * 100).toFixed(1) : 0,
    conversionByType,
  };
}

// Analyze geographic distribution
function analyzeGeography(cases) {
  const byState = {};

  cases.forEach(c => {
    const state = c.state || 'Unknown';
    if (!byState[state]) {
      byState[state] = { total: 0, unlocked: 0, revenue: 0 };
    }
    byState[state].total++;
    if (c.unlocked) {
      byState[state].unlocked++;
      byState[state].revenue += (c.amount_total || 0) / 100;
    }
  });

  // Sort by total cases
  const topStates = Object.entries(byState)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([state, data]) => ({ state, ...data }));

  return {
    byState,
    topStates,
    totalStates: Object.keys(byState).filter(s => s !== 'Unknown').length,
  };
}

// Analyze violation types
function analyzeViolationTypes(cases, outputs) {
  const outputTokens = new Set(outputs.map(o => o.case_token));
  const byType = {};

  cases.forEach(c => {
    const type = c.notice_type || 'Unknown';
    if (!byType[type]) {
      byType[type] = {
        count: 0,
        unlocked: 0,
        completed: 0,
        revenue: 0,
        states: {},
        recentTrend: { last30: 0, prev30: 0 },
      };
    }
    byType[type].count++;

    if (c.unlocked) {
      byType[type].unlocked++;
      byType[type].revenue += (c.amount_total || 0) / 100;
    }

    if (outputTokens.has(c.token)) {
      byType[type].completed++;
    }

    const state = c.state || 'Unknown';
    byType[type].states[state] = (byType[type].states[state] || 0) + 1;

    // Track recent vs older
    const daysAgo = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 30) {
      byType[type].recentTrend.last30++;
    } else if (daysAgo <= 60) {
      byType[type].recentTrend.prev30++;
    }
  });

  // Calculate trends
  Object.keys(byType).forEach(type => {
    const t = byType[type];
    t.conversionRate = t.count > 0 ? (t.unlocked / t.count * 100).toFixed(1) : 0;
    t.avgRevenue = t.unlocked > 0 ? (t.revenue / t.unlocked).toFixed(2) : 0;

    if (t.recentTrend.prev30 > 0) {
      t.trendChange = ((t.recentTrend.last30 - t.recentTrend.prev30) / t.recentTrend.prev30 * 100).toFixed(1);
    } else {
      t.trendChange = t.recentTrend.last30 > 0 ? '100' : '0';
    }
  });

  return byType;
}

// Analyze documents
function analyzeDocuments(documents) {
  const byType = {};
  const byCase = {};

  documents.forEach(doc => {
    const type = doc.type || doc.document_type || doc.file_type || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;

    const caseId = doc.case_id || doc.case_token;
    if (caseId) {
      byCase[caseId] = (byCase[caseId] || 0) + 1;
    }
  });

  const avgDocsPerCase = Object.keys(byCase).length > 0
    ? (documents.length / Object.keys(byCase).length).toFixed(1)
    : 0;

  return {
    total: documents.length,
    byType,
    casesWithDocs: Object.keys(byCase).length,
    avgDocsPerCase,
  };
}

// Analyze messages
function analyzeMessages(messages) {
  const byRole = {};
  const byCase = {};

  messages.forEach(msg => {
    const role = msg.role || msg.sender || 'unknown';
    byRole[role] = (byRole[role] || 0) + 1;

    const caseId = msg.case_id || msg.case_token || msg.session_id;
    if (caseId) {
      byCase[caseId] = (byCase[caseId] || 0) + 1;
    }
  });

  const avgMsgsPerCase = Object.keys(byCase).length > 0
    ? (messages.length / Object.keys(byCase).length).toFixed(1)
    : 0;

  return {
    total: messages.length,
    byRole,
    sessionsWithMessages: Object.keys(byCase).length,
    avgMsgsPerCase,
  };
}

// Generate comprehensive analysis
async function generateAnalysis(cases, outputs, documents, messages, legislationNews) {
  const violationTypes = analyzeViolationTypes(cases, outputs);
  const seasonalTrends = analyzeSeasonalTrends(cases);
  const conversionFunnel = analyzeConversionFunnel(cases, outputs);
  const geography = analyzeGeography(cases);
  const documentStats = analyzeDocuments(documents);
  const messageStats = analyzeMessages(messages);

  const totalRevenue = cases.reduce((sum, c) => sum + (c.unlocked ? (c.amount_total || 0) / 100 : 0), 0);

  const systemPrompt = `You are an HOA legal tech analyst. Respond with valid JSON only, no markdown.`;

  // Summarize violation types for shorter prompt
  const topViolations = Object.entries(violationTypes)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([type, data]) => ({ type, ...data }));

  const prompt = `Analyze this HOA dispute platform data and provide insights.

VIOLATIONS (top 8): ${JSON.stringify(topViolations)}

CONVERSION: Total=${conversionFunnel.totalCases}, Unlocked=${conversionFunnel.unlockedCases}, Rate=${conversionFunnel.overallConversionRate}%

SEASONAL: Peak month=${seasonalTrends.peakMonth}, day=${seasonalTrends.peakDay}, hour=${seasonalTrends.peakHour}

TOP STATES: ${geography.topStates.slice(0, 5).map(s => `${s.state}(${s.total})`).join(', ')}

DOCS: ${documentStats.total} total, ${documentStats.avgDocsPerCase} avg/case
MSGS: ${messageStats.total} total, ${messageStats.avgMsgsPerCase} avg/case

NEWS: ${legislationNews.slice(0, 5).map(a => a.title).join('; ')}

Respond with this JSON:
{"trends_summary":{"most_common_violations":[{"type":"","count":0,"percentage":0,"insight":""}],"highest_converting_cases":[{"type":"","conversion_rate":0,"avg_revenue":0,"insight":""}],"seasonal_patterns":{"peak_month":"","peak_day":"","peak_time":"","insight":""},"geographic_insights":{"top_states":[],"underserved_markets":[],"expansion_opportunities":""}},"conversion_analysis":{"overall_rate":0,"best_performing_segment":"","worst_performing_segment":"","improvement_opportunities":[]},"feature_suggestions":[{"feature":"","rationale":"","priority":"high","expected_impact":""}],"product_research_insights":{"customer_pain_points":[],"unmet_needs":[],"content_opportunities":[],"partnership_opportunities":[]},"risk_assessment":{"categories":[{"name":"","case_count":0,"conversion_rate":0,"revenue":0,"risk_level":"medium","trend_direction":"stable","top_states":[],"strategic_notes":"","common_defenses":[]}],"highest_risk_category":"","fastest_growing_category":"","most_profitable_category":""},"strategic_recommendations":[{"recommendation":"","category":"marketing","priority":"high","expected_outcome":""}],"executive_summary":""}

Fill in real values based on the data. Be concise.`;

  try {
    const analysisText = await callClaudeAPI(prompt, systemPrompt);
    const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleanedText);

    return {
      success: true,
      analysis,
      rawData: {
        violationTypes,
        seasonalTrends,
        conversionFunnel,
        geography,
        documentStats,
        messageStats,
      },
    };
  } catch (error) {
    console.error('Error generating analysis:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Save scorecard
async function saveScorecard(supabase, analysis, rawData, casesCount, docsCount, msgsCount, newsCount) {
  const { data, error } = await supabase
    .from('legality_scorecard')
    .insert({
      period_start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // All time
      period_end: new Date().toISOString(),
      categories: analysis.risk_assessment?.categories || [],
      summary: {
        ...analysis.trends_summary,
        ...analysis.conversion_analysis,
        executive_summary: analysis.executive_summary,
        feature_suggestions: analysis.feature_suggestions,
        strategic_recommendations: analysis.strategic_recommendations,
      },
      full_analysis: JSON.stringify({ analysis, rawData }),
      cases_analyzed: casesCount,
      news_articles_referenced: newsCount,
      status: 'completed',
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving scorecard:', error);
    throw error;
  }

  return data;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (event.httpMethod === 'GET') {
      const forceRefresh = event.queryStringParameters?.refresh === 'true';
      const includeHistory = event.queryStringParameters?.history === 'true';

      if (!forceRefresh) {
        const latest = await getLatestScorecard(supabase);
        if (latest) {
          const ageHours = (Date.now() - new Date(latest.analysis_date).getTime()) / (1000 * 60 * 60);
          if (ageHours < 24) {
            // Parse stored analysis
            let analysis = null;
            let rawData = null;
            try {
              const fullAnalysis = typeof latest.full_analysis === 'string'
                ? JSON.parse(latest.full_analysis)
                : latest.full_analysis;
              analysis = fullAnalysis?.analysis || null;
              rawData = fullAnalysis?.rawData || null;
            } catch (e) {
              console.error('Error parsing full_analysis:', e);
            }

            let response = {
              scorecard: latest,
              analysis,
              rawData,
              fromCache: true,
              ageHours: Math.round(ageHours)
            };

            if (includeHistory) {
              const { data: history } = await supabase
                .from('legality_scorecard')
                .select('id, analysis_date, summary, cases_analyzed')
                .eq('status', 'completed')
                .order('analysis_date', { ascending: false })
                .limit(10);
              response.history = history || [];
            }

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(response),
            };
          }
        }
      }

      // Fetch all data in parallel
      const [cases, outputs, documents, messages, legislationNews] = await Promise.all([
        getAllCases(supabase),
        getCaseOutputs(supabase),
        getDocuments(supabase),
        getMessages(supabase),
        getLegislationNews(supabase),
      ]);

      if (cases.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            scorecard: null,
            message: 'No case data available for analysis',
            casesFound: 0,
          }),
        };
      }

      const result = await generateAnalysis(cases, outputs, documents, messages, legislationNews);

      if (!result.success) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to generate analysis', details: result.error }),
        };
      }

      const scorecard = await saveScorecard(
        supabase,
        result.analysis,
        result.rawData,
        cases.length,
        documents.length,
        messages.length,
        legislationNews.length
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          scorecard,
          analysis: result.analysis,
          rawData: result.rawData,
          fromCache: false,
          generated: true,
        }),
      };
    }

    if (event.httpMethod === 'POST') {
      // Force regenerate
      const [cases, outputs, documents, messages, legislationNews] = await Promise.all([
        getAllCases(supabase),
        getCaseOutputs(supabase),
        getDocuments(supabase),
        getMessages(supabase),
        getLegislationNews(supabase),
      ]);

      if (cases.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            scorecard: null,
            message: 'No case data available for analysis',
            casesFound: 0,
          }),
        };
      }

      const result = await generateAnalysis(cases, outputs, documents, messages, legislationNews);

      if (!result.success) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to generate analysis', details: result.error }),
        };
      }

      const scorecard = await saveScorecard(
        supabase,
        result.analysis,
        result.rawData,
        cases.length,
        documents.length,
        messages.length,
        legislationNews.length
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          scorecard,
          analysis: result.analysis,
          rawData: result.rawData,
          fromCache: false,
          generated: true,
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Legality scorecard error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};
