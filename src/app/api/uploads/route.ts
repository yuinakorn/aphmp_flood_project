/**
 * POST /api/uploads — อัปโหลดรูป (officer/vhv+) เก็บลงไฟล์ใน UPLOAD_DIR (volume)
 * คืน { url: '/api/uploads/flood-marks/<file>' } ไว้เก็บใน image_url
 */
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { auth } from '@/lib/auth'
import { badRequest, canWriteFieldData, forbidden, unauthorized } from '@/lib/field-api'
import type { UserRole } from '@/types'

export const runtime = 'nodejs'

const UPLOAD_ROOT = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')
const MAX_BYTES = 5 * 1024 * 1024
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return badRequest('file is required')

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) return badRequest('รองรับเฉพาะรูป JPEG, PNG หรือ WebP')
  if (file.size > MAX_BYTES) return badRequest('ไฟล์ใหญ่เกิน 5MB')

  const dir = join(UPLOAD_ROOT, 'flood-marks')
  await mkdir(dir, { recursive: true })
  const fileName = `${randomUUID()}.${ext}`
  await writeFile(join(dir, fileName), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({ url: `/api/uploads/flood-marks/${fileName}` }, { status: 201 })
}
