import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import type { UserRole } from '@/types'
import { SettingsClient } from './SettingsClient'

export const metadata = { title: 'ตั้งค่า — GIS Health Intelligence' }

export default async function SettingsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (!canManageStaff(role)) redirect('/admin')

  const national = isNationalRole(role)
  return (
    <SettingsClient
      isNational={national}
      province={session?.user?.province ?? null}
      provinceOptions={national ? [...ALLOWED_PROVINCES] : []}
    />
  )
}
