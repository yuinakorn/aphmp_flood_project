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

export function parseBbox(bbox: string): [number, number, number, number] | null {
  const parts = bbox.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return parts as [number, number, number, number]
}
