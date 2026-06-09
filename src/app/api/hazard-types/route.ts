/**
 * GET  /api/hazard-types — รายการชนิดภัย (ทุก role ที่ login) · ?active=1 = เฉพาะที่เปิดใช้งาน
 * POST /api/hazard-types — เพิ่มชนิดภัยใหม่ (ผู้ดูแลระบบ — canManageStaff)
 */
import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canManageStaff, forbidden, sessionUserId, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'
import { hazardTypes } from '@/db/schema'
import { isZoneCategory, type HazardTypeDef } from '@/lib/risk-zone'

export const dynamic = 'force-dynamic'

function serialize(row: typeof hazardTypes.$inferSelect): HazardTypeDef {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    category: isZoneCategory(row.category) ? row.category : 'temporary',
    color: row.color,
    emoji: row.emoji,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isSystem: row.isSystem,
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const activeOnly = new URL(req.url).searchParams.get('active') === '1'
  const db = getDb()
  const rows = await db
    .select()
    .from(hazardTypes)
    .orderBy(asc(hazardTypes.sortOrder), asc(hazardTypes.label))

  const data = rows.map(serialize).filter((h) => (activeOnly ? h.isActive : true))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label) return badRequest('ต้องระบุชื่อชนิดภัย')

  // code: รับจาก body (slugify) หรือ derive จาก label; ถ้าได้ว่าง (เช่น label เป็นภาษาไทย) ใช้ hz_<random>
  const rawCode = typeof body.code === 'string' && body.code.trim() ? body.code : label
  const code = slugify(rawCode) || `hz_${Math.random().toString(36).slice(2, 8)}`

  const category = isZoneCategory(body.category) ? body.category : 'temporary'
  const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : undefined
  const emoji = typeof body.emoji === 'string' && body.emoji.trim() ? body.emoji.trim() : undefined
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 50

  const db = getDb()
  const [dup] = await db.select({ id: hazardTypes.id }).from(hazardTypes).where(eq(hazardTypes.code, code)).limit(1)
  if (dup) return badRequest(`code "${code}" ถูกใช้แล้ว`)

  const [created] = await db
    .insert(hazardTypes)
    .values({ code, label, category, color, emoji, sortOrder, isSystem: false, createdBy: sessionUserId(session) })
    .returning()

  void audit(req, session, {
    action: 'create_hazard_type',
    entity: 'hazard_type',
    targetId: created.id,
    metadata: { code, label, category },
  })

  return NextResponse.json({ data: serialize(created) }, { status: 201 })
}
