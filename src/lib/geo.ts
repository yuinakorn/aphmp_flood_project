import type { VulnerablePerson, Infrastructure, RiskLevel, EvacRoute } from '@/types'
import type { KmlPolygon, FloodZone } from './kml-parser'

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

