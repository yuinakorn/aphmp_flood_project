import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { PROVINCE_CONFIGS, type ProvinceId } from '@/lib/water-level'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type WaterLevelPoint = {
  observedAt: string
  date: string
  time: string
  s1: number | null
  s1Discharge: number | null
  s2: number | null
  s2Discharge: number | null
}

export async function GET(req: NextRequest) {
  const hoursParam = req.nextUrl.searchParams.get('hours')
  const hours = Math.max(6, Math.min(7 * 24, Number(hoursParam) || 72))

  const provinceParam = (req.nextUrl.searchParams.get('province') ?? 'chiangmai') as ProvinceId
  const config = PROVINCE_CONFIGS[provinceParam] ?? PROVINCE_CONFIGS.chiangmai

  const db = getDb()
  const rows = await db.execute(sql`
    SELECT
      observed_at,
      to_char(observed_date, 'YYYY-MM-DD')    AS date,
      to_char(observed_time, 'HH24:MI')       AS time,
      level_station1::float                   AS s1,
      discharge_station1::float               AS s1_discharge,
      level_station2::float                   AS s2,
      discharge_station2::float               AS s2_discharge
    FROM water_level_observation
    WHERE station_id1 = ${config.s1} AND station_id2 = ${config.s2}
    ORDER BY observed_at DESC
    LIMIT ${hours}
  `)

  const data: WaterLevelPoint[] = (rows as unknown as Array<Record<string, unknown>>)
    .map((r) => ({
      observedAt: (r.observed_at instanceof Date
        ? r.observed_at.toISOString()
        : String(r.observed_at)),
      date: r.date as string,
      time: r.time as string,
      s1: r.s1 == null ? null : Number(r.s1),
      s1Discharge: r.s1_discharge == null ? null : Number(r.s1_discharge),
      s2: r.s2 == null ? null : Number(r.s2),
      s2Discharge: r.s2_discharge == null ? null : Number(r.s2_discharge),
    }))
    .reverse()

  return NextResponse.json({ hours, province: provinceParam, count: data.length, data })
}
