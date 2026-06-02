import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { badRequest, canManageStaff, forbidden, isUuid, sessionUserId, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { getStaffById, setStaffRole, setStaffStatus, type StaffStatus } from '@/lib/staff-auth'
import { audit } from '@/lib/audit'
import type { UserRole } from '@/types'

const VALID_STATUS = new Set<StaffStatus>(['pending', 'active', 'suspended'])
const ASSIGNABLE_ROLES = new Set<UserRole>([
  'officer', 'eoc', 'vhv', 'ems', 'rescue', 'shelter_manager', 'viewer', 'admin', 'ddpm',
])
const NATIONAL_ASSIGN_ONLY = new Set<UserRole>(['admin', 'ddpm'])

// PATCH /api/staff/[id] — อนุมัติ / ระงับ / คืนสิทธิ์ / เปลี่ยน role
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const target = await getStaffById(id)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const national = isNationalRole(session.user.role)
  // non-national จัดการได้เฉพาะเจ้าหน้าที่ในจังหวัดตัวเอง
  if (!national && target.province !== (session.user.province ?? null)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  let changed = false

  if ('status' in body) {
    const status = body.status as StaffStatus
    if (!VALID_STATUS.has(status)) return badRequest('Invalid status')
    // กันระงับ/ดาวน์เกรดบัญชีตัวเอง (ล็อกตัวเองออก)
    if (id === session.user.id && status !== 'active') return badRequest('ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเองได้')
    await setStaffStatus(id, status, sessionUserId(session))
    changed = true
  }

  if ('role' in body) {
    const role = body.role as UserRole
    if (!ASSIGNABLE_ROLES.has(role)) return badRequest('Invalid role')
    if (!national && NATIONAL_ASSIGN_ONLY.has(role)) return forbidden()
    await setStaffRole(id, role)
    changed = true
  }

  if (!changed) return badRequest('No updatable fields provided')

  void audit(req, session, {
    action: 'update_staff',
    entity: 'user',
    targetId: id,
    metadata: { status: body.status, role: body.role },
  })

  return NextResponse.json({ ok: true })
}
