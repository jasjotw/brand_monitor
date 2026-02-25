import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getProviderModel } from '@/lib/provider-config';
import { generateText } from 'ai';

async function ensureTable() {
  // Ensure the 'blogs' table exists with the schema provided by the user
  const createSQL = `
    CREATE TABLE IF NOT EXISTS blogs (
      id SERIAL PRIMARY KEY,
      company_url TEXT NOT NULL,
      email_id TEXT,
      brand_name TEXT,
      blog TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      topic TEXT,
      status VARCHAR DEFAULT 'PENDING',
      twitter_post TEXT,
      linkedin_post TEXT,
      reddit_post TEXT,
      user_id TEXT
    );
  `;
  await pool.query(createSQL);
  
  // Alter existing table to match requirements if needed
  try {
    await pool.query('ALTER TABLE blogs ALTER COLUMN blog DROP NOT NULL');
  } catch (e) {}
  
  await pool.query('ALTER TABLE blogs ADD COLUMN IF NOT EXISTS topic TEXT');
  await pool.query('ALTER TABLE blogs ADD COLUMN IF NOT EXISTS user_id TEXT');
  await pool.query('ALTER TABLE blogs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT \'PENDING\'');
}

export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ ok: true });
    await ensureTable();
    const session = await auth.api.getSession({ headers: request.headers as any });
    const userId = session?.user?.id || null;
    const body = await request.json();
    const companyUrl = (body?.company_url || '').toString().trim();
    const topicContent = (body?.topic || '').toString().trim();

    if (!companyUrl || !topicContent) return NextResponse.json({ error: 'Missing company_url or topic' }, { status: 400 });

    // Find the suggestion row using user_id if available, fallback to email if needed (but user_id is preferred per schema)
    // We strictly use user_id if we have it, as specifically requested.
    let sel = 'SELECT id, topic FROM blogs WHERE user_id = $1 AND company_url = $2 AND blog IS NULL';
    let params: any[] = [userId, companyUrl];
    
    if (!userId) {
       // Fallback logic if no session ID (unlikely for authenticated app)
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resSel = await pool.query(sel, params);
    
    if (resSel.rows.length === 0) return NextResponse.json({ ok: true });

    let currentTopics: any[] = [];
    try {
      const raw = resSel.rows[0].topic;
      currentTopics = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(currentTopics)) currentTopics = [];
    } catch {
      currentTopics = [];
    }

    const filtered = currentTopics.filter((t: any) => {
      const c = typeof t === 'string' ? t : t?.content;
      return c !== topicContent;
    });

    const upd = 'UPDATE blogs SET topic = $1 WHERE id = $2';
    await pool.query(upd, [JSON.stringify(filtered), resSel.rows[0].id]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('topic-suggestion delete error', e);
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const session = await auth.api.getSession({ headers: request.headers as any });
    const userEmail = session?.user?.email || null;
    const userId = session?.user?.id || null;
    
    const body = await request.json();
    
    const brandName = (body?.brand_name || '').toString().trim();
    const companyUrl = (body?.company_url || '').toString().trim();
    const industry = (body?.industry || '').toString().trim();
    const description = (body?.description || '').toString().trim();
    const keywords = Array.isArray(body?.keywords)
      ? body.keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : typeof body?.keywords === 'string'
        ? body.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : [];
    // Use user_id from body if provided, but validate/prefer session?
    // Prompt: "send the user id ... from frontend and check ...".
    // We will trust session ID for security, but ensure we have it.
    
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!brandName) return NextResponse.json({ error: 'Missing brand_name' }, { status: 400 });
    if (!companyUrl) return NextResponse.json({ error: 'Missing company_url' }, { status: 400 });

    await ensureTable();

    const model = getProviderModel('google');
    if (!model) return NextResponse.json({ error: 'Gemini model not configured' }, { status: 500 });

    const system = 'You are an SEO strategist. Propose concise, high-CTR, search-intent aligned blog topics to improve SEO/AEO rankings.';
    const contextLines = [
      `Brand: ${brandName}`,
      industry ? `Industry: ${industry}` : '',
      description ? `Description: ${description}` : '',
      keywords.length ? `Keywords: ${keywords.join(', ')}` : ''
    ].filter(Boolean).join('\n');
    const prompt = `${contextLines}\nGenerate 8-12 SEO-rich, user-intent focused topics with variations (how-to, listicle, comparison, vs, best-of, mistakes, guides). Return ONLY a raw JSON array of strings. No markdown formatting, no code blocks, no introductory text.`;

    const { text } = await generateText({ model, system, prompt, temperature: 0.3, maxTokens: 800 });

    console.log('Raw AI response for topics:', text);

    let topics: string[] = [];
    try {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText || '[]');
      if (Array.isArray(parsed)) {
        topics = parsed.filter((t) => typeof t === 'string').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      try {
        const match = text.match(/\[.*\]/s);
        if (match) {
             const parsed = JSON.parse(match[0]);
             if (Array.isArray(parsed)) {
                topics = parsed.filter((t: any) => typeof t === 'string').map((s: any) => s.trim()).filter(Boolean);
             }
        }
      } catch (e2) {}

      if (topics.length === 0) {
         topics = (text || '').split(/\r?\n/).map((s) => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean).slice(0, 12);
      }
    }

    if (topics.length === 0) return NextResponse.json({ error: 'No topics generated' }, { status: 500 });

    const timestamp = new Date().toISOString();
    const newTopicObjects = topics.map(t => ({
      content: t,
      timestamp: timestamp
    }));

    // Check for existing suggestion row using user_id and company_url
    const sel = 'SELECT id, topic FROM blogs WHERE user_id = $1 AND company_url = $2 AND blog IS NULL';
    const existing = await pool.query(sel, [userId, companyUrl]);
    
    let finalTopics = newTopicObjects;

    if (existing.rows.length > 0) {
      // Update existing
      const row = existing.rows[0];
      let currentTopics: any[] = [];
      try {
        currentTopics = row.topic ? JSON.parse(row.topic) : [];
        if (!Array.isArray(currentTopics)) currentTopics = [];
      } catch {
        currentTopics = [];
      }
      
      const set = new Set(currentTopics.map((t: any) => typeof t === 'string' ? t : t.content));
      
      const normalizedCurrent = currentTopics.map((t: any) => {
         if (typeof t === 'string') return { content: t, timestamp: new Date().toISOString() };
         return t;
      });

      newTopicObjects.forEach(nt => {
        if (!set.has(nt.content)) {
          normalizedCurrent.push(nt);
          set.add(nt.content);
        }
      });
      
      finalTopics = normalizedCurrent;

      const upd = 'UPDATE blogs SET topic = $1, created_at = now() WHERE id = $2';
      await pool.query(upd, [JSON.stringify(finalTopics), row.id]);
    } else {
      // Insert new with user_id
      const ins = `
        INSERT INTO blogs (user_id, email_id, company_url, brand_name, topic, blog)
        VALUES ($1, $2, $3, $4, $5, NULL)
        RETURNING id
      `;
      // We store email_id as well for completeness if the schema has it
      await pool.query(ins, [userId, userEmail, companyUrl, brandName, JSON.stringify(finalTopics)]);
    }

    const returnedStrings = finalTopics.map((t: any) => t.content);
    return NextResponse.json({ topics: returnedStrings });
  } catch (e) {
    console.error('topic-suggestion error', e);
    return NextResponse.json({ error: 'Failed to generate topics' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ topics: [] });
    }
    await ensureTable();

    const session = await auth.api.getSession({ headers: request.headers as any });
    const userId = session?.user?.id || null;
    const { searchParams } = new URL(request.url);
    const companyUrl = (searchParams.get('company_url') || '').toString().trim();
    
    let sql = '';
    let params: any[] = [];
    
    if (userId && companyUrl) {
      sql = 'SELECT topic FROM blogs WHERE user_id = $1 AND company_url = $2 AND blog IS NULL ORDER BY created_at DESC LIMIT 1';
      params = [userId, companyUrl];
    } else {
       // Fallback or legacy handling (maybe fallback to brand_name if strict user_id check fails? or empty?)
       // If strict matching requested, return empty if no match.
       // However, we can support the brand_name fallback if frontend sends it.
       const brand = (searchParams.get('brand_name') || '').toString().trim();
       if (!brand || !userId) return NextResponse.json({ topics: [] });
       
       sql = 'SELECT topic FROM blogs WHERE user_id = $1 AND brand_name = $2 AND blog IS NULL ORDER BY created_at DESC LIMIT 1';
       params = [userId, brand];
    }

    const res = await pool.query(sql, params);
    const rawTopic = res.rows[0]?.topic;
    
    let topics: string[] = [];
    if (rawTopic) {
      try {
        const parsed = JSON.parse(rawTopic);
        if (Array.isArray(parsed)) {
          topics = parsed.map((t: any) => typeof t === 'string' ? t : t.content);
        }
      } catch {
         topics = [rawTopic];
      }
    }
    
    return NextResponse.json({ topics });
  } catch (e) {
    console.error('topic-suggestion list error', e);
    return NextResponse.json({ topics: [] });
  }
}
