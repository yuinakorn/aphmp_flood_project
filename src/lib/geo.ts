import type { VulnerablePerson, Infrastructure, RiskLevel, EvacRoute } from '@/types'

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
    const dBest = haversineKm(person.lat, person.lng, best.lat, best.lng)
    const dS = haversineKm(person.lat, person.lng, s.lat, s.lng)
    return dS < dBest ? s : best
  })
}

export function buildEvacRoute(person: VulnerablePerson, shelter: Infrastructure): EvacRoute {
  const midLat = (person.lat + shelter.lat) / 2 + (Math.random() - 0.5) * 0.003
  const midLng = (person.lng + shelter.lng) / 2 + (Math.random() - 0.5) * 0.003
  return {
    personId: person.id,
    personName: person.name,
    shelterName: shelter.name,
    distanceKm: +haversineKm(person.lat, person.lng, shelter.lat, shelter.lng).toFixed(1),
    coords: [
      [person.lat, person.lng],
      [midLat, midLng],
      [shelter.lat, shelter.lng],
    ],
  }
}

/**
 * Compute centroid (avg lat/lng) and an intensity score for one GeoJSON feature
 * whose geometry is Polygon or MultiPolygon. Intensity is roughly log-scaled
 * bbox area in km², clamped to [0.5, 3] so it matches the heatmap palette stops.
 */
export function floodFeatureToPoint(
  feature: any,
): [number, number, number] | null {
  const g = feature?.geometry
  if (!g) return null
  let rings: number[][][] = []
  if (g.type === 'Polygon') rings = g.coordinates
  else if (g.type === 'MultiPolygon') rings = g.coordinates.flat()
  else return null
  let sLng = 0,
    sLat = 0,
    n = 0
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng, lat] = ring[i]
      sLng += lng
      sLat += lat
      n++
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
  }
  if (!n) return null
  const cLat = sLat / n
  const cLng = sLng / n
  const dLatKm = (maxLat - minLat) * 111
  const dLngKm = (maxLng - minLng) * 111 * Math.cos((cLat * Math.PI) / 180)
  const areaKm2 = Math.max(0.001, dLatKm * dLngKm)
  const intensity = Math.max(0.5, Math.min(3, 0.5 + Math.log10(1 + areaKm2)))
  return [cLat, cLng, intensity]
}

export function parseBbox(bbox: string): [number, number, number, number] | null {
  const parts = bbox.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return parts as [number, number, number, number]
}
