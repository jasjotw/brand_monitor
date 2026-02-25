import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { files } from '@/lib/db/schema.files';
import { and, eq } from 'drizzle-orm';
import JSZip from 'jszip';

const PAGE_BREAK = '---PAGE_BREAK---';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const superuserEmails = (process.env.SUPERUSER_EMAILS || '').split(',').map(e => e.trim());
    const isSuperuser = session.user.email && superuserEmails.includes(session.user.email);

    const [file] = await db
      .select()
      .from(files)
      .where(
        isSuperuser
          ? eq(files.id, id)
          : and(eq(files.id, id), eq(files.userId, session.user.id))
      )
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const schemaContent = (file as any).site_schema ?? (file as any).site_schema1;
    if (!schemaContent) {
      return NextResponse.json({ error: 'No schema content available' }, { status: 404 });
    }

    const chunks = schemaContent
      .split(PAGE_BREAK)
      .map(chunk => chunk.trim())
      .filter(Boolean);

    if (!chunks.length) {
      return NextResponse.json({ error: 'No schema sections found' }, { status: 400 });
    }

    const zip = new JSZip();

    chunks.forEach((chunk, index) => {
      const filename = `schema-${index + 1}.json`;
      zip.file(filename, chunk);
    });

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    const response = new NextResponse(zipContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="schema.zip"',
      }
    });

    return response;
  } catch (error) {
    console.error('Error generating schema zip:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
