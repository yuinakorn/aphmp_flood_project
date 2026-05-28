/** GET /api/geo/districts?provinceId=<id> — รายชื่ออำเภอในจังหวัด */
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { geoDistricts } from '@/db/schema'

export async function GET(req: NextRequest) {
  const provinceId = Number(new URL(req.url).searchParams.get('provinceId'))
  if (!Number.isInteger(provinceId) || provinceId <= 0) {
    return NextResponse.json({ error: 'provinceId is required' }, { status: 400 })
  }

  const db = getDb()
  const rows = await db
    .select({ id: geoDistricts.id, nameTh: geoDistricts.nameTh })
    .from(geoDistricts)
    .where(and(eq(geoDistricts.provinceId, provinceId)))
    .orderBy(asc(geoDistricts.nameTh))

  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  })
}
