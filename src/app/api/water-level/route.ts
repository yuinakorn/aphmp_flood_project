import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type WaterLevelPoint = {
  observedAt: string
  date: string
  time: string
  p67: number | null
  p67Discharge: number | null
  p1: number | null
  p1Discharge: number | null
}

export async function GET(req: NextRequest) {
  const hoursParam = req.nextUrl.searchParams.get('hours')
  const hours = Math.max(6, Math.min(7 * 24, Number(hoursParam) || 72))

  const db = getDb()
  const rows = await db.execute(sql`
    SELECT
      observed_at,
      to_char(observed_date, 'YYYY-MM-DD')    AS date,
      to_char(observed_time, 'HH24:MI')       AS time,
      level_station1::float                   AS p67,
      discharge_station1::float               AS p67_discharge,
      level_station2::float                   AS p1,
      discharge_station2::float               AS p1_discharge
    FROM water_level_observation
    WHERE station_id1 = 'P.67' AND station_id2 = 'P.1'
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
      p67: r.p67 == null ? null : Number(r.p67),
      p67Discharge: r.p67_discharge == null ? null : Number(r.p67_discharge),
      p1: r.p1 == null ? null : Number(r.p1),
      p1Discharge: r.p1_discharge == null ? null : Number(r.p1_discharge),
    }))
    .reverse()

  return NextResponse.json({ hours, count: data.length, data })
}
