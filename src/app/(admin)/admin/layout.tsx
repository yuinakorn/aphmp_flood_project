import { auth } from '@/lib/auth'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Masthead } from '@/components/shell/Masthead'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { MobileTabBar } from '@/components/shell/MobileTabBar'
import { SidebarProvider, SIDEBAR_COOKIE } from '@/components/shell/SidebarProvider'
import { IncidentScopeProvider } from '@/components/shell/IncidentScopeProvider'
import { getActiveIncident, getSelectableIncidents, isNationalRole } from '@/lib/incident-scope'
import { canTriage } from '@/lib/field-api'
import { getVisibleMenuKeys } from '@/lib/menu-access'
import { menuItemForPath } from '@/lib/menus'
import { getDb } from '@/lib/db'
import { publicHelpReports } from '@/db/schema'
import { and, count, eq, isNull, or } from 'drizzle-orm'
import type { UserRole } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  // ยังไม่ได้รับอนุมัติ (pending/suspended) → ไม่เห็นเมนูใด ๆ ไปหน้าขอสิทธิ์
  if (session.user?.status !== 'active') redirect('/request-access')

  const role = (session.user?.role ?? 'viewer') as UserRole
  const province = session.user?.province ?? null

  // เมนูที่ role นี้เห็นได้ (default + override จากหน้าตั้งค่า)
  const visibleKeys = await getVisibleMenuKeys(role)

  // route guard: ถ้า path ปัจจุบันตรงกับเมนูที่ถูกซ่อนสำหรับ role นี้ → เด้งกลับหน้าหลัก
  // (x-pathname ตั้งโดย middleware; /admin เปล่าๆ ไม่ตรงเมนูใด → เข้าได้เสมอ)
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (pathname) {
    const menu = menuItemForPath(pathname)
    if (menu && !visibleKeys.has(menu.key)) redirect('/admin')
  }

  const [activeIncident, selectableIncidents] = await Promise.all([
    getActiveIncident(role, province),
    getSelectableIncidents(role, province),
  ])
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1'

  // จำนวนคำร้องประชาชนที่รอตรวจสอบ — แสดง badge ที่ sidebar (เฉพาะ role ที่ triage ได้)
  let pendingReports = 0
  if (canTriage(role)) {
    const provinceWhere = isNationalRole(role) || !province
      ? undefined
      : or(eq(publicHelpReports.province, province), isNull(publicHelpReports.province))
    const [row] = await getDb()
      .select({ c: count() })
      .from(publicHelpReports)
      .where(provinceWhere ? and(eq(publicHelpReports.status, 'pending'), provinceWhere) : eq(publicHelpReports.status, 'pending'))
    pendingReports = Number(row?.c ?? 0)
  }

  return (
    <IncidentScopeProvider active={activeIncident} selectable={selectableIncidents}>
      <SidebarProvider initialCollapsed={sidebarCollapsed}>
        <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
          <Masthead session={{ role, name: session.user?.name ?? '' }} />
          <div className="flex flex-1">
            <AppSidebar visibleKeys={[...visibleKeys]} pendingReports={pendingReports} />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 px-4 py-6 pb-20 md:px-8 md:py-8 md:pb-8">{children}</main>
            </div>
          </div>
          <MobileTabBar canTriage={canTriage(role)} />
        </div>
      </SidebarProvider>
    </IncidentScopeProvider>
  )
}
