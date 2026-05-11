import { NextRequest, NextResponse } from 'next/server'
import floodPointsData from '../../../../public/data/flood-points.json'
import type { VulnerablePerson } from '@/types'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bbox = searchParams.get('bbox') // minLng,minLat,maxLng,maxLat

  let features = floodPointsData.features

  if (bbox) {
    const parts = bbox.split(',').map(Number)
    if (parts.length === 4 && !parts.some(isNaN)) {
      const [minLng, minLat, maxLng, maxLat] = parts
      features = features.filter((f) => {
        const [lng, lat] = f.geometry.coordinates
        return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
      })
    }
  }

  return NextResponse.json(
    { type: 'FeatureCollection', features },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}
