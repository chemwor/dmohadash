require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Simple RSS parser implementation (no external dependencies)
function parseRSS(xmlText) {
  const items = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];

    const getTagContent = (tag) => {
      const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const tagMatch = itemContent.match(regex);
      if (tagMatch) {
        return (tagMatch[1] || tagMatch[2] || '').trim();
      }
      return '';
    };

    const title = getTagContent('title');
    const link = getTagContent('link');
    const description = getTagContent('description');
    const pubDate = getTagContent('pubDate');
    const source = getTagContent('source');

    if (title && link) {
      items.push({
        title: cleanHtml(title),
        link: link,
        description: cleanHtml(description).substring(0, 300),
        pubDate: pubDate,
        source: cleanHtml(source) || extractSourceFromLink(link),
      });
    }
  }

  return items;
}

function cleanHtml(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractSourceFromLink(link) {
  try {
    const url = new URL(link);
    return url.hostname.replace('www.', '');
  } catch {
    return 'Unknown Source';
  }
}

// Reduced queries for faster response
const HOA_QUERIES = [
  'HOA homeowners association news',
  'HOA legislation law',
];

function categorizeArticle(title, description) {
  const text = (title + ' ' + description).toLowerCase();

  if (text.includes('legislation') || text.includes('law') || text.includes('bill') || text.includes('senate') || text.includes('house')) {
    return 'legislation';
  }
  if (text.includes('enforcement') || text.includes('fine') || text.includes('violation') || text.includes('compliance')) {
    return 'enforcement';
  }
  if (text.includes('court') || text.includes('lawsuit') || text.includes('ruling') || text.includes('judge')) {
    return 'legal';
  }
  if (text.includes('fee') || text.includes('assessment') || text.includes('budget') || text.includes('reserve')) {
    return 'financial';
  }
  return 'general';
}

function getPriority(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  const hoaTerms = ['hoa', 'homeowners association', 'homeowner association', 'condo association', 'community association', 'property owners association'];

  const matchCount = hoaTerms.filter(term => text.includes(term)).length;

  if (matchCount >= 2) return 'high';
  if (matchCount === 1) return 'medium';
  return 'low';
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchGoogleNewsRSS(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HOADashboard/1.0)',
      },
    }, 8000);

    if (!response.ok) {
      console.error(`Failed to fetch Google News for "${query}": ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const items = parseRSS(xmlText);

    return items.map(item => ({
      ...item,
      query: query,
      fetchedFrom: 'google_news',
    }));
  } catch (error) {
    console.error(`Error fetching Google News for "${query}":`, error.message);
    return [];
  }
}

async function fetchDirectRSSFeeds() {
  const feeds = [
    {
      url: 'https://advocacy.caionline.org/feed/',
      name: 'CAI Advocacy',
    },
  ];

  const allItems = [];

  for (const feed of feeds) {
    try {
      const response = await fetchWithTimeout(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HOADashboard/1.0)',
        },
      }, 5000);

      if (response.ok) {
        const xmlText = await response.text();
        const items = parseRSS(xmlText);

        items.forEach(item => {
          allItems.push({
            ...item,
            source: feed.name,
            fetchedFrom: 'direct_feed',
          });
        });
      }
    } catch (error) {
      console.error(`Error fetching ${feed.name}:`, error.message);
    }
  }

  return allItems;
}

async function saveArticlesToDB(supabase, articles) {
  if (!articles || articles.length === 0) return { saved: 0, skipped: 0 };

  const now = new Date().toISOString();
  let saved = 0;
  let skipped = 0;

  // Get existing links to avoid duplicates (faster than upsert without unique constraint)
  const { data: existing } = await supabase
    .from('hoa_news_articles')
    .select('link')
    .limit(500);

  const existingLinks = new Set((existing || []).map(a => a.link));

  // Filter to only new articles
  const newArticles = articles.filter(a => !existingLinks.has(a.link));
  skipped = articles.length - newArticles.length;

  if (newArticles.length === 0) {
    return { saved: 0, skipped };
  }

  // Insert new articles in small batches
  const batchSize = 10;
  for (let i = 0; i < newArticles.length; i += batchSize) {
    const batch = newArticles.slice(i, i + batchSize).map(article => ({
      link: article.link,
      title: article.title,
      description: article.description,
      source: article.source,
      pub_date: article.pubDate ? new Date(article.pubDate).toISOString() : null,
      query: article.query || null,
      fetched_from: article.fetchedFrom,
      category: article.category,
      priority: article.priority,
      first_seen_at: now,
      last_seen_at: now,
    }));

    try {
      const { error } = await supabase
        .from('hoa_news_articles')
        .insert(batch);

      if (!error) {
        saved += batch.length;
      } else {
        console.error('Batch insert error:', error.message);
      }
    } catch (error) {
      console.error('Insert error:', error.message);
    }
  }

  return { saved, skipped };
}

async function getArticlesFromDB(supabase, includeDismissed = false) {
  let query = supabase
    .from('hoa_news_articles')
    .select('*')
    .order('pub_date', { ascending: false, nullsFirst: false })
    .limit(100);

  if (!includeDismissed) {
    query = query.eq('dismissed', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching articles from DB:', error.message);
    return [];
  }

  return data || [];
}

function calculateStats(articles) {
  return {
    total: articles.length,
    byCategory: {
      legislation: articles.filter(a => a.category === 'legislation').length,
      enforcement: articles.filter(a => a.category === 'enforcement').length,
      legal: articles.filter(a => a.category === 'legal').length,
      financial: articles.filter(a => a.category === 'financial').length,
      general: articles.filter(a => a.category === 'general').length,
    },
    byPriority: {
      high: articles.filter(a => a.priority === 'high').length,
      medium: articles.filter(a => a.priority === 'medium').length,
      low: articles.filter(a => a.priority === 'low').length,
    },
    sources: [...new Set(articles.map(a => a.source))].length,
    bookmarked: articles.filter(a => a.bookmarked).length,
    usedForContent: articles.filter(a => a.used_for_content).length,
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Initialize Supabase client inside handler
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Handle PATCH requests for updating article status
  if (event.httpMethod === 'PATCH') {
    try {
      const body = JSON.parse(event.body);
      const { articleId, action } = body;

      if (!articleId || !action) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing articleId or action' }),
        };
      }

      let updateData = {};
      switch (action) {
        case 'bookmark':
          updateData = { bookmarked: true };
          break;
        case 'unbookmark':
          updateData = { bookmarked: false };
          break;
        case 'dismiss':
          updateData = { dismissed: true };
          break;
        case 'undismiss':
          updateData = { dismissed: false };
          break;
        case 'markUsed':
          updateData = { used_for_content: true };
          break;
        case 'unmarkUsed':
          updateData = { used_for_content: false };
          break;
        default:
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' }),
          };
      }

      const { error } = await supabase
        .from('hoa_news_articles')
        .update(updateData)
        .eq('id', articleId);

      if (error) {
        throw error;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, action, articleId }),
      };
    } catch (error) {
      console.error('Error updating article:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update article' }),
      };
    }
  }

  // Handle GET requests
  const forceRefresh = event.queryStringParameters?.refresh === 'true';
  const includeDismissed = event.queryStringParameters?.includeDismissed === 'true';
  const bookmarkedOnly = event.queryStringParameters?.bookmarked === 'true';

  let refreshResult = null;

  try {
    if (forceRefresh) {
      console.log('Fetching HOA news from external sources...');

      // Wrap refresh in a timeout to ensure we don't exceed 25s
      const refreshPromise = (async () => {
        // Fetch from just one query to keep it fast
        const googleNewsResults = await fetchGoogleNewsRSS(HOA_QUERIES[0]);

        let allArticles = [...googleNewsResults];

        // Deduplicate by title
        const seen = new Set();
        allArticles = allArticles.filter(article => {
          const normalizedTitle = article.title.toLowerCase().substring(0, 50);
          if (seen.has(normalizedTitle)) {
            return false;
          }
          seen.add(normalizedTitle);
          return true;
        });

        // Add categorization
        allArticles = allArticles.map(article => ({
          ...article,
          category: categorizeArticle(article.title, article.description),
          priority: getPriority(article.title, article.description),
          timestamp: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString(),
        }));

        return await saveArticlesToDB(supabase, allArticles);
      })();

      // Set a 15 second timeout for refresh
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Refresh timeout')), 15000)
      );

      try {
        refreshResult = await Promise.race([refreshPromise, timeoutPromise]);
        console.log('Refresh completed:', refreshResult);
      } catch (refreshError) {
        console.log('Refresh skipped or timed out:', refreshError.message);
        // Continue to return cached data
      }
    }

    let dbArticles = await getArticlesFromDB(supabase, includeDismissed);

    if (bookmarkedOnly) {
      dbArticles = dbArticles.filter(a => a.bookmarked);
    }

    const articles = dbArticles.map(article => ({
      id: article.id,
      title: article.title,
      link: article.link,
      description: article.description,
      pubDate: article.pub_date,
      source: article.source,
      query: article.query,
      fetchedFrom: article.fetched_from,
      category: article.category,
      priority: article.priority,
      timestamp: article.pub_date || article.created_at,
      bookmarked: article.bookmarked,
      usedForContent: article.used_for_content,
      dismissed: article.dismissed,
      firstSeenAt: article.first_seen_at,
      lastSeenAt: article.last_seen_at,
    }));

    articles.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const stats = calculateStats(articles);

    const data = {
      articles: articles.slice(0, 50),
      stats,
      lastUpdated: new Date().toISOString(),
      queriesUsed: HOA_QUERIES,
      fromDatabase: true,
      refreshResult: refreshResult,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('HOA News fetch error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch HOA news',
        message: error.message || 'Unknown error',
      }),
    };
  }
};
