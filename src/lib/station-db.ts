import { getDb } from '@/lib/db'
import { waterStations } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import type { StationThreshold } from '@/lib/water-level'

export async function loadStationThresholds(
  codes: string[],
): Promise<Record<string, StationThreshold>> {
  const db = getDb()
  const rows = await db
    .select()
    .from(waterStations)
    .where(inArray(waterStations.stationCode, codes))

  const result: Record<string, StationThreshold> = {}
  for (const r of rows) {
    result[r.stationCode] = {
      code: r.stationCode,
      name: r.stationNameTh,
      warning: Number(r.warningLevel ?? 0),
      prepare: Number(r.prepareLevel ?? 0),
      critical: Number(r.criticalLevel ?? 0),
      danger: Number(r.dangerLevel ?? 0),
      rapidRise: Number(r.rapidRiseThreshold ?? 0.2),
    }
  }
  return result
}
