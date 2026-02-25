import { NextResponse } from 'next/server';
import { parse } from 'node-html-parser';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import { Autumn } from 'autumn-js';
dotenv.config({ path: '.env.local' });

import { getProviderModel, PROVIDER_CONFIGS } from '@/lib/provider-config';
import { FEATURE_ID_MESSAGES, CREDITS_PER_BLOG_GENERATION } from '@/config/constants';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';

const GEMINI_DEFAULT_MODEL = 'google/gemini-2.5-flash';
const MAX_TOKENS = process.env.MAX_TOKENS ? Number(process.env.MAX_TOKENS) : 2000;

const autumn = new Autumn({
  apiKey: process.env.AUTUMN_SECRET_KEY!,
});

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CompanyBlogger/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.text();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function extractFromHtml(html: string, url: string) {
  const root = parse(html);

  let brandName: string | null = null;
  const ogSiteName = root.querySelector('meta[property="og:site_name"]');
  if (ogSiteName && ogSiteName.getAttribute('content')) brandName = ogSiteName.getAttribute('content')!.trim();
  else {
    const ogTitle = root.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute('content')) brandName = ogTitle.getAttribute('content')!.trim();
    else if (root.querySelector('title')) brandName = root.querySelector('title')!.text.trim();
  }

  let email: string | null = null;
  const mailAnchors = root.querySelectorAll('a[href^="mailto:"]');
  if (mailAnchors && mailAnchors.length > 0) {
    for (const a of mailAnchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      const candidate = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (candidate) { email = candidate; break; }
    }
  } else {
    const bodyText = root.text;
    const match = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match) email = match[0];
  }

  const paragraphs = root.querySelectorAll('p').slice(0, 60);
  const pText = paragraphs.map(p => p.text.trim()).filter(Boolean).join('\n\n');

  let metaDesc = '';
  const metaDescription = root.querySelector('meta[name="description"]') || root.querySelector('meta[property="og:description"]');
  if (metaDescription && metaDescription.getAttribute('content')) metaDesc = metaDescription.getAttribute('content')!.trim();

  const content = [metaDesc, pText].filter(Boolean).join('\n\n');

  if (!brandName) {
    try {
      const u = new URL(url);
      brandName = u.hostname.replace(/^www\./, '');
    } catch {
      brandName = url;
    }
  }

  return { brandName, email, content };
}

async function ensureTable() {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS blogs (
      id SERIAL PRIMARY KEY,
      company_url TEXT NOT NULL,
      email_id TEXT,
      brand_name TEXT,
      blog TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `;
  await pool.query(createSQL);
  // Ensure topic column exists on legacy tables
  await pool.query('ALTER TABLE blogs ADD COLUMN IF NOT EXISTS topic TEXT');
}

async function generateBlog({ topic, brandName, scrapedContent, providedEmail, providedBrand, platform }: {
  topic: string; brandName: string | null; scrapedContent: string; providedEmail: string | null; providedBrand?: string | null; platform?: string;
}) {
  let systemPrompt = `You are a professional content writer focusing on helpful, accurate, and SEO-friendly blogs. Use only the facts provided in "Scraped Content" and the brand information the user has provided. If information is missing, you may add minimal general context but mark it as generic at the end. Output the blog in Markdown. Start with a "Meta Description" heading (one or two sentences).`;

  if (platform && ['reddit', 'linkedin', 'twitter', 'x'].includes(platform.toLowerCase())) {
     systemPrompt = `You are a social media expert. Create a high-quality, engaging post for ${platform}. Use the provided brand info and scraped content. Keep it concise and native to the platform style (e.g. hashtags for Twitter/LinkedIn, professional tone for LinkedIn, conversational for Reddit).`;
  }

  const userPrompt = `
Topic: ${topic}
Brand (provided): ${providedBrand || brandName}
Email (provided): ${providedEmail || 'N/A'}

Scraped Content (use this as source facts):
${(scrapedContent || '').slice(0, 12000)}

${platform && ['reddit', 'linkedin', 'twitter', 'x'].includes(platform.toLowerCase()) 
  ? `Write a ${platform} post for "${providedBrand || brandName}" about "${topic}".` 
  : `Write a comprehensive, well-structured blog post for "${providedBrand || brandName}" about "${topic}". Use headings, bullets/lists where useful, and include an "Conclusion" section. If you added any generic info, append a short line "Note: generic information added." at the end.`}
  Cite specific scraped facts inline using [source].
`;

  const model = getProviderModel('google', GEMINI_DEFAULT_MODEL);
  if (!model) throw new Error('Gemini model not available or API key not configured');

  const { text } = await generateText({
    model,    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0,
    maxTokens: Math.min(MAX_TOKENS, 4000)
  });

  if (!text) throw new Error('AI returned empty response');
  return text;
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Server misconfiguration: missing DATABASE_URL' }, { status: 500 });
    }

    // Get session and enforce auth
    // @ts-ignore - NextRequest type not available here; using any headers
    const session = await auth.api.getSession({ headers: (request as any).headers });
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized: Please log in to generate a blog.' }, { status: 401 });
    }
    const userId = session.user.id;

    // Check credits
    try {
      const access = await autumn.check({
        customer_id: userId,
        feature_id: FEATURE_ID_MESSAGES,
      });

      const balance = access.data?.balance || 0;
      if (!access.data?.allowed || balance < CREDITS_PER_BLOG_GENERATION) {
        return NextResponse.json({ 
          error: `Insufficient credits. You need at least ${CREDITS_PER_BLOG_GENERATION} credits.`,
          required: CREDITS_PER_BLOG_GENERATION,
          balance 
        }, { status: 402 });
      }
    } catch (error) {
       console.error('[write-blog] Credit check failed:', error);
       // Allow proceeding if check fails? Or block? Usually block to be safe.
       return NextResponse.json({ error: 'Unable to verify credits. Please try again.' }, { status: 500 });
    }

    const body = await request.json();
    const { company_url, topic, brand_name: providedBrand, email_id: providedEmail, isprompt, platform } = body ?? {} as any;

    if (!company_url || !topic) {
      return NextResponse.json({ error: 'Missing required fields: company_url and topic' }, { status: 400 });
    }

    let html: string;
    try {
      html = await fetchHtml(company_url);
    } catch (err: any) {
      return NextResponse.json({ error: `Failed to fetch company_url: ${err.message}` }, { status: 400 });
    }

    const { brandName: scrapedBrand, email: scrapedEmail, content: scrapedContent } = extractFromHtml(html, company_url);
    const finalBrand = providedBrand || scrapedBrand;
    let finalEmail = providedEmail || scrapedEmail || null;

    if (session.user.email) finalEmail = session.user.email;

    // We only ensure table if we are saving (for blog). But existing logic ensures it anyway.
    if (!platform || platform === 'blog') {
        await ensureTable();
    }

    let generatedText: string;
    try {
      console.log("Generating content for:", finalBrand, "on topic:", topic, "platform:", platform || 'blog');
      generatedText = await generateBlog({
        topic,
        brandName: scrapedBrand,
        scrapedContent,
        providedEmail: finalEmail,
        providedBrand: providedBrand,
        platform
      });
    } catch (err: any) {
      console.error('AI error:', err);
      return NextResponse.json({ error: 'AI generation failed', detail: err.message ?? String(err) }, { status: 500 });
    }

    // Deduct credits on success
    try {
      // Loop or single call? Autumn track takes 'count'.
      // If the SDK supports 'count', use it. If not, loop.
      // Based on files/jobs:
      // for(let i = 0; i < CREDITS_PER_FILE_GENERATION; i++){ await autumn.track({...}); }
      // It seems the SDK might not support count in 'track'?
      // Let's check autumn-js usage.
      // Usage in files/jobs implies loop.
      // I'll stick to the loop to be safe and consistent.
      for (let i = 0; i < CREDITS_PER_BLOG_GENERATION; i++) {
        await autumn.track({
          customer_id: userId,
          feature_id: FEATURE_ID_MESSAGES,
        });
      }
    } catch (err) {
      console.error('[write-blog] Failed to deduct credits:', err);
      // We still return success as the blog was generated.
    }

    // If it's a social platform, return immediately (frontend saves via save-social)
    if (platform && ['reddit', 'linkedin', 'twitter', 'x'].includes(platform.toLowerCase())) {
         return NextResponse.json({
            content: generatedText,
            topic,
            platform
         }, { status: 201 });
    }

    // Legacy blog flow: Save to DB
    const blogId = crypto.randomUUID();
    const blogObject = {
      id: blogId,
      content: generatedText,
      timestamp: new Date().toISOString(),
      topic: topic,
      isprompt: isprompt === true || isprompt === 'true'
    };

    // Find existing row for this user/company
    // We try to find a row that serves as the "container" (where we store suggestions too).
    // If topic-suggestion created one, it might have blog=NULL or blog=[].
    const selSQL = `SELECT id, blog FROM blogs WHERE user_id = $1 AND company_url = $2 ORDER BY created_at DESC LIMIT 1`;
    const resSel = await pool.query(selSQL, [userId, company_url]);

    let finalBlogArray: any[] = [];
    let rowId = null;

    if (resSel.rows.length > 0) {
       rowId = resSel.rows[0].id;
       let currentBlogData = resSel.rows[0].blog;
       
       // Parse existing data
       try {
          if (typeof currentBlogData === 'string') {
             // Check if it's a JSON array
             if (currentBlogData.trim().startsWith('[')) {
                finalBlogArray = JSON.parse(currentBlogData);
             } else if (currentBlogData.trim().startsWith('{')) {
                // Legacy: single object
                finalBlogArray = [JSON.parse(currentBlogData)];
             } else if (currentBlogData.trim()) {
                 // Legacy: raw string
                 finalBlogArray = [{
                    id: 'legacy-' + Date.now(),
                    content: currentBlogData,
                    timestamp: new Date().toISOString(), // approximate
                    topic: 'Legacy Blog'
                 }];
             }
          } else if (Array.isArray(currentBlogData)) {
             finalBlogArray = currentBlogData; // Postgres driver might parse JSONB automatically if type was JSONB, but it's TEXT
          }
       } catch (e) {
          // If parse fails but there is data, treat as raw string
          if (currentBlogData) {
             finalBlogArray = [{
                id: 'legacy-' + Date.now(),
                content: currentBlogData,
                timestamp: new Date().toISOString(),
                topic: 'Legacy Blog'
             }];
          }
       }
       
       if (!Array.isArray(finalBlogArray)) finalBlogArray = [];
       
       finalBlogArray.push(blogObject);
       
       // Update existing row
       const updateSQL = `UPDATE blogs SET blog = $1, created_at = now() WHERE id = $2`;
       await pool.query(updateSQL, [JSON.stringify(finalBlogArray), rowId]);
    } else {
       // Insert new row
       finalBlogArray = [blogObject];
       const insertSQL = `
          INSERT INTO blogs (user_id, company_url, email_id, brand_name, topic, blog)
          VALUES ($1, $2, $3, $4, NULL, $5)
          RETURNING id;
       `;
       // We set 'topic' (suggestions) to NULL or empty for now if it doesn't exist, 
       // or we could leave it alone if we are not generating suggestions here.
       // The 'topic' column in INSERT refers to the suggestions column. 
       // But wait, the previous code inserted `topic` (the input topic) into `topic` column.
       // If we are moving to "topic column = list of suggestions", we shouldn't overwrite it with the single blog topic.
       // The user said "topic - array of json".
       // So we should leave `topic` column as NULL (or empty array if we want) for the new row, 
       // assuming topic-suggestion will populate it later or it's separate.
       // However, to avoid breaking legacy expectation that row has a "main topic", we might need to be careful.
       // But since we are storing the blog's topic INSIDE the blog object, we don't need the column for that anymore.
       
       const values = [userId, company_url, finalEmail, finalBrand, JSON.stringify(finalBlogArray)];
       const resIns = await pool.query(insertSQL, values);
       rowId = resIns.rows[0].id;
    }

    return NextResponse.json({
      id: blogId, // Return the item ID, not the row ID
      created_at: blogObject.timestamp,
      blog: JSON.stringify(blogObject), // legacy format for frontend 'handleSubmit'
      content: generatedText, // for new frontend logic
      topic,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Unexpected error in API:', err);
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 });
  }
}
