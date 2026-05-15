const UPSTREAM = 'https://watercenter.cmu.ac.th'

const ALLOWED_PATHS = new Set([
  'data/KML5Layer/L1.kml',
  'data/KML5Layer/L2.kml',
  'data/KML5Layer/L3new.kml',
  'data/KML5Layer/L4new.kml',
  'data/KML5Layer/L5.kml',
  'data/KML/river_main.kml',
  'data/parking_flood.geojson',
  'data/Shelter.geojson',
  'data/PoleCNX2025_v2.geojson',
])

export const dynamic = 'force-dynamic'

function contentTypeFor(path: string): string {
  if (path.endsWith('.kml')) return 'application/vnd.google-earth.kml+xml; charset=utf-8'
  if (path.endsWith('.geojson')) return 'application/geo+json; charset=utf-8'
  return 'application/octet-stream'
}

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const upstreamPath = path.join('/')

  if (!ALLOWED_PATHS.has(upstreamPath)) {
    return new Response(JSON.stringify({ error: 'CMU flood layer path is not allowed' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const upstreamRes = await fetch(`${UPSTREAM}/${upstreamPath}`, {
    headers: {
      accept: upstreamPath.endsWith('.kml')
        ? 'application/vnd.google-earth.kml+xml,text/xml,*/*'
        : 'application/geo+json,application/json,*/*',
    },
    next: { revalidate: 300 },
  })

  const headers = new Headers()
  headers.set(
    'content-type',
    upstreamRes.headers.get('content-type') ?? contentTypeFor(upstreamPath),
  )
  headers.set('cache-control', 'public, s-maxage=300, stale-while-revalidate=3600')

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  })
}
