import type { VulnerablePerson, Infrastructure, RiskLevel, EvacRoute, VulnerableHouseholdMarker } from '@/types'
import type { KmlPolygon, FloodZone } from './kml-parser'
import type { FeatureCollection, Feature, MultiPolygon, Polygon } from 'geojson'

const R = 6371 // Earth radius km

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function classifyRisk(
  lat: number,
  lng: number,
  floodPoints: [number, number][],
): RiskLevel {
  for (const [fLat, fLng] of floodPoints) {
    const d = haversineKm(lat, lng, fLat, fLng)
    if (d < 0.5) return 'flood'
  }
  for (const [fLat, fLng] of floodPoints) {
    const d = haversineKm(lat, lng, fLat, fLng)
    if (d < 2.0) return 'near'
  }
  return 'safe'
}

export function nearestShelter(
  person: VulnerablePerson,
  shelters: Infrastructure[],
): Infrastructure | null {
  if (!shelters.length) return null
  return shelters.reduce((best, s) => {
    const dBest = haversineKm(person.lat, person.lng, Number(best.lat), Number(best.lng))
    const dS = haversineKm(person.lat, person.lng, Number(s.lat), Number(s.lng))
    return dS < dBest ? s : best
  })
}

/**
 * Ray-casting even-odd rule.
 * polygon vertices are [lng, lat] pairs (KML order).
 * The query point is passed as (lat, lng) to match the rest of the codebase.
 */
export function pointInPolygon(lat: number, lng: number, polygon: KmlPolygon): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i] // xi=lng, yi=lat
    const [xj, yj] = polygon[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Returns the smallest flood level (1–5) whose polygon contains the point,
 * or null if the point is not inside any flood zone.
 * Since L1 ⊂ L2 ⊂ … ⊂ L5, the smallest level indicates the most
 * critical zone — the area that floods first.
 */
export function classifyFloodLevel(
  lat: number,
  lng: number,
  zones: FloodZone[],
): 1 | 2 | 3 | 4 | 5 | null {
  const sorted = [...zones].sort((a, b) => a.level - b.level)
  for (const zone of sorted) {
    for (const polygon of zone.polygons) {
      if (pointInPolygon(lat, lng, polygon)) return zone.level
    }
  }
  return null
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export async function buildEvacRouteOSRM(
  person: VulnerablePerson,
  shelter: Infrastructure,
  signal?: AbortSignal,
): Promise<EvacRoute> {
  const url = `${OSRM_BASE}/${person.lng},${person.lat};${shelter.lng},${shelter.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route?.geometry?.coordinates?.length) throw new Error('no route')
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    )
    return {
      personId: person.id,
      personName: person.name,
      shelterName: shelter.name,
      distanceKm: +(route.distance / 1000).toFixed(2),
      durationMin: +(route.duration / 60).toFixed(1),
      coords,
    }
  } catch {
    const fallback = buildEvacRoute(person, shelter)
    return { ...fallback, isStraightLine: true }
  }
}

// ───────── Chiang Rai Flood Simulation Analysis ─────────

export interface CrFloodDepthHit {
  level: number
  label: string
}

export interface CrFloodLevelSummary {
  level: number
  label: string
  households: number
  vulnerable: number
}

export interface CrFloodAnalysis {
  total: number
  vulnerable: number
  byLevel: CrFloodLevelSummary[]
  hitMap: Map<string, CrFloodDepthHit>
}

function pointInGeoRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function featureBbox(f: Feature): [number, number, number, number] {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  const absorb = (ring: number[][]) => {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  const geom = f.geometry
  if (geom.type === 'MultiPolygon') (geom as MultiPolygon).coordinates.forEach(p => absorb(p[0]))
  else if (geom.type === 'Polygon') absorb((geom as Polygon).coordinates[0])
  return [minLng, minLat, maxLng, maxLat]
}

function pointInGeoFeature(lat: number, lng: number, f: Feature, bbox: [number, number, number, number]): boolean {
  if (lat < bbox[1] || lat > bbox[3] || lng < bbox[0] || lng > bbox[2]) return false
  const geom = f.geometry
  if (geom.type === 'MultiPolygon') {
    return (geom as MultiPolygon).coordinates.some(poly => pointInGeoRing(lat, lng, poly[0]))
  }
  if (geom.type === 'Polygon') {
    return pointInGeoRing(lat, lng, (geom as Polygon).coordinates[0])
  }
  return false
}

export function analyzeCrFloodHouseholds(
  households: VulnerableHouseholdMarker[],
  geo: FeatureCollection,
): CrFloodAnalysis {
  const features = geo.features.map(f => ({
    f,
    level: Number((f.properties as Record<string, unknown>)?.level ?? 0),
    label: String((f.properties as Record<string, unknown>)?.label ?? ''),
    bbox: featureBbox(f),
  }))

  const hitMap = new Map<string, CrFloodDepthHit>()
  const householdById = new Map(households.map(h => [h.id, h]))

  for (const h of households) {
    let deepestLevel = 0
    let deepestLabel = ''
    for (const { f, level, label, bbox } of features) {
      if (pointInGeoFeature(h.lat, h.lng, f, bbox)) {
        if (level > deepestLevel) {
          deepestLevel = level
          deepestLabel = label
        }
      }
    }
    if (deepestLevel > 0) hitMap.set(h.id, { level: deepestLevel, label: deepestLabel })
  }

  const byLevelMap = new Map<number, { label: string; count: number; vulnerable: number }>()
  for (const [id, hit] of hitMap.entries()) {
    const h = householdById.get(id)
    if (!h) continue
    const entry = byLevelMap.get(hit.level) ?? { label: hit.label, count: 0, vulnerable: 0 }
    entry.count++
    entry.vulnerable += h.vulnerableCount
    byLevelMap.set(hit.level, entry)
  }

  const byLevel = Array.from(byLevelMap.entries())
    .map(([level, { label, count, vulnerable }]) => ({ level, label, households: count, vulnerable }))
    .sort((a, b) => a.level - b.level)

  const totalVuln = byLevel.reduce((s, r) => s + r.vulnerable, 0)

  return { total: hitMap.size, vulnerable: totalVuln, byLevel, hitMap }
}

export function buildEvacRoute(person: VulnerablePerson, shelter: Infrastructure): EvacRoute {
  const sLat = Number(shelter.lat)
  const sLng = Number(shelter.lng)
  const midLat = (person.lat + sLat) / 2 + (Math.random() - 0.5) * 0.003
  const midLng = (person.lng + sLng) / 2 + (Math.random() - 0.5) * 0.003
  return {
    personId: person.id,
    personName: person.name,
    shelterName: shelter.name,
    distanceKm: +haversineKm(person.lat, person.lng, sLat, sLng).toFixed(1),
    coords: [
      [person.lat, person.lng],
      [midLat, midLng],
      [sLat, sLng],
    ],
  }
}

