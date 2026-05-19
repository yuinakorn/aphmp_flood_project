import { readFileSync } from 'fs'
import path from 'path'

/** [lng, lat] pair as stored in KML */
export type KmlPoint = [number, number]

/** One polygon = ordered ring of [lng, lat] vertices */
export type KmlPolygon = KmlPoint[]

export interface FloodZone {
  level: 1 | 2 | 3 | 4 | 5
  /** P.1 water level (metres) at which this zone activates */
  threshold: number
  polygons: KmlPolygon[]
}

const ZONE_META: { level: 1 | 2 | 3 | 4 | 5; threshold: number; file: string }[] = [
  { level: 1, threshold: 4.30, file: 'L1.kml' },
  { level: 2, threshold: 4.50, file: 'L2.kml' },
  { level: 3, threshold: 4.70, file: 'L3new.kml' },
  { level: 4, threshold: 5.00, file: 'L4new.kml' },
  { level: 5, threshold: 5.30, file: 'L5.kml' },
]

function extractPolygons(kml: string): KmlPolygon[] {
  const polygons: KmlPolygon[] = []
  const blockRe = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(kml)) !== null) {
    const ring: KmlPoint[] = m[1]
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const [lng, lat] = token.split(',').map(Number)
        return [lng, lat] as KmlPoint
      })
    if (ring.length >= 3) polygons.push(ring)
  }
  return polygons
}

let _zones: FloodZone[] | null = null

/** Loads and caches all 5 CMU flood zones from the KML files (server-only). */
export function getFloodZones(): FloodZone[] {
  if (_zones) return _zones
  const dir = path.join(process.cwd(), 'public', 'data', 'kml')
  _zones = ZONE_META.map(({ level, threshold, file }) => ({
    level,
    threshold,
    polygons: extractPolygons(readFileSync(path.join(dir, file), 'utf-8')),
  }))
  return _zones
}
