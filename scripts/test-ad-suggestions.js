#!/usr/bin/env node
/**
 * Test script for ad-suggestions API
 * Run with: node scripts/test-ad-suggestions.js
 *
 * This bypasses netlify dev's 30-second timeout limit
 */

require('dotenv').config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaudeAPI(prompt, systemPrompt) {
  console.log('Calling Claude API...');
  const startTime = Date.now();

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
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Claude responded in ${elapsed}s`);

  return data.content[0].text;
}

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in .env');
    process.exit(1);
  }

  // Sample test data
  const testData = {
    campaign: { name: 'DMHOA Initial Test', spend: 150, clicks: 45, impressions: 2500, ctr: 1.8, cpc: 3.33, conversions: 3 },
    metrics: { spend: 150, clicks: 45, impressions: 2500, ctr: 1.8, cpc: 3.33, conversions: 3, costPerConversion: 50 },
    keywords: [
      { keyword: 'hoa violation help', matchType: 'PHRASE', qualityScore: 7, clicks: 15, impressions: 800, ctr: 1.88, cpc: 2.50, conversions: 1 },
      { keyword: 'dispute hoa fine', matchType: 'EXACT', qualityScore: 8, clicks: 10, impressions: 400, ctr: 2.50, cpc: 3.00, conversions: 1 },
      { keyword: 'hoa lawyer', matchType: 'BROAD', qualityScore: 5, clicks: 20, impressions: 1300, ctr: 1.54, cpc: 4.00, conversions: 1 },
    ],
    searchTerms: [
      { searchTerm: 'how to fight hoa violation', clicks: 8, impressions: 200, ctr: 4.0, conversions: 1 },
      { searchTerm: 'hoa fine appeal letter', clicks: 5, impressions: 150, ctr: 3.33, conversions: 0 },
    ],
    ads: [
      { headlines: ['Fight Your HOA Violation', 'Get Expert Help Today', 'Free Case Review'], descriptions: ['Don\'t pay unfair HOA fines. Our experts help you fight back.', 'Quick, affordable HOA dispute resolution.'], clicks: 45, impressions: 2500, ctr: 1.8 },
    ],
    period: 'week'
  };

  const systemPrompt = `You are a Google Ads optimization expert specializing in legal services marketing, particularly HOA dispute resolution services. Provide actionable suggestions to improve ROI.`;

  const prompt = `Analyze this Google Ads campaign and provide optimization suggestions.

## Campaign: ${testData.campaign.name}
## Period: ${testData.period}

## Metrics:
- Spend: $${testData.metrics.spend}
- Clicks: ${testData.metrics.clicks}
- Impressions: ${testData.metrics.impressions}
- CTR: ${testData.metrics.ctr}%
- CPC: $${testData.metrics.cpc}
- Conversions: ${testData.metrics.conversions}
- Cost/Conversion: $${testData.metrics.costPerConversion}

## Keywords:
${testData.keywords.map(k => `- "${k.keyword}" (${k.matchType}, QS:${k.qualityScore}) - ${k.clicks} clicks, ${k.ctr}% CTR, ${k.conversions} conv`).join('\n')}

## Search Terms:
${testData.searchTerms.map(st => `- "${st.searchTerm}" - ${st.clicks} clicks, ${st.ctr}% CTR, ${st.conversions} conv`).join('\n')}

## Ad Copy:
Headlines: ${testData.ads[0].headlines.join(' | ')}
Descriptions: ${testData.ads[0].descriptions.join(' | ')}

Provide suggestions in JSON format:
{
  "performanceSummary": "2-3 sentence analysis",
  "keywordSuggestions": [{"action": "add|pause|modify", "keyword": "...", "matchType": "...", "rationale": "...", "priority": "high|medium|low"}],
  "adCopySuggestions": [{"type": "headline|description", "current": "...", "suggested": "...", "rationale": "...", "priority": "high|medium|low"}],
  "generalRecommendations": [{"recommendation": "...", "category": "budget|targeting|bidding|creative", "priority": "high|medium|low", "expectedImpact": "..."}]
}`;

  try {
    console.log('\n🚀 Testing Claude API for ad suggestions...\n');
    const response = await callClaudeAPI(prompt, systemPrompt);

    console.log('\n✅ Raw response:\n');
    console.log(response);

    // Try to parse JSON
    try {
      const cleanedText = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      console.log('\n✅ Parsed JSON successfully!\n');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('\n⚠️ Could not parse as JSON, but response received');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
