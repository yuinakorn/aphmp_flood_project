import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff, canTriage } from '@/lib/field-api'
import type { UserRole } from '@/types'
import { SettingsTabs } from './SettingsTabs'

export const metadata = { title: 'ตั้งค่า — GIS Health Intelligence' }

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  const manageStaff = canManageStaff(role)
  const triage = canTriage(role)
  if (!manageStaff && !triage) redirect('/admin')

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="gx-title">ตั้งค่าระบบ</h1>
      </div>

      <SettingsTabs canManageStaff={manageStaff} canTriage={triage} />

      <div className="mt-5">{children}</div>
    </div>
  )
}
