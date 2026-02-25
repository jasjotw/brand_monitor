import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const session = await auth.api.getSession({ headers: request.headers as any });
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const companyUrl = searchParams.get('company_url'); // Need context
    
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // 1. Try to find if 'id' matches a row ID (Legacy)
    // We check this first to maintain legacy compatibility
    const checkRow = await pool.query(`SELECT id FROM blogs WHERE id = $1 AND (user_id = $2 OR email_id = $3)`, [id, userId, userEmail]);
    if (checkRow.rows.length > 0) {
       // It's a row ID. Delete the row? Or clear blog?
       // Previous behavior was delete row.
       await pool.query(`DELETE FROM blogs WHERE id = $1`, [id]);
       return NextResponse.json({ ok: true });
    }

    // 2. It's likely an item ID inside the array. We need company_url to find the container.
    if (!companyUrl) {
       // Without company_url, searching is hard. 
       // We could search: SELECT id, blog FROM blogs WHERE user_id=$1 AND blog LIKE '%"id":"' || $2 || '"%';
       // This is hacky but works for JSON text.
       const searchSql = `SELECT id, blog FROM blogs WHERE (user_id = $1 OR email_id = $2) AND blog::text LIKE $3 LIMIT 1`;
       const searchRes = await pool.query(searchSql, [userId, userEmail, `%${id}%`]);
       
       if (searchRes.rows.length > 0) {
          const row = searchRes.rows[0];
          await updateRowToRemoveItem(row.id, row.blog, id);
          return NextResponse.json({ ok: true });
       }
       return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 3. With company_url, we can target the row directly
    const rowSql = `SELECT id, blog FROM blogs WHERE user_id = $1 AND company_url = $2 LIMIT 1`;
    const res = await pool.query(rowSql, [userId, companyUrl]);
    
    if (res.rows.length > 0) {
       await updateRowToRemoveItem(res.rows[0].id, res.rows[0].blog, id);
       return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  } catch (e) {
    console.error('write-blog/delete error', e);
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 });
  }
}

async function updateRowToRemoveItem(rowId: any, blogData: any, itemId: string) {
    let items: any[] = [];
    try {
       if (typeof blogData === 'string') {
          if (blogData.trim().startsWith('[')) items = JSON.parse(blogData);
          else if (blogData.trim().startsWith('{')) items = [JSON.parse(blogData)];
       } else if (Array.isArray(blogData)) {
          items = blogData;
       }
    } catch {}

    const filtered = items.filter((item: any) => {
       // Match by ID. If item has no ID (legacy content), we can't delete by ID easily unless we passed index or used unique content.
       // Assuming items have IDs now.
       return item.id !== itemId;
    });

    if (filtered.length !== items.length) {
       const upd = `UPDATE blogs SET blog = $1, created_at = now() WHERE id = $2`;
       await pool.query(upd, [JSON.stringify(filtered), rowId]);
    }
}
