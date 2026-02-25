import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const session = await auth.api.getSession({ headers: request.headers as any });
    const userId = session?.user?.id; // Securely get user ID from session
    
    // We can also accept user_id from body if we want to be flexible, but session is safer.
    // However, the frontend sends user_id. We'll use session if available, else body (if we trust it/superuser).
    // For consistency with write-blog, we prefer session.

    const body = await request.json();
    const { company_url, content, topic, platform, isprompt } = body;

    if (!userId || !company_url || !content || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine target column
    let column = '';
    if (platform === 'reddit') column = 'reddit_post';
    else if (platform === 'twitter') column = 'twitter_post';
    else if (platform === 'linkedin') column = 'linkedin_post';
    else return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });

    const newItem = {
      id: crypto.randomUUID(),
      content,
      topic, // Save the topic explicitly!
      timestamp: new Date().toISOString(),
      isprompt: isprompt === true || isprompt === 'true'
    };

    // Find existing row
    const selSql = `SELECT id, ${column} as current_data FROM blogs WHERE user_id = $1 AND company_url = $2 LIMIT 1`;
    const resSel = await pool.query(selSql, [userId, company_url]);

    if (resSel.rows.length > 0) {
       const rowId = resSel.rows[0].id;
       let currentData = resSel.rows[0].current_data;
       let items: any[] = [];
       
       try {
          if (typeof currentData === 'string') {
             if (currentData.trim().startsWith('[')) items = JSON.parse(currentData);
             else if (currentData.trim().startsWith('{')) items = [JSON.parse(currentData)];
             else if (currentData.trim()) items = [{ id: 'legacy', content: currentData, timestamp: new Date().toISOString(), topic: 'Legacy Post' }];
          } else if (Array.isArray(currentData)) {
             items = currentData;
          }
       } catch {}

       if (!Array.isArray(items)) items = [];
       items.push(newItem);

       const updSql = `UPDATE blogs SET ${column} = $1, created_at = now() WHERE id = $2`;
       await pool.query(updSql, [JSON.stringify(items), rowId]);
    } else {
       // Create new row (this might happen if social is generated before any blog/suggestion)
       // We need to insert into the specific column and others as NULL.
       // We need email_id and brand_name ideally, but we might not have them if not sent.
       // We'll rely on the frontend sending them or just insert what we have.
       // The 'blogs' table has NOT NULL on company_url.
       
       // Note: To properly insert a new row, we ideally want brand_name too. 
       // If the row doesn't exist, we'll try to insert.
       
       const items = [newItem];
       const insSql = `INSERT INTO blogs (user_id, company_url, ${column}) VALUES ($1, $2, $3) RETURNING id`;
       await pool.query(insSql, [userId, company_url, JSON.stringify(items)]);
    }

    return NextResponse.json({ ok: true, item: newItem });
  } catch (e) {
    console.error('save-social error', e);
    return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
  }
}
