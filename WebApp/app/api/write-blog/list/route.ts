import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    let sessionUser: any = null;
    try {
      const session = await auth.api.getSession({ headers: request.headers as any });
      sessionUser = session?.user || null;
    } catch {}

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ items: [] });
    }
    
    if (!sessionUser) {
      return NextResponse.json({ items: [] });
    }

    const { searchParams } = new URL(request.url);
    const paramUserId = searchParams.get('user_id');
    const paramCompanyUrl = searchParams.get('company_url');
    
    // We expect user_id and company_url for the new structure
    if (!paramUserId || !paramCompanyUrl) {
       // If missing, return empty or handle legacy list? 
       // User prompt implies specific structure for "fetching the results".
       // We'll return empty if context is missing.
       return NextResponse.json({ items: [] });
    }

    // Secure check: verify paramUserId matches session (unless superuser)
    const superuserEmails = (process.env.SUPERUSER_EMAILS || '').split(',').map(e => e.trim());
    const isSuperuser = sessionUser.email && superuserEmails.includes(sessionUser.email);
    
    if (!isSuperuser && paramUserId !== sessionUser.id) {
       return NextResponse.json({ items: [] });
    }

    // Fetch the single row container with loose URL matching (ignore trailing slash and www.)
    const sql = `
      SELECT id, blog, topic, twitter_post, linkedin_post, reddit_post, company_url, brand_name 
      FROM blogs 
      WHERE user_id = $1 
      AND REPLACE(RTRIM(company_url, '/'), 'www.', '') = REPLACE(RTRIM($2, '/'), 'www.', '')
      LIMIT 1
    `;
    const res = await pool.query(sql, [paramUserId, paramCompanyUrl]);
    
    if (res.rows.length === 0) {
      return NextResponse.json({ items: [], topics: [], twitter_posts: [], linkedin_posts: [], reddit_posts: [] });
    }

    const row = res.rows[0];
    
    const parseArray = (data: any) => {
       try {
          if (typeof data === 'string') {
             if (data.trim().startsWith('[')) return JSON.parse(data);
             if (data.trim().startsWith('{')) return [JSON.parse(data)];
             if (data.trim()) return [data];
          } else if (Array.isArray(data)) return data;
       } catch {}
       return [];
    };

    const extractTitle = (content: string, platform: string) => {
       if (!content) return "";
       if (platform === 'blog' || platform === 'reddit') {
         const h1Match = content.match(/^#\s+(.*)$/m);
         if (h1Match) return h1Match[1].trim();
         const boldMatch = content.match(/^\*\*(.*)\*\*/m);
         if (boldMatch) return boldMatch[1].trim();
       }
       const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
       if (lines.length > 0) {
         const firstLine = lines[0].replace(/[#*`]/g, '').trim();
         return firstLine.length > 60 ? firstLine.substring(0, 60) + "..." : firstLine;
       }
       return "";
    };

    const blogItems = parseArray(row.blog);
    const topicItems = parseArray(row.topic); // These are suggestions
    const twitterItemsRaw = parseArray(row.twitter_post);
    const linkedinItemsRaw = parseArray(row.linkedin_post);
    const redditItemsRaw = parseArray(row.reddit_post);

    // Normalize items for frontend
    const normalizedBlogs = blogItems.map((item: any) => {
       const content = typeof item === 'string' ? item : item.content || "";
       const title = (typeof item === 'object' && item.topic) ? item.topic : extractTitle(content, 'blog');
       const isPrompt = item.isprompt === true || item.isprompt === 'true' || item.is_prompt === true || item.is_prompt === 'true';
       
       return {
          id: item.id || crypto.randomUUID(),
          topic: title || "Untitled Blog",
          createdAt: item.timestamp || new Date().toISOString(),
          content: content,
          companyUrl: row.company_url,
          brandName: row.brand_name,
          isprompt: isPrompt
       };
    });

    const normalizedSocials = (items: any[], platform: string) => {
       return items.map((item: any) => {
          const content = typeof item === 'string' ? item : item.content || "";
          const title = (typeof item === 'object' && item.topic) ? item.topic : extractTitle(content, platform);
          let labelPrefix = platform.charAt(0).toUpperCase() + platform.slice(1);
          const isPrompt = item.isprompt === true || item.isprompt === 'true' || item.is_prompt === true || item.is_prompt === 'true';
          
          return {
             id: item.id || crypto.randomUUID(),
             topic: title || `${labelPrefix} Post`,
             timestamp: item.timestamp || new Date().toISOString(),
             content: content,
             platform: platform,
             isprompt: isPrompt
          };
       });
    };

    const twitterItems = normalizedSocials(twitterItemsRaw, 'twitter');
    const linkedinItems = normalizedSocials(linkedinItemsRaw, 'linkedin');
    const redditItems = normalizedSocials(redditItemsRaw, 'reddit');
    
    const allSocials = [...twitterItems, ...linkedinItems, ...redditItems];
    allSocials.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    normalizedBlogs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ 
       items: normalizedBlogs,
       topics: topicItems,
       socials: allSocials
    });
  } catch (e) {
    console.error('write-blog/list error', e);
    return NextResponse.json({ error: 'Failed to list blogs' }, { status: 500 });
  }
}
