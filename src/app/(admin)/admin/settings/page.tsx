import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff, canTriage } from '@/lib/field-api'
import type { UserRole } from '@/types'

export default async function SettingsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (canManageStaff(role)) redirect('/admin/settings/staff')
  if (canTriage(role)) redirect('/admin/settings/rescue-teams')
  redirect('/admin')
}
