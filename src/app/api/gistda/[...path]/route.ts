import { NextRequest } from 'next/server'

const UPSTREAM = 'https://api-gateway.gistda.or.th/api/2.0/resources'

export const dynamic = 'force-dynamic'

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const apiKey = process.env.GISTDA_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GISTDA_API_KEY not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { path } = await ctx.params
  const search = new URL(req.url).search
  const target = `${UPSTREAM}/${path.join('/')}${search}`

  const upstreamRes = await fetch(target, {
    method: req.method,
    headers: {
      'API-Key': apiKey,
      accept: req.headers.get('accept') ?? '*/*',
    },
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    cache: 'no-store',
  })

  const headers = new Headers()
  const ct = upstreamRes.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  // cache tile/image responses briefly on the edge
  if (ct?.startsWith('image/')) {
    headers.set('cache-control', 'public, max-age=300, s-maxage=600')
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  })
}

export { proxy as GET, proxy as POST }
