import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let userEmail: string | null = null;
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: request.headers as any });
      userEmail = session?.user?.email || null;
      userId = session?.user?.id || null;
    } catch {}

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }
    if (!userEmail && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if ID is integer (Legacy Row ID)
    const isInteger = /^\d+$/.test(id);

    if (isInteger) {
      const sql = `SELECT id, company_url, brand_name, email_id, topic, blog, created_at FROM blogs WHERE id = $1 AND (user_id = $2 OR email_id = $3)`;
      const res = await pool.query(sql, [id, userId, userEmail]);
      if (res.rows.length > 0) {
        return NextResponse.json(res.rows[0]);
      }
    }

    // If not found as row ID, or if it's a UUID, search inside blog arrays for this user
    // This is less efficient but necessary given the structure.
    // Ideally we filter by company_url if available, but we might not have it here.
    const searchSql = `SELECT id, blog, company_url, brand_name, topic FROM blogs WHERE user_id = $1 OR email_id = $2`;
    const searchRes = await pool.query(searchSql, [userId, userEmail]);

    for (const row of searchRes.rows) {
      let items: any[] = [];
      try {
         const raw = row.blog;
         if (typeof raw === 'string') {
            if (raw.trim().startsWith('[')) items = JSON.parse(raw);
            else if (raw.trim().startsWith('{')) items = [JSON.parse(raw)];
         } else if (Array.isArray(raw)) {
            items = raw;
         }
      } catch {}

      const foundItem = items.find((item: any) => item.id === id);
      if (foundItem) {
         // Construct response matching legacy row structure for compatibility
         return NextResponse.json({
            id: foundItem.id,
            company_url: row.company_url,
            brand_name: row.brand_name,
            email_id: userEmail,
            topic: foundItem.topic || row.topic, // use item topic or row topic
            blog: JSON.stringify(foundItem), // Return the item as the "blog" content (JSON string) or raw content? 
            // The frontend expects the 'blog' field to contain the content (or JSON with content).
            // Our list endpoint returns the whole item as the blog. 
            // Let's return the whole item as JSON string in 'blog', and also 'content' top level.
            content: foundItem.content,
            created_at: foundItem.timestamp
         });
      }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    console.error('write-blog/view error', e);
    return NextResponse.json({ error: 'Failed to load blog' }, { status: 500 });
  }
}
