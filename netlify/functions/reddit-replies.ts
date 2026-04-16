import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REDDIT_USERNAME = 'disputemyhoa';
const USER_AGENT = 'DMHOA-Dashboard/1.0';

/**
 * Strategy: Reddit blocks JSON from cloud IPs but allows RSS.
 * 1. Fetch u/disputemyhoa's recent comments via user RSS to get comment IDs + thread URLs
 * 2. For each comment, fetch its permalink RSS (e.g. /r/HOA/comments/postid/slug/commentid/.rss)
 *    which returns ONLY comments in that subtree (our comment + direct replies)
 * 3. Any entry in that RSS by a different user is a reply to us
 */

interface CommentInfo {
  commentId: string;
  threadUrl: string;
  subreddit: string;
  threadTitle: string;
}

function parseRssEntries(xml: string) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  return entries.map(e => {
    const entry = e[1];
    const author = (entry.match(/<name>\/u\/([^<]+)<\/name>/) || [])[1] || '';
    const id = (entry.match(/<id>([^<]+)<\/id>/) || [])[1] || '';
    const link = (entry.match(/<link href="([^"]+)"/) || [])[1] || '';
    const contentRaw = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '';
    // Strip HTML: first decode HTML entities in the raw content, then strip tags
    const decoded = contentRaw
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const body = decoded
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
    let createdUtc = 0;
    if (published) {
      try {
        createdUtc = new Date(published).getTime() / 1000;
      } catch {}
    }
    return { author, id, link, body, createdUtc };
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    // Step 1: Fetch our recent comments from user RSS (with retry)
    let userRssResp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
      userRssResp = await fetch(
        `https://www.reddit.com/user/${REDDIT_USERNAME}/comments.rss`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      if (userRssResp.ok) break;
    }

    if (!userRssResp || !userRssResp.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, error: 'Could not fetch user comments (Reddit may be rate-limiting)', threads_checked: 0, replies: [] }),
      };
    }

    const userRss = await userRssResp.text();
    const userEntries = parseRssEntries(userRss);

    // Build a map of our comment IDs to their permalink info
    const ourComments: CommentInfo[] = [];
    for (const entry of userEntries) {
      if (entry.author.toLowerCase() !== REDDIT_USERNAME.toLowerCase()) continue;
      // Extract comment ID (t1_xxxxx -> xxxxx)
      const commentId = entry.id.startsWith('t1_') ? entry.id.substring(3) : entry.id;
      // Extract subreddit from link
      const subMatch = entry.link.match(/\/r\/([^/]+)\//);
      const subreddit = subMatch ? subMatch[1] : '';
      // The link IS the permalink to our comment
      ourComments.push({
        commentId,
        threadUrl: entry.link,
        subreddit,
        threadTitle: '', // Will be filled from lead data
      });
    }

    // Step 2: Cross-reference with replied leads from Supabase
    const leadsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/dmhoa_leads?status=eq.replied&select=id,post_id,title,url,subreddit,replied_at&order=replied_at.desc&limit=50`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!leadsResp.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch leads' }) };
    }

    const leads: any[] = await leadsResp.json();
    if (!leads || leads.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, threads_checked: 0, replies: [] }) };
    }

    // Match leads to our comments by post_id in URL
    const allReplies: any[] = [];
    let threadsChecked = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      const leadUrl = (lead.url || '').replace('https://reddit.com', '').replace('https://www.reddit.com', '');
      // Find our comment for this thread
      const matchingComment = ourComments.find(c => {
        const commentUrl = c.threadUrl.replace('https://www.reddit.com', '');
        // The comment URL contains the post ID from the lead URL
        const leadPostId = (leadUrl.match(/\/comments\/([^/]+)/) || [])[1];
        const commentPostId = (commentUrl.match(/\/comments\/([^/]+)/) || [])[1];
        return leadPostId && commentPostId && leadPostId === commentPostId;
      });

      if (!matchingComment) continue;

      // Step 3: Fetch our comment's permalink RSS to get replies to us
      let commentRssUrl = matchingComment.threadUrl;
      if (!commentRssUrl.endsWith('/')) commentRssUrl += '/';
      commentRssUrl = commentRssUrl.replace(/\/$/, '.rss');
      // Fix: the link from user RSS is like https://www.reddit.com/r/HOA/comments/postid/slug/commentid/
      // We need to add .rss: https://www.reddit.com/r/HOA/comments/postid/slug/commentid/.rss
      commentRssUrl = matchingComment.threadUrl.replace(/\/?$/, '/.rss');

      try {
        const rssResp = await fetch(commentRssUrl, {
          headers: { 'User-Agent': USER_AGENT },
        });

        if (rssResp.ok) {
          const rssText = await rssResp.text();
          const entries = parseRssEntries(rssText);
          threadsChecked++;

          // Skip entry 0 (OP post) and entry 1 (our comment)
          // Everything after that by a different user is a reply to us
          let foundOurComment = false;
          for (const entry of entries) {
            if (entry.author.toLowerCase() === REDDIT_USERNAME.toLowerCase()) {
              foundOurComment = true;
              continue;
            }
            // Only count entries after our comment and skip OP
            if (foundOurComment && entry.id.startsWith('t1_')) {
              allReplies.push({
                lead_id: lead.id,
                lead_title: lead.title || '',
                subreddit: lead.subreddit || '',
                reddit_url: lead.url,
                reply_author: entry.author,
                reply_body: entry.body.substring(0, 1000),
                reply_id: entry.id.startsWith('t1_') ? entry.id.substring(3) : entry.id,
                reply_created_utc: entry.createdUtc,
              });
            }
          }
        } else {
          errors.push(`r/${lead.subreddit}: comment RSS status ${rssResp.status}`);
        }
      } catch (e: any) {
        errors.push(`r/${lead.subreddit}: ${e.message}`);
      }

      // Be polite between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Sort by most recent reply first
    allReplies.sort((a, b) => (b.reply_created_utc || 0) - (a.reply_created_utc || 0));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        threads_checked: threadsChecked,
        replies: allReplies,
        errors: errors.length > 0 ? errors : null,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Unknown error' }),
    };
  }
};
