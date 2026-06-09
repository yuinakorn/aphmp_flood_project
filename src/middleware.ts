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

  // login แล้ว แต่ยังไม่ได้รับอนุมัติ (pending/suspended) → ไปหน้าขอสิทธิ์ (ไม่เห็นเมนู)
  if (isAdminRoute && req.auth && req.auth.user?.status !== 'active') {
    return NextResponse.redirect(new URL('/request-access', req.url))
  }

  // login แล้ว แต่ยังไม่เลือก scope → บังคับไปหน้าเลือกเหตุการณ์ก่อน
  // ยกเว้น: หน้าเลือกเอง + หน้าที่ไม่ผูกกับเหตุการณ์ (จัดการระบบ)
  const SCOPE_FREE_PATHS = [SELECT_SCOPE_PATH, '/admin/staff', '/admin/settings', '/admin/incidents', '/admin/water-level', '/admin/infra', '/admin/help-reports', '/admin/rescue-teams']
  if (isAdminRoute && req.auth && !SCOPE_FREE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const hasScope = !!req.cookies.get(INCIDENT_COOKIE)?.value
    if (!hasScope) {
      return NextResponse.redirect(new URL(SELECT_SCOPE_PATH, req.url))
    }
  }
})

export const config = {
  matcher: ['/admin/:path*', '/map/:path*'],
}
