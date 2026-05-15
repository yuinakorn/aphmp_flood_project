import { NextRequest, NextResponse } from 'next/server'
import type { FloodMark, FloodMarkLevel } from '@/types'
import { extractFloodMarkProvince } from '@/lib/flood-marks'

const UPSTREAM =
  'https://watercenter.scmc.cmu.ac.th/cmflood/getDataSurveyLevelVer1'
const LEVELS = new Set<FloodMarkLevel>(['1', '2', '3', '4', '5'])

export const dynamic = 'force-dynamic'

interface UpstreamFloodMark {
  code?: unknown
  date_survey?: unknown
  affected_area?: unknown
  other_detail?: unknown
  place_detail?: unknown
  latitude?: unknown
  longitude?: unknown
  place_around?: unknown
  water_level?: unknown
  tool?: unknown
  tool_detail?: unknown
  note?: unknown
  image?: unknown
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function finiteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeMark(mark: UpstreamFloodMark, level: FloodMarkLevel): FloodMark | null {
  const latitude = finiteNumber(mark.latitude)
  const longitude = finiteNumber(mark.longitude)
  if (latitude === null || longitude === null) return null

  return {
    code: nullableText(mark.code) ?? 'unknown',
    dateSurvey: nullableText(mark.date_survey),
    affectedArea: nullableText(mark.affected_area),
    otherDetail: nullableText(mark.other_detail),
    placeDetail: nullableText(mark.place_detail),
    latitude,
    longitude,
    placeAround: nullableText(mark.place_around),
    waterLevel: finiteNumber(mark.water_level),
    tool: nullableText(mark.tool),
    toolDetail: nullableText(mark.tool_detail),
    note: nullableText(mark.note),
    image: nullableText(mark.image),
    level,
    province: extractFloodMarkProvince(mark.place_detail),
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ level: string }> },
) {
  const { level: rawLevel } = await ctx.params
  if (!LEVELS.has(rawLevel as FloodMarkLevel)) {
    return NextResponse.json({ error: 'Invalid flood mark level' }, { status: 400 })
  }

  const level = rawLevel as FloodMarkLevel
  const upstreamRes = await fetch(`${UPSTREAM}/${level}`, {
    headers: { accept: 'application/json' },
    next: { revalidate: 300 },
  })

  if (!upstreamRes.ok) {
    return NextResponse.json(
      { error: 'Flood mark upstream request failed' },
      { status: upstreamRes.status },
    )
  }

  const upstreamData = await upstreamRes.json()
  const data = Array.isArray(upstreamData)
    ? upstreamData
        .map((mark) => normalizeMark(mark as UpstreamFloodMark, level))
        .filter((mark): mark is FloodMark => mark !== null)
    : []

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
    },
  })
}
