import { NextResponse } from 'next/server'
import { signOut } from '@/lib/auth'
import { INCIDENT_COOKIE } from '@/lib/scope-cookie'

export async function GET(req: Request) {
  // ล้าง NextAuth session (JWT cookie) ฝั่ง server
  await signOut({ redirect: false })

  const appOrigin = new URL(req.url).origin
  const loginUrl = new URL('/login', appOrigin).toString()

  const ssoUrl = process.env.SSO_URL
  const clientId = process.env.SSO_CLIENT_ID

  const res = ssoUrl && clientId
    ? NextResponse.redirect(
        new URL(
          `/api/auth/logout?client_id=${clientId}&post_logout_redirect_uri=${encodeURIComponent(loginUrl)}`,
          ssoUrl,
        ),
      )
    : NextResponse.redirect(loginUrl)

  // ล้าง incident scope cookie ด้วย
  res.cookies.delete(INCIDENT_COOKIE)

  return res
}
