import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Masthead } from '@/components/shell/Masthead'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { MobileTabBar } from '@/components/shell/MobileTabBar'
import { SidebarProvider, SIDEBAR_COOKIE } from '@/components/shell/SidebarProvider'
import { RoleViewProvider } from '@/components/shell/RoleViewProvider'
import { IncidentScopeProvider } from '@/components/shell/IncidentScopeProvider'
import { getActiveIncident, getSelectableIncidents, isNationalRole } from '@/lib/incident-scope'
import { canManageStaff, canTriage } from '@/lib/field-api'
import { getDb } from '@/lib/db'
import { publicHelpReports } from '@/db/schema'
import { and, count, eq, isNull, or } from 'drizzle-orm'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user?.role ?? 'viewer'
  const province = session.user?.province ?? null
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
    <RoleViewProvider realRole={role}>
      <IncidentScopeProvider active={activeIncident} selectable={selectableIncidents}>
        <SidebarProvider initialCollapsed={sidebarCollapsed}>
        <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
          <Masthead session={{ role, name: session.user?.name ?? '' }} />
          <div className="flex flex-1">
            <AppSidebar canManageStaff={canManageStaff(role)} canTriage={canTriage(role)} pendingReports={pendingReports} />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 px-4 py-6 pb-20 md:px-8 md:py-8 md:pb-8">{children}</main>
            </div>
          </div>
          <MobileTabBar canTriage={canTriage(role)} />
        </div>
        </SidebarProvider>
      </IncidentScopeProvider>
    </RoleViewProvider>
  )
}
