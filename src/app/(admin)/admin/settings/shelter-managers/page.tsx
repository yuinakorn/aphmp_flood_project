import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff } from '@/lib/field-api'
import type { UserRole } from '@/types'
import { ShelterManagersTab } from '../ShelterManagersTab'

export const metadata = { title: 'ผู้ดูแลศูนย์พักพิง — ตั้งค่า' }

export default async function SettingsShelterManagersPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (!canManageStaff(role)) redirect('/admin')

  return <ShelterManagersTab />
}
