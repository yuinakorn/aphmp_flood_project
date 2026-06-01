/** GET /api/geo/provinces — รายชื่อจังหวัดในขอบเขตโปรเจกต์ (8 จังหวัดภาคเหนือ) */
import { NextResponse } from 'next/server'
import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { geoProvinces } from '@/db/schema'
import { ALLOWED_PROVINCES } from '@/lib/provinces'

export async function GET() {
  const db = getDb()
  const rows = await db
    .select({ id: geoProvinces.id, nameTh: geoProvinces.nameTh })
    .from(geoProvinces)
    .where(inArray(geoProvinces.nameTh, ALLOWED_PROVINCES as unknown as string[]))
    .orderBy(asc(geoProvinces.nameTh))

  // allowlist อาจเปลี่ยนตามขอบเขตโปรเจกต์ — ไม่ cache เพื่อให้การแก้รายการมีผลทันที
  return NextResponse.json(rows, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
