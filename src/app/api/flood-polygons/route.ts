import { NextRequest, NextResponse } from 'next/server'
import s2Data from '../../../../public/data/s2-flood-polygons.json'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // e.g. 2025-07-24 (reserved for future multi-date support)

  return NextResponse.json(s2Data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
