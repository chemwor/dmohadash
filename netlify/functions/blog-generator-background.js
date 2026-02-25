require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// No timeout for background function - can run up to 15 minutes
async function callClaudeAPI(prompt, systemPrompt, maxTokens = 2048) {
  console.log('Calling Claude API...');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Claude API response received');
  return data.content[0].text;
}

async function fetchUnsplashImage(query, excludeUrls = []) {
  if (!UNSPLASH_ACCESS_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const photo = data.results.find(p => !excludeUrls.includes(p.urls.regular)) || data.results[0];
      return {
        url: photo.urls.regular,
        alt: photo.alt_description || query,
        credit: `Photo by ${photo.user.name} on Unsplash`,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Unsplash image:', error);
    return null;
  }
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

function generateTopicHash(title) {
  const keywords = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .join('-');
  return keywords.substring(0, 100);
}

function estimateReadTime(content) {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

async function getExistingTopics(supabase) {
  const { data: blogs } = await supabase
    .from('blog_posts')
    .select('topic_hash, image_url')
    .not('topic_hash', 'is', null);

  return {
    topicHashes: (blogs || []).map(b => b.topic_hash).filter(Boolean),
    usedImageUrls: (blogs || []).map(b => b.image_url).filter(Boolean),
  };
}

async function generateIdeas(articles, existingTopics, supabase) {
  const systemPrompt = `You are an expert content strategist for an HOA dispute resolution platform. Generate unique blog post ideas that help homeowners understand their rights and navigate HOA issues. Respond with valid JSON only.`;

  const articleSummaries = articles.map(a =>
    `- "${a.title}" [${a.category}]: ${a.description || 'No description'}`
  ).join('\n');

  const existingTopicsList = existingTopics.slice(0, 10).join(', ');

  const prompt = `Based on these HOA news articles, generate 3-5 unique blog post ideas:

ARTICLES:
${articleSummaries}

AVOID THESE EXISTING TOPICS (don't repeat similar ideas):
${existingTopicsList || 'None yet'}

For each idea, provide:
1. A compelling title (50-70 chars)
2. A brief description of the blog angle (2-3 sentences)
3. The unique angle/perspective
4. Target SEO keywords

Respond with this JSON:
{
  "ideas": [
    {
      "title": "Engaging blog title",
      "description": "What this blog will cover and why it's valuable to homeowners",
      "angle": "The unique perspective or hook",
      "target_keywords": ["keyword1", "keyword2", "keyword3"],
      "source_article_indices": [0, 1]
    }
  ]
}`;

  const responseText = await callClaudeAPI(prompt, systemPrompt, 1500);
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const result = JSON.parse(cleanedText);

  // Save ideas to database
  const savedIdeas = [];
  for (const idea of result.ideas) {
    const sourceArticleIds = (idea.source_article_indices || [])
      .map(i => articles[i]?.id)
      .filter(Boolean);

    const { data, error } = await supabase
      .from('blog_ideas')
      .insert({
        title: idea.title,
        description: idea.description,
        angle: idea.angle,
        target_keywords: idea.target_keywords || [],
        source_article_ids: sourceArticleIds,
        status: 'pending',
      })
      .select()
      .single();

    if (!error) savedIdeas.push(data);
  }

  return savedIdeas;
}

async function generateBlogContent(idea, articles) {
  const systemPrompt = `You are an expert content writer for DisputeMyHOA, a platform helping homeowners fight unfair HOA violations. Write engaging, informative, SEO-optimized blog posts. Your tone is professional, empathetic, and empowering. Respond with valid JSON only.`;

  const articleContext = articles.map(a =>
    `- "${a.title}": ${a.description || ''}`
  ).join('\n');

  const prompt = `Write a comprehensive blog post based on this idea:

TITLE: ${idea.title}
ANGLE: ${idea.angle}
DESCRIPTION: ${idea.description}
TARGET KEYWORDS: ${idea.target_keywords?.join(', ') || 'HOA, homeowners, rights'}

SOURCE ARTICLES FOR CONTEXT:
${articleContext}

Write an 800-1200 word blog post that:
1. Has an engaging introduction that hooks readers
2. Provides actionable advice for homeowners
3. Explains legal concepts in plain language
4. Includes specific examples and scenarios
5. Ends with a clear call-to-action

Respond with this JSON:
{
  "title": "${idea.title}",
  "content": "Full blog content in markdown format with ## headers, bullet points, and clear sections",
  "excerpt": "Compelling 150-200 character summary for previews",
  "seo_title": "SEO optimized title (max 60 chars)",
  "seo_description": "Meta description (150-160 chars)",
  "seo_keywords": ["keyword1", "keyword2"],
  "image_search_query": "2-3 word query for stock photo"
}`;

  const responseText = await callClaudeAPI(prompt, systemPrompt, 4096);
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanedText);
}

async function saveBlogPost(supabase, blogData, image, ideaId, articleIds) {
  const slug = generateSlug(blogData.title);
  const topicHash = generateTopicHash(blogData.title);
  const readTime = estimateReadTime(blogData.content);

  const insertData = {
    title: blogData.title,
    slug: slug,
    excerpt: blogData.excerpt,
    content: blogData.content,
    image_url: image?.url || null,
    image_alt: image?.alt || null,
    image_credit: image?.credit || null,
    category: 'hoa-news',
    tags: blogData.seo_keywords || [],
    status: 'published',
    seo_title: blogData.seo_title || blogData.title,
    seo_description: blogData.seo_description || blogData.excerpt,
    seo_keywords: blogData.seo_keywords || [],
    source_article_ids: articleIds,
    topic_hash: topicHash,
    read_time_minutes: readTime,
    published_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('blog_posts')
    .insert(insertData)
    .select()
    .single();

  if (error && error.code === '23505') {
    insertData.slug = `${slug}-${Date.now()}`;
    const retry = await supabase.from('blog_posts').insert(insertData).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  // Update idea status
  if (ideaId) {
    await supabase
      .from('blog_ideas')
      .update({ status: 'generated', generated_blog_id: data.id, updated_at: new Date().toISOString() })
      .eq('id', ideaId);
  }

  // Mark articles as used
  if (articleIds && articleIds.length > 0) {
    await supabase
      .from('hoa_news_articles')
      .update({ used_for_content: true })
      .in('id', articleIds);
  }

  return data;
}

// Background functions return immediately with 202 and process asynchronously
exports.handler = async (event) => {
  console.log('Background blog generator started');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action;

    if (action === 'generate-ideas') {
      console.log('Generating ideas...');

      // Get articles
      let { data: articles } = await supabase
        .from('hoa_news_articles')
        .select('id, title, description, category, priority, pub_date, source, link')
        .eq('dismissed', false)
        .order('pub_date', { ascending: false, nullsFirst: false })
        .limit(10);

      if (!articles || articles.length === 0) {
        console.log('No articles available');
        return { statusCode: 200 };
      }

      // Get existing topics
      const { data: existingIdeas } = await supabase
        .from('blog_ideas')
        .select('title')
        .in('status', ['pending', 'approved', 'generating']);

      const existingTitles = (existingIdeas || []).map(i => i.title.toLowerCase());

      const savedIdeas = await generateIdeas(articles, existingTitles, supabase);
      console.log(`Generated ${savedIdeas.length} ideas`);

      return { statusCode: 200 };
    }

    if (action === 'generate-blog') {
      const ideaId = body.ideaId;
      console.log('Generating blog for idea:', ideaId);

      if (!ideaId) {
        console.log('Missing ideaId');
        return { statusCode: 200 };
      }

      // Get the idea
      const { data: idea, error: ideaError } = await supabase
        .from('blog_ideas')
        .select('*')
        .eq('id', ideaId)
        .single();

      if (ideaError || !idea) {
        console.log('Idea not found');
        return { statusCode: 200 };
      }

      // Update status to generating
      await supabase
        .from('blog_ideas')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', ideaId);

      // Get source articles
      let articles = [];
      if (idea.source_article_ids && idea.source_article_ids.length > 0) {
        const { data } = await supabase
          .from('hoa_news_articles')
          .select('id, title, description, category')
          .in('id', idea.source_article_ids);
        articles = data || [];
      }

      try {
        // Generate blog content
        const blogData = await generateBlogContent(idea, articles);

        // Get image
        const existingTopics = await getExistingTopics(supabase);
        const image = await fetchUnsplashImage(
          blogData.image_search_query || 'home neighborhood',
          existingTopics.usedImageUrls
        );

        // Save blog
        const blog = await saveBlogPost(
          supabase,
          blogData,
          image,
          ideaId,
          idea.source_article_ids || []
        );

        console.log('Blog generated:', blog.id);
      } catch (err) {
        console.error('Error generating blog:', err);
        // Update idea status to show error
        await supabase
          .from('blog_ideas')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', ideaId);
      }

      return { statusCode: 200 };
    }

    console.log('Unknown action:', action);
    return { statusCode: 200 };
  } catch (error) {
    console.error('Background function error:', error);
    return { statusCode: 200 }; // Background functions always return 200
  }
};
