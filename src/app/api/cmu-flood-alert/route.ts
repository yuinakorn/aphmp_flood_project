import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import pool from '@/lib/jhcis-db'
import { getFloodZones } from '@/lib/kml-parser'
import { classifyFloodLevel } from '@/lib/geo'
import { classifyAlert } from '@/lib/water-level'
import type { AlertLevel } from '@/lib/water-level'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Summary counts of patients per CMU flood zone */
export interface FloodAlertCounts {
  level1: number
  level2: number
  level3: number
  level4: number
  level5: number
  /** patients with valid coordinates that fall outside all 5 zones */
  outside: number
}

export interface FloodAlertResponse {
  /** Latest P.1 water level reading (metres), null if unavailable */
  waterLevel: number | null
  /** CMU zone that is currently active based on water level (1–5), null if below L1 threshold */
  activeZone: 1 | 2 | 3 | 4 | 5 | null
  alertLevel: AlertLevel
  /** Patients grouped by the innermost flood zone they sit in */
  counts: FloodAlertCounts
  /** Patients who are inside the currently active zone (i.e. already flooded) */
  affectedTotal: number
  updatedAt: string
}

const CMU_THRESHOLDS = {
  warning: 2.80,
  prepare: 3.50,
  critical: 4.00,
  danger: 5.00,
  rapidRise: 0.30,
} as const

/** Zone thresholds — P.1 level at which each zone activates */
const ZONE_THRESHOLDS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 4.30,
  2: 4.50,
  3: 4.70,
  4: 5.00,
  5: 5.30,
}

function deriveActiveZone(level: number | null): 1 | 2 | 3 | 4 | 5 | null {
  if (level == null) return null
  for (const z of [5, 4, 3, 2, 1] as const) {
    if (level >= ZONE_THRESHOLDS[z]) return z
  }
  return null
}

export async function GET() {
  const zones = getFloodZones()

  // --- current water level for P.1 (Chiang Mai) ---
  let waterLevel: number | null = null
  let alertLevel: AlertLevel = 'normal'
  try {
    const db = getDb()
    const rows = await db.execute(sql`
      SELECT level_station2::float AS level
      FROM water_level_observation
      WHERE station_id1 = 'P.67' AND station_id2 = 'P.1'
      ORDER BY observed_at DESC
      LIMIT 1
    `)
    const first = (rows as unknown as Array<Record<string, unknown>>)[0]
    if (first?.level != null) {
      waterLevel = Number(first.level)
      alertLevel = classifyAlert(waterLevel, null, {
        code: 'P.1',
        name: 'P.1 นวรัฐ',
        ...CMU_THRESHOLDS,
      })
    }
  } catch {
    // water level DB unavailable — continue without it
  }

  // --- vulnerable patients from JHCIS ---
  const counts: FloodAlertCounts = { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, outside: 0 }

  try {
    const [rows] = await pool.query(`
      SELECT h.xgis AS lat, h.ygis AS lng
      FROM person p
      INNER JOIN house h ON p.hcode = h.hcode AND p.pcucodeperson = h.pcucode
      LEFT JOIN personunable u ON p.pid = u.pid AND p.pcucodeperson = u.pcucodeperson
      LEFT JOIN personchronic c ON p.pid = c.pid AND p.pcucodeperson = c.pcucodeperson
      WHERE (h.xgis IS NOT NULL AND h.xgis != '')
        AND (h.ygis IS NOT NULL AND h.ygis != '')
        AND p.dischargetype = '9'
        AND p.typelive IN ('1', '3')
        AND (
          TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60
          OR u.pid IS NOT NULL
          OR c.pid IS NOT NULL
        )
      GROUP BY p.pid, h.xgis, h.ygis
    `)

    for (const row of rows as Array<{ lat: string; lng: string }>) {
      const lat = parseFloat(row.lat)
      const lng = parseFloat(row.lng)
      if (isNaN(lat) || isNaN(lng)) continue
      const level = classifyFloodLevel(lat, lng, zones)
      if (level === 1) counts.level1++
      else if (level === 2) counts.level2++
      else if (level === 3) counts.level3++
      else if (level === 4) counts.level4++
      else if (level === 5) counts.level5++
      else counts.outside++
    }
  } catch (err) {
    console.error('[cmu-flood-alert] JHCIS query failed:', err)
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  const activeZone = deriveActiveZone(waterLevel)

  // count patients currently inside the active zone (zones 1..activeZone)
  let affectedTotal = 0
  if (activeZone != null) {
    for (let z = 1; z <= activeZone; z++) {
      affectedTotal += counts[`level${z}` as keyof FloodAlertCounts] as number
    }
  }

  const response: FloodAlertResponse = {
    waterLevel,
    activeZone,
    alertLevel,
    counts,
    affectedTotal,
    updatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
