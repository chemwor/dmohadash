require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Use temp directory for job storage
const JOBS_DIR = path.join(os.tmpdir(), 'ad-suggestions-jobs');

// Ensure jobs directory exists
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getJobPath(jobId) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

function saveJob(jobId, data) {
  fs.writeFileSync(getJobPath(jobId), JSON.stringify(data));
}

function loadJob(jobId) {
  const jobPath = getJobPath(jobId);
  if (fs.existsSync(jobPath)) {
    return JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  }
  return null;
}

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

function formatKeywordsTable(keywords) {
  if (!keywords || keywords.length === 0) {
    return 'No keyword data available.';
  }

  const header = '| Keyword | Match | QS | Clicks | Impr | CTR | CPC | Conv | Cost/Conv | Impr Share |';
  const separator = '|---------|-------|-----|--------|------|-----|-----|------|-----------|------------|';
  const rows = keywords.map(k => {
    const qs = k.qualityScore !== null ? k.qualityScore : 'N/A';
    const impShare = k.searchImpressionShare !== null ? `${(k.searchImpressionShare * 100).toFixed(1)}%` : 'N/A';
    const costPerConv = k.costPerConversion > 0 ? `$${k.costPerConversion.toFixed(2)}` : 'N/A';
    return `| ${k.keyword} | ${k.matchType} | ${qs} | ${k.clicks} | ${k.impressions} | ${k.ctr}% | $${k.cpc} | ${k.conversions} | ${costPerConv} | ${impShare} |`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatSearchTermsTable(searchTerms) {
  if (!searchTerms || searchTerms.length === 0) {
    return 'No search term data available.';
  }

  const header = '| Search Term | Status | Clicks | Impressions | CTR | Conversions | Spend |';
  const separator = '|-------------|--------|--------|-------------|-----|-------------|-------|';
  const rows = searchTerms.map(st =>
    `| ${st.searchTerm} | ${st.status} | ${st.clicks} | ${st.impressions} | ${st.ctr}% | ${st.conversions} | $${st.spend} |`
  );

  return [header, separator, ...rows].join('\n');
}

function formatAdCopy(ads) {
  if (!ads || ads.length === 0) {
    return 'No ad copy data available.';
  }

  return ads.map((ad, i) => {
    const headlines = ad.headlines.map((h, j) => `  ${j + 1}. ${h}`).join('\n');
    const descriptions = ad.descriptions.map((d, j) => `  ${j + 1}. ${d}`).join('\n');
    return `Ad ${i + 1} (${ad.status}):\nHeadlines:\n${headlines}\nDescriptions:\n${descriptions}\nPerformance: ${ad.clicks} clicks, ${ad.impressions} impressions, ${ad.ctr}% CTR, $${ad.spend} spend`;
  }).join('\n\n');
}

async function processJob(jobId, requestData) {
  const { campaign, metrics, keywords, searchTerms, ads, period } = requestData;

  try {
    const systemPrompt = `You are a Google Ads optimization expert. Your role is to analyze campaign data and provide actionable suggestions.

CRITICAL BUSINESS MODEL CONSTRAINTS — READ BEFORE MAKING ANY RECOMMENDATIONS:

DisputeMyHOA is a $49 self-service SaaS tool that generates HOA violation response letters using AI. It is NOT a law firm, NOT a legal referral service, and NOT a consultation service.

The target customer is a homeowner who wants to handle their own HOA dispute without hiring an attorney. They are comfortable with a self-serve digital product.

WRONG-INTENT TRAFFIC (do NOT recommend targeting these):
- Any search containing: lawyer, attorney, lawyers, attorneys, near me, legal advice, free consultation, pro bono, lawsuit, sue, court
- These users want human legal representation and will not convert at $49

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
- Any search term with zero conversions AND containing attorney/lawyer intent words should be flagged as a NEGATIVE keyword candidate, not an ADD candidate — regardless of CTR or click volume
- High CTR on wrong-intent terms means the ad is compelling to the wrong audience, not that the audience is right

CONVERSION BASELINE:
- This is an early-stage campaign with very few conversions
- Be conservative with "this keyword is working" claims
- Focus on eliminating wrong-intent traffic first`;

    const prompt = `Analyze this Google Ads campaign data and provide optimization suggestions.

## Campaign: ${campaign.name || 'Unknown'}
## Period: ${period || 'today'}

## Performance Metrics:
- Total Spend: $${metrics?.spend || 0}
- Total Clicks: ${metrics?.clicks || 0}
- Total Impressions: ${metrics?.impressions || 0}
- CTR: ${metrics?.ctr || 0}%
- Average CPC: $${metrics?.cpc || 0}
- Conversions: ${metrics?.conversions || 0}
- Cost per Conversion: $${metrics?.costPerConversion || 'N/A'}

## Current Keywords (with Quality Score, Impression Share):
${formatKeywordsTable(keywords)}

## Search Terms (actual searches triggering your ads):
${formatSearchTermsTable(searchTerms)}

## Current Ad Copy:
${formatAdCopy(ads)}

Based on this data, provide optimization suggestions in the following JSON format. Be specific and actionable:

{
  "performanceSummary": "2-3 sentence analysis focusing on: (1) what % of traffic appears to be wrong-intent attorney-seekers, (2) whether the current keywords align with self-serve DIY customers",
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
  ]
}

IMPORTANT ANALYSIS RULES:
1. First, analyze search terms for attorney/lawyer intent - these should ALL be negative keyword candidates
2. Any keyword with "lawyer", "attorney", "near me", "consultation" = recommend as NEGATIVE, never as ADD
3. High CTR on wrong-intent terms is BAD, not good - it means ads are attracting the wrong audience
4. Focus on keywords that indicate DIY/self-serve intent: "how to write", "template", "respond to", "fight fine myself"
5. Ad copy must never imply human help, phone calls, or legal representation

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
      saveJob(jobId, {
        status: 'error',
        error: 'Failed to parse AI response',
        rawResponse: responseText.substring(0, 1000),
      });
      return;
    }

    // Save successful result
    saveJob(jobId, {
      status: 'complete',
      result: {
        ...suggestions,
        generatedAt: new Date().toISOString(),
        campaignAnalyzed: campaign.name,
        period,
      },
    });
    console.log(`[${jobId}] Job complete`);

  } catch (error) {
    console.error(`[${jobId}] Error:`, error);
    saveJob(jobId, {
      status: 'error',
      error: error.message,
    });
  }
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

  // GET request - check job status
  if (event.httpMethod === 'GET') {
    const jobId = event.queryStringParameters?.jobId;

    if (!jobId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'jobId parameter required' }),
      };
    }

    const job = loadJob(jobId);
    if (!job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Job not found', jobId }),
      };
    }

    if (job.status === 'complete') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(job.result),
      };
    }

    if (job.status === 'error') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: job.error, rawResponse: job.rawResponse }),
      };
    }

    // Still processing
    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({ status: 'processing', jobId }),
    };
  }

  // POST request - start new job
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: 'AI suggestions not configured',
        message: 'Add ANTHROPIC_API_KEY to enable AI-powered suggestions',
        isMockData: true,
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { campaign } = body;

    if (!campaign) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campaign data is required' }),
      };
    }

    // Generate job ID and save initial status
    const jobId = generateJobId();
    saveJob(jobId, { status: 'processing' });

    // Start processing in background (don't await)
    processJob(jobId, body).catch(err => {
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
        error: 'Failed to start analysis',
        message: error.message,
      }),
    };
  }
};
