import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canManageIncident,
  forbidden,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { INCIDENT_STATUSES, INCIDENT_TYPES } from '@/lib/incident'
import { incidents } from '@/db/schema'

// GET /api/incidents?status=active — list เหตุการณ์ (scope ตามจังหวัดสังกัด)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const status = new URL(req.url).searchParams.get('status')
  if (status && !INCIDENT_STATUSES.has(status)) return badRequest('Invalid status')

  const national = isNationalRole(session.user.role)
  const province = session.user.province ?? null
  // non-national ที่ไม่มีจังหวัดสังกัด → ไม่เห็นเหตุการณ์ใดเลย
  if (!national && !province) return NextResponse.json({ data: [] })

  const conds = []
  if (status) conds.push(eq(incidents.status, status))
  if (!national) conds.push(eq(incidents.province, province!))

  const db = getDb()
  const rows = await db
    .select()
    .from(incidents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(incidents.startedAt))

  return NextResponse.json({ data: rows })
}

// POST /api/incidents — เปิดเหตุการณ์วิกฤต (ผู้บัญชาการ: admin/eoc/ddpm)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageIncident(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const type = typeof body.type === 'string' ? body.type : 'flood'
  if (!INCIDENT_TYPES.has(type)) return badRequest('Invalid type')

  const status = typeof body.status === 'string' ? body.status : 'active'
  if (!INCIDENT_STATUSES.has(status)) return badRequest('Invalid status')

  // จังหวัด: non-national ล็อกเป็นจังหวัดสังกัดเสมอ (ไม่เชื่อ body) · national ระบุได้เอง
  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' && body.province ? body.province : null)
    : (session.user.province ?? null)
  if (!national && !province) return badRequest('ไม่พบจังหวัดสังกัดของผู้ใช้ — ติดต่อผู้ดูแลระบบ')

  const db = getDb()
  const [created] = await db
    .insert(incidents)
    .values({
      name,
      type,
      status,
      province,
      amphoe: typeof body.amphoe === 'string' ? body.amphoe : null,
      tambon: typeof body.tambon === 'string' ? body.tambon : null,
      description: typeof body.description === 'string' ? body.description : null,
      createdBy: sessionUserId(session),
    })
    .returning()

  return NextResponse.json({ data: created }, { status: 201 })
}
