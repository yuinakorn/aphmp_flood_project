import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/lib/auth'
import { THAID_SSO_STATE_COOKIE } from '@/lib/provider-id-thaid'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const isProviderIdCallback = url.pathname.endsWith('/callback/provider-id-sso')

  if (isProviderIdCallback) {
    const returnedState = url.searchParams.get('state')
    const cookieStore = await cookies()
    const expectedState = cookieStore.get(THAID_SSO_STATE_COOKIE)?.value

    if (expectedState) {
      cookieStore.delete(THAID_SSO_STATE_COOKIE)

      if (!returnedState || returnedState !== expectedState) {
        return NextResponse.redirect(new URL('/login?error=invalid_sso_state', req.url))
      }
    }
  }

  return handlers.GET(req)
}

export const POST = handlers.POST
