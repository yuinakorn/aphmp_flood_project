import { NextRequest, NextResponse } from 'next/server'
import { classifyRisk } from '@/lib/geo'
import type { VulnerablePerson } from '@/types'
import rawVuln from '../../../../public/data/vulnerable.json'
import floodPointsData from '../../../../public/data/flood-points.json'

export const runtime = 'edge'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

export async function GET(_req: NextRequest) {
  const persons = rawVuln as VulnerablePerson[]
  const risks = persons.map((p) => classifyRisk(p.lat, p.lng, floodCoords))

  return NextResponse.json(
    {
      floodPoints: {
        total: floodPointsData.features.length,
        areaSqKm: 50.7,
        sarPasses: 14,
        baselinePasses: 30,
      },
      vulnerable: {
        flood: risks.filter((r) => r === 'flood').length,
        near: risks.filter((r) => r === 'near').length,
        safe: risks.filter((r) => r === 'safe').length,
        total: persons.length,
      },
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    },
  )
}
