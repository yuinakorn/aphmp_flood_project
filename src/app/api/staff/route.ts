import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { badRequest, canManageStaff, forbidden, sessionUserId, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { isValidThaiCid } from '@/lib/cid'
import { createWhitelistStaff, listStaff } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import type { UserRole } from '@/types'

// role ที่มอบหมายได้ — national role (admin/ddpm) ออกได้เฉพาะผู้ดูแลระดับชาติ
const ASSIGNABLE_ROLES = new Set<UserRole>([
  'officer', 'eoc', 'vhv', 'ems', 'rescue', 'shelter_manager', 'viewer', 'admin', 'ddpm',
])
const NATIONAL_ASSIGN_ONLY = new Set<UserRole>(['admin', 'ddpm'])

// GET /api/staff — รายชื่อเจ้าหน้าที่ (scope ตามจังหวัด)
export async function GET() {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const national = isNationalRole(session.user.role)
  const province = session.user.province ?? null
  if (!national && !province) return NextResponse.json({ data: [] })

  const data = await listStaff({ national, province })
  return NextResponse.json({ data })
}

// POST /api/staff — ออก whitelist เจ้าหน้าที่ล่วงหน้า
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const cid = typeof body.cid === 'string' ? body.cid : ''
  if (!isValidThaiCid(cid)) return badRequest('เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const role = (typeof body.role === 'string' ? body.role : 'officer') as UserRole
  if (!ASSIGNABLE_ROLES.has(role)) return badRequest('Invalid role')

  const national = isNationalRole(session.user.role)
  // non-national มอบหมาย role ระดับชาติไม่ได้
  if (!national && NATIONAL_ASSIGN_ONLY.has(role)) return forbidden()

  // จังหวัด: non-national ล็อกเป็นจังหวัดตัวเอง · national เลือกได้
  const province = national
    ? (typeof body.province === 'string' ? body.province : '')
    : (session.user.province ?? '')
  if (!province) return badRequest('ต้องระบุจังหวัด')
  if (national && !(ALLOWED_PROVINCES as readonly string[]).includes(province)) {
    return badRequest('จังหวัดไม่อยู่ในขอบเขตระบบ')
  }

  const res = await createWhitelistStaff({
    cid,
    name,
    role,
    province,
    unitName: typeof body.unitName === 'string' ? body.unitName : null,
    approverId: sessionUserId(session),
  })
  if (!res.ok) return badRequest('เลขบัตรนี้อยู่ในระบบแล้ว')

  return NextResponse.json({ data: { id: res.id } }, { status: 201 })
}
