/**
 * GET /api/infra?types=hospital,clinic,shelter,assembly
 * รายชื่อสถานพยาบาล + ศูนย์พักพิง จาก DB (ไม่ใช่ static JSON)
 * scope จังหวัดสังกัดอัตโนมัติ (non-national) · public map ใช้ province query param
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { infrastructures } from '@/db/schema'
import { isNationalRole } from '@/lib/incident-scope'

const VALID_TYPES = new Set(['hospital', 'clinic', 'shelter', 'assembly', 'temporary_health_post'])
const DEFAULT_TYPES = ['hospital', 'clinic', 'shelter', 'assembly']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const typesParam = searchParams.get('types')
  const types = typesParam
    ? typesParam.split(',').filter((t) => VALID_TYPES.has(t))
    : DEFAULT_TYPES
  if (types.length === 0) return NextResponse.json({ data: [] })

  const session = await auth()
  const national = isNationalRole(session?.user?.role)
  const sessionProvince = session?.user?.province ?? null

  // province scope: non-national → จังหวัดสังกัด; national → query param; no session → query param (public map)
  const queryProvince = searchParams.get('province')
  const scopedProvince = session?.user && !national ? sessionProvince : queryProvince

  if (session?.user && !national && !sessionProvince) return NextResponse.json({ data: [] })

  const db = getDb()
  const where = scopedProvince
    ? and(inArray(infrastructures.type, types), eq(infrastructures.province, scopedProvince))
    : inArray(infrastructures.type, types)

  const rows = await db
    .select({
      id: infrastructures.id,
      name: infrastructures.name,
      type: infrastructures.type,
      lat: infrastructures.lat,
      lng: infrastructures.lng,
      capacity: infrastructures.capacity,
      occupancy: infrastructures.occupancy,
      province: infrastructures.province,
      amphoe: infrastructures.amphoe,
      tambon: infrastructures.tambon,
      oxygenSupport: infrastructures.oxygenSupport,
      wheelchairSupport: infrastructures.wheelchairSupport,
      electricitySupport: infrastructures.electricitySupport,
      readinessStatus: infrastructures.readinessStatus,
      contact: infrastructures.contact,
    })
    .from(infrastructures)
    .where(where)

  return NextResponse.json({ data: rows })
}
