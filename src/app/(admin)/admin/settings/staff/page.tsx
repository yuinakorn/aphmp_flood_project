import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import type { UserRole } from '@/types'
import { StaffClient } from '../../staff/StaffClient'

export const metadata = { title: 'จัดการเจ้าหน้าที่ — ตั้งค่า' }

export default async function SettingsStaffPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (!canManageStaff(role)) redirect('/admin')

  const national = isNationalRole(role)
  return (
    <StaffClient
      isNational={national}
      province={session?.user?.province ?? null}
      provinceOptions={national ? [...ALLOWED_PROVINCES] : []}
    />
  )
}
