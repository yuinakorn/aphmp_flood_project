/**
 * auth.config.ts — ส่วน config ที่ "edge-safe" (ไม่มี node deps / ไม่มี providers ที่แตะ DB)
 * middleware ใช้ไฟล์นี้เท่านั้น เพื่อไม่ลาก node crypto / staff-auth เข้า Edge Runtime
 * ส่วน providers (credentials → staff-auth → cid → node crypto) อยู่ใน auth.ts ซึ่งรันบน Node
 */
import type { NextAuthConfig } from 'next-auth'
import type { UserRole } from '@/types'

declare module 'next-auth' {
  interface User {
    role: UserRole
    province?: string | null
    unitCode?: string | null
    status?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      province: string | null
      unitCode: string | null
      status: string
    }
  }
}

export const authConfig = {
  trustHost: true,
  pages: { signIn: '/login' },
  providers: [], // เติมใน auth.ts — middleware ไม่ต้องรู้จัก providers
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.province = user.province ?? null
        token.unitCode = user.unitCode ?? null
        token.status = user.status ?? 'active'
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? '')
        session.user.role = (token.role as UserRole) ?? 'viewer'
        session.user.province = (token.province as string | null) ?? null
        session.user.unitCode = (token.unitCode as string | null) ?? null
        session.user.status = (token.status as string) ?? 'active'
      }
      return session
    },
  },
} satisfies NextAuthConfig
