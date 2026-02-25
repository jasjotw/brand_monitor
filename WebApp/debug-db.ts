
import { pool } from './lib/db';

async function checkBlog() {
  try {
    const userId = '0BFZZ4Pzg2AVdW7K2CgA9VVdDNNOOxqy';
    const companyUrl = 'https://www.welzin.ai';

    const sql = `SELECT id, blog, company_url, user_id FROM blogs WHERE user_id = $1 AND company_url = $2`;
    const res = await pool.query(sql, [userId, companyUrl]);

    console.log('Query result count:', res.rows.length);
    if (res.rows.length > 0) {
      console.log('Row found:', res.rows[0]);
      console.log('Blog column type:', typeof res.rows[0].blog);
      console.log('Blog column content:', res.rows[0].blog);
    } else {
      console.log('No row found for this user/url combination.');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

checkBlog();
