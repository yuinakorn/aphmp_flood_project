/** GET /api/uploads/<...path> — เสิร์ฟไฟล์รูปจาก UPLOAD_DIR (กัน path traversal) */
import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'

export const runtime = 'nodejs'

const UPLOAD_ROOT = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')
const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const rel = normalize(path.join('/'))
  const full = join(UPLOAD_ROOT, rel)
  // กัน path traversal — ต้องอยู่ภายใต้ UPLOAD_ROOT เท่านั้น
  if (!full.startsWith(UPLOAD_ROOT + sep)) {
    return new NextResponse('Bad path', { status: 400 })
  }

  try {
    const buf = await readFile(full)
    const ext = rel.split('.').pop()?.toLowerCase() ?? ''
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': CONTENT_TYPE[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
