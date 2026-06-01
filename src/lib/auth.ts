import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { UserRole } from '@/types'
import { authConfig } from '@/lib/auth.config'
import { isProviderIdSsoConfigured, providerIdSsoProvider } from '@/lib/provider-id-sso'
import { resolveStaffByCid, touchLastLogin } from '@/lib/staff-auth'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...(isProviderIdSsoConfigured() ? [providerIdSsoProvider()] : []),
    // ThaiD (จำลอง) — รับ CID แล้ว resolve กับทะเบียนเจ้าหน้าที่
    // เมื่อต่อ ThaiD จริง: แทน input นี้ด้วย OAuth redirect ที่คืน CID แล้วเรียก resolveStaffByCid เหมือนกัน
    Credentials({
      id: 'thaid-sim',
      name: 'ThaiD (simulated)',
      credentials: { cid: { label: 'CID', type: 'text' } },
      async authorize(credentials) {
        const cid = String(credentials?.cid ?? '')
        if (!cid) return null
        const { state, staff } = await resolveStaffByCid(cid)
        // อนุญาตเฉพาะ active — สถานะอื่น (pending/suspended/not_found) จัดการที่ฝั่ง UI ก่อน signIn
        if (state !== 'active' || !staff) return null
        touchLastLogin(staff.id)
        return {
          id: staff.id,
          email: '',
          name: staff.name,
          role: staff.role,
          province: staff.province,
          unitCode: staff.unitCode,
          status: staff.status,
        }
      },
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // ทางเข้า dev เท่านั้น — ThaiD-sim คือ flow หลัก
        const DEMO_USERS = [
          { id: '1', email: 'admin@floodwatch.th', password: 'admin1234', name: 'Admin', role: 'admin' as UserRole, province: 'เชียงราย' },
          { id: '2', email: 'officer@floodwatch.th', password: 'officer1234', name: 'เจ้าหน้าที่', role: 'officer' as UserRole, province: 'เชียงราย' },
          { id: '3', email: 'viewer@floodwatch.th', password: 'viewer1234', name: 'ผู้ดู', role: 'viewer' as UserRole, province: 'เชียงราย' },
        ]
        const user = DEMO_USERS.find(
          (u) => u.email === credentials?.email && u.password === credentials?.password,
        )
        if (!user) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role, province: user.province, status: 'active' }
      },
    }),
  ],
})
