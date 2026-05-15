import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { classifyRisk } from '@/lib/geo'
import type { VulnerablePerson } from '@/types'
import rawData from '../../../../public/data/vulnerable.json'
import floodPointsData from '../../../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

function maskName(name: string): string {
  const parts = name.split(' ')
  return parts.map((p, i) => (i === 0 ? p : p[0] + '***')).join(' ')
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role ?? 'anonymous'

  const { searchParams } = new URL(req.url)
  const bbox = searchParams.get('bbox')

  let persons = rawData as VulnerablePerson[]

  if (bbox) {
    const parts = bbox.split(',').map(Number)
    if (parts.length === 4 && !parts.some(isNaN)) {
      const [minLng, minLat, maxLng, maxLat] = parts
      persons = persons.filter(
        (p) => p.lng >= minLng && p.lng <= maxLng && p.lat >= minLat && p.lat <= maxLat,
      )
    }
  }

  const enriched = persons.map((p) => {
    const risk = classifyRisk(p.lat, p.lng, floodCoords)
    const base = { ...p, risk }

    // anonymous/viewer: mask sensitive fields
    // [DEMO MODE]: Disabled PDPA masking temporarily
    /*
    if (role === 'anonymous' || role === 'viewer') {
      return {
        id: base.id,
        name: maskName(base.name),
        type: base.type,
        label: base.label,
        lat: base.lat,
        lng: base.lng,
        risk: base.risk,
        vil: base.vil,
      }
    }
    */
    return base
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['admin', 'officer'].includes(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  // TODO: validate + insert into DB
  return NextResponse.json({ success: true, data: body }, { status: 201 })
}
