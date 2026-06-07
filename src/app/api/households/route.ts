/**
 * GET /api/households — รายชื่อครัวเรือนในพื้นที่ (สำหรับ picker ตอนเพิ่ม/แก้กลุ่มเปราะบาง)
 * scope ตามจังหวัดสังกัด (non-national) · กรองด้วย tambon/amphoe ได้
 * คืน id, บ้านเลขที่, หมู่, ชื่อหมู่บ้าน, พิกัด, จำนวนสมาชิก — ไม่มี PII รายบุคคล
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { households, householdMembers } from '@/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const national = isNationalRole(session.user.role)
  const sessionProvince = session.user.province ?? null
  const url = new URL(req.url)
  const province = national ? url.searchParams.get('province') : sessionProvince
  const tambon = url.searchParams.get('tambon')
  const amphoe = url.searchParams.get('amphoe')
  if (!national && !sessionProvince) return NextResponse.json({ data: [] })

  const conds = []
  if (province) conds.push(eq(households.province, province))
  if (tambon) conds.push(eq(households.tambon, tambon))
  if (amphoe) conds.push(eq(households.amphoe, amphoe))

  const db = getDb()
  const rows = await db
    .select({
      id: households.id,
      hno: households.hno,
      villno: households.villno,
      villageName: households.villageName,
      tambon: households.tambon,
      amphoe: households.amphoe,
      province: households.province,
      lat: households.lat,
      lng: households.lng,
    })
    .from(households)
    .where(conds.length ? and(...conds) : undefined)

  if (rows.length === 0) return NextResponse.json({ data: [] })

  const countRows = await db
    .select({ hid: householdMembers.householdId, n: sql<number>`count(*)::int` })
    .from(householdMembers)
    .where(
      and(
        inArray(
          householdMembers.householdId,
          rows.map((r) => r.id),
        ),
        isNull(householdMembers.deletedAt),
      ),
    )
    .groupBy(householdMembers.householdId)
  const countByHouse = new Map(countRows.map((c) => [c.hid, c.n]))

  const data = rows.map((r) => ({
    id: r.id,
    hno: r.hno,
    villno: r.villno,
    villageName: r.villageName,
    tambon: r.tambon,
    amphoe: r.amphoe,
    province: r.province,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    memberCount: countByHouse.get(r.id) ?? 0,
  }))

  return NextResponse.json({ data })
}
