import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { PROVINCE_CONFIGS, classifyAlert } from '@/lib/water-level'
import { loadStationThresholds } from '@/lib/station-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getDb()

  const allCodes = Object.values(PROVINCE_CONFIGS).flatMap((c) => [c.s1, c.s2])
  const thresholds = await loadStationThresholds(allCodes)

  const result: Record<string, unknown> = {}

  for (const [provinceId, config] of Object.entries(PROVINCE_CONFIGS)) {
    const rows = await db.execute(sql`
      SELECT
        observed_at,
        level_station1::float     AS s1,
        discharge_station1::float AS s1_discharge,
        level_station2::float     AS s2,
        discharge_station2::float AS s2_discharge
      FROM water_level_observation
      WHERE station_id1 = ${config.s1} AND station_id2 = ${config.s2}
      ORDER BY observed_at DESC
      LIMIT 1
    `)

    const row = (rows as unknown as Record<string, unknown>[])[0]
    const t1 = thresholds[config.s1]
    const t2 = thresholds[config.s2]

    const s1Level = row?.s1 != null ? Number(row.s1) : null
    const s2Level = row?.s2 != null ? Number(row.s2) : null

    result[provinceId] = {
      label: config.label,
      river: config.river,
      updatedAt:
        row?.observed_at instanceof Date
          ? row.observed_at.toISOString()
          : row?.observed_at
            ? String(row.observed_at)
            : null,
      s1: {
        code: config.s1,
        level: s1Level,
        discharge: row?.s1_discharge != null ? Number(row.s1_discharge) : null,
        pct: t1 && s1Level != null ? Math.max(0, (s1Level / t1.danger) * 100) : 0,
        alert: t1 ? classifyAlert(s1Level, null, t1) : 'normal',
        thresholds: t1 ?? null,
      },
      s2: {
        code: config.s2,
        level: s2Level,
        discharge: row?.s2_discharge != null ? Number(row.s2_discharge) : null,
        pct: t2 && s2Level != null ? Math.max(0, (s2Level / t2.danger) * 100) : 0,
        alert: t2 ? classifyAlert(s2Level, null, t2) : 'normal',
        thresholds: t2 ?? null,
      },
    }
  }

  return NextResponse.json(result)
}
