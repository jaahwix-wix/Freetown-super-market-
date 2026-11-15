import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    if (!filename || !/^[a-zA-Z0-9_.\-]+$/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const contentType = MIME_MAP[ext];
    if (!contentType) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
    const data = await readFile(filePath);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }
}
