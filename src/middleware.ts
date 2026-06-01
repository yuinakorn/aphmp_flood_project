import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { INCIDENT_COOKIE, SELECT_SCOPE_PATH } from '@/lib/scope-cookie'

// ใช้ authConfig (edge-safe) เท่านั้น — ไม่ import auth.ts ที่มี node crypto / staff-auth
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAdminRoute = pathname.startsWith('/admin')
  const isMapRoute = pathname.startsWith('/map')

  // ยังไม่ login → ไปหน้า login
  if ((isAdminRoute || isMapRoute) && !req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // login แล้ว แต่ยังไม่เลือก scope → บังคับไปหน้าเลือกเหตุการณ์ก่อน (ยกเว้นหน้าเลือกเอง)
  if (isAdminRoute && req.auth && pathname !== SELECT_SCOPE_PATH) {
    const hasScope = !!req.cookies.get(INCIDENT_COOKIE)?.value
    if (!hasScope) {
      return NextResponse.redirect(new URL(SELECT_SCOPE_PATH, req.url))
    }
  }
})

export const config = {
  matcher: ['/admin/:path*', '/map/:path*'],
}
