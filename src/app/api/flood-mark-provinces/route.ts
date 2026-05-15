import { NextResponse } from 'next/server'
import type { FloodMarkLevel, FloodMarkProvince } from '@/types'
import { extractFloodMarkProvince } from '@/lib/flood-marks'

const UPSTREAM =
  'https://watercenter.scmc.cmu.ac.th/cmflood/getDataSurveyLevelVer1'
const LEVELS: FloodMarkLevel[] = ['1', '2', '3', '4', '5']
export const dynamic = 'force-dynamic'

interface UpstreamFloodMark {
  place_detail?: unknown
  latitude?: unknown
  longitude?: unknown
}

interface ProvinceAccumulator {
  count: number
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

function finiteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

export async function GET() {
  const responses = await Promise.all(
    LEVELS.map((level) =>
      fetch(`${UPSTREAM}/${level}`, {
        headers: { accept: 'application/json' },
        next: { revalidate: 300 },
      }),
    ),
  )

  const upstreamData = await Promise.all(
    responses.map(async (res) => {
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? (data as UpstreamFloodMark[]) : []
    }),
  )

  const provinceMap = new Map<string, ProvinceAccumulator>()

  upstreamData.flat().forEach((mark) => {
    const province = extractFloodMarkProvince(mark.place_detail)
    const lat = finiteNumber(mark.latitude)
    const lng = finiteNumber(mark.longitude)
    if (!province || lat === null || lng === null) return

    const current = provinceMap.get(province)
    if (!current) {
      provinceMap.set(province, {
        count: 1,
        minLat: lat,
        minLng: lng,
        maxLat: lat,
        maxLng: lng,
      })
      return
    }

    current.count += 1
    current.minLat = Math.min(current.minLat, lat)
    current.minLng = Math.min(current.minLng, lng)
    current.maxLat = Math.max(current.maxLat, lat)
    current.maxLng = Math.max(current.maxLng, lng)
  })

  const provinces: FloodMarkProvince[] = Array.from(provinceMap.entries())
    .map(([name, value]) => {
      const bounds: FloodMarkProvince['bounds'] = [
        [value.minLat, value.minLng],
        [value.maxLat, value.maxLng],
      ]

      return {
        name,
        count: value.count,
        bounds,
      }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'))

  return NextResponse.json(provinces, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
    },
  })
}
