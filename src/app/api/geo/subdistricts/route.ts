/** GET /api/geo/subdistricts?districtId=<id> — รายชื่อตำบลในอำเภอ + รหัสไปรษณีย์ */
import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { geoSubdistricts } from '@/db/schema'

export async function GET(req: NextRequest) {
  const districtId = Number(new URL(req.url).searchParams.get('districtId'))
  if (!Number.isInteger(districtId) || districtId <= 0) {
    return NextResponse.json({ error: 'districtId is required' }, { status: 400 })
  }

  const db = getDb()
  const rows = await db
    .select({
      id: geoSubdistricts.id,
      nameTh: geoSubdistricts.nameTh,
      zipCode: geoSubdistricts.zipCode,
    })
    .from(geoSubdistricts)
    .where(eq(geoSubdistricts.districtId, districtId))
    .orderBy(asc(geoSubdistricts.nameTh))

  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  })
}
