/**
 * GET  /api/user-flood-marks — list หมุดที่ผู้ใช้ปักเอง (filter bbox/province)
 *      อ่านได้ทุกคน (สาธารณะ — เป็นข้อมูลระดับน้ำ ไม่ใช่ PII)
 * POST /api/user-flood-marks — officer/vhv+ ปักหมุดใหม่ → ขึ้นทันที ไม่ต้องอนุมัติ
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { deriveFloodMarkLevel, floodMarkProvinceAbbr, formatFloodMarkCode } from '@/lib/flood-marks'
import {
  badRequest,
  canWriteFieldData,
  forbidden,
  isoOrNow,
  numberFromDb,
  parseBbox,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { userFloodMarks, userFloodMarkCodeSeq } from '@/db/schema'
import type { UserFloodMark, UserRole } from '@/types'

export const dynamic = 'force-dynamic'

function serialize(row: typeof userFloodMarks.$inferSelect): UserFloodMark {
  return {
    id: row.id,
    code: row.code,
    lat: numberFromDb(row.lat) ?? 0,
    lng: numberFromDb(row.lng) ?? 0,
    waterLevelCm: numberFromDb(row.waterLevelCm) ?? 0,
    level: String(row.level) as UserFloodMark['level'],
    placeDetail: row.placeDetail,
    placeAround: row.placeAround,
    province: row.province,
    amphoe: row.amphoe,
    tambon: row.tambon,
    contactPhone: row.contactPhone,
    observedAt: row.observedAt?.toISOString() ?? null,
    imageUrl: row.imageUrl,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
}

// -----------------------------------------------------------------------
// GET
// -----------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bbox = parseBbox(searchParams.get('bbox'))
  const province = searchParams.get('province')
  const limit = Math.min(Number(searchParams.get('limit')) || 500, 2000)

  const db = getDb()

  const conditions = [isNull(userFloodMarks.deletedAt)]
  if (province) conditions.push(eq(userFloodMarks.province, province))

  const rows = await db
    .select()
    .from(userFloodMarks)
    .where(and(...conditions))
    .orderBy(desc(userFloodMarks.observedAt))
    .limit(limit)

  const data = rows
    .map(serialize)
    .filter((m) => {
      if (!bbox) return true
      return (
        m.lng >= bbox.minLng &&
        m.lng <= bbox.maxLng &&
        m.lat >= bbox.minLat &&
        m.lat <= bbox.maxLat
      )
    })

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// -----------------------------------------------------------------------
// POST
// -----------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const lat = body.lat !== undefined ? Number(body.lat) : NaN
  const lng = body.lng !== undefined ? Number(body.lng) : NaN
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return badRequest('lat is invalid')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return badRequest('lng is invalid')

  const waterLevelCm = body.waterLevelCm !== undefined ? Number(body.waterLevelCm) : NaN
  if (!Number.isFinite(waterLevelCm) || waterLevelCm < 0 || waterLevelCm > 2000) {
    return badRequest('waterLevelCm must be a number between 0 and 2000')
  }

  const level = deriveFloodMarkLevel(waterLevelCm)
  const province = typeof body.province === 'string' ? body.province.trim() || null : null
  const abbr = floodMarkProvinceAbbr(province)

  const db = getDb()
  const created = await db.transaction(async (tx) => {
    // จองรหัสจุดแบบ atomic: upsert เพิ่มตัวนับของ prefix จังหวัดแล้วอ่านค่าใหม่กลับมา
    let code: string | null = null
    if (abbr) {
      const [seq] = await tx
        .insert(userFloodMarkCodeSeq)
        .values({ prefix: abbr, lastNo: 1 })
        .onConflictDoUpdate({
          target: userFloodMarkCodeSeq.prefix,
          set: { lastNo: sql`${userFloodMarkCodeSeq.lastNo} + 1` },
        })
        .returning()
      code = formatFloodMarkCode(abbr, seq.lastNo)
    }

    const [row] = await tx
      .insert(userFloodMarks)
      .values({
        code,
        lat: String(lat),
        lng: String(lng),
        waterLevelCm: String(waterLevelCm),
        level,
        placeDetail: typeof body.placeDetail === 'string' ? body.placeDetail.trim() || null : null,
        placeAround: typeof body.placeAround === 'string' ? body.placeAround.trim() || null : null,
        province,
        amphoe: typeof body.amphoe === 'string' ? body.amphoe.trim() || null : null,
        tambon: typeof body.tambon === 'string' ? body.tambon.trim() || null : null,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
        // รับเฉพาะ path รูปที่อัปโหลดผ่าน /api/uploads เท่านั้น (กัน URL ภายนอก)
        imageUrl:
          typeof body.imageUrl === 'string' && body.imageUrl.startsWith('/api/uploads/')
            ? body.imageUrl
            : null,
        observedAt: isoOrNow(body.observedAt),
        createdBy: sessionUserId(session),
      })
      .returning()
    return row
  })

  return NextResponse.json({ data: serialize(created) }, { status: 201 })
}
