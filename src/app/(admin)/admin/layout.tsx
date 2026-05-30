import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Masthead } from '@/components/shell/Masthead'
import { RoleViewProvider } from '@/components/shell/RoleViewProvider'
import { IncidentScopeProvider } from '@/components/shell/IncidentScopeProvider'
import { IncidentBanner } from '@/components/shell/IncidentBanner'
import { getActiveIncident, getSelectableIncidents } from '@/lib/incident-scope'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user?.role ?? 'viewer'
  const [activeIncident, selectableIncidents] = await Promise.all([
    getActiveIncident(role),
    getSelectableIncidents(role),
  ])

  return (
    <RoleViewProvider realRole={role}>
      <IncidentScopeProvider active={activeIncident} selectable={selectableIncidents}>
        <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
          <Masthead session={{ role, name: session.user?.name ?? '' }} />
          <IncidentBanner />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </IncidentScopeProvider>
    </RoleViewProvider>
  )
}
