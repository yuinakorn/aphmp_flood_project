import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff } from '@/lib/field-api'
import { getMenuAccessMatrix } from '@/lib/menu-access'
import { MENU_ITEMS, MENU_SECTION_LABEL } from '@/lib/menus'
import type { UserRole } from '@/types'
import { MenuAccessClient } from './MenuAccessClient'

export const metadata = { title: 'สิทธิ์การเห็นเมนู — ตั้งค่า' }

// ลำดับคอลัมน์ role (บัญชาการ → ภาคสนาม → ผู้ดู)
const ROLE_ORDER: UserRole[] = ['admin', 'eoc', 'ddpm', 'officer', 'ems', 'rescue', 'vhv', 'shelter_manager', 'viewer']

export default async function MenuAccessSettingsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (!canManageStaff(role)) redirect('/admin')

  const data = await getMenuAccessMatrix(ROLE_ORDER)

  return (
    <MenuAccessClient
      roles={ROLE_ORDER}
      menus={MENU_ITEMS.map((m) => ({ key: m.key, label: m.label, section: m.section }))}
      sectionLabels={MENU_SECTION_LABEL}
      matrix={data.matrix}
      locked={data.locked}
    />
  )
}
