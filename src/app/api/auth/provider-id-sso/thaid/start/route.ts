import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'
import {
  THAID_SSO_STATE_COOKIE,
  THAID_SSO_STATE_MAX_AGE,
} from '@/lib/provider-id-thaid'
import { isProviderIdSsoConfigured } from '@/lib/provider-id-sso'

export async function GET(req: Request) {
  const loginUrl = new URL('/login', req.url)

  if (!isProviderIdSsoConfigured()) {
    loginUrl.searchParams.set('error', 'sso_not_configured')
    return NextResponse.redirect(loginUrl)
  }

  try {
    const redirectUrl = await signIn(
      'provider-id-sso',
      { redirect: false, redirectTo: '/admin' },
      { auth_provider: 'thaid' },
    )

    if (typeof redirectUrl !== 'string') {
      loginUrl.searchParams.set('error', 'sso_start_failed')
      return NextResponse.redirect(loginUrl)
    }

    const authorizationUrl = new URL(redirectUrl)
    const state = authorizationUrl.searchParams.get('state')

    if (!state) {
      loginUrl.searchParams.set('error', 'sso_state_missing')
      return NextResponse.redirect(loginUrl)
    }

    const cookieStore = await cookies()
    cookieStore.set(THAID_SSO_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: THAID_SSO_STATE_MAX_AGE,
    })

    return NextResponse.redirect(authorizationUrl)
  } catch {
    loginUrl.searchParams.set('error', 'sso_start_failed')
    return NextResponse.redirect(loginUrl)
  }
}
