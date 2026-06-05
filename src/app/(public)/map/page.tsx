import { cookies } from 'next/headers'
import { MapClient } from './MapClient'
import { auth } from '@/lib/auth'
import { RoleViewProvider } from '@/components/shell/RoleViewProvider'
import { IncidentScopeProvider } from '@/components/shell/IncidentScopeProvider'
import { SidebarProvider, SIDEBAR_COOKIE } from '@/components/shell/SidebarProvider'
import { getActiveIncident, getSelectableIncidents, isNationalRole } from '@/lib/incident-scope'
import { canManageStaff, canTriage } from '@/lib/field-api'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Flood Map — GIS Health Intelligence',
  description: 'โมดูลเฝ้าระวังน้ำท่วม บนแพลตฟอร์มข้อมูลสุขภาพเชิงพื้นที่ GIS Health Intelligence',
}

export default async function MapPage() {
  const session = await auth()
  const mapSession = session?.user
    ? { id: session.user.id ?? '', role: session.user.role ?? 'viewer', name: session.user.name ?? '' }
    : null

  if (!mapSession) redirect('/login')

  const province = session?.user?.province ?? null
  const [activeIncident, selectableIncidents] = await Promise.all([
    getActiveIncident(mapSession.role, province),
    getSelectableIncidents(mapSession.role, province),
  ])
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1'

  return (
    <RoleViewProvider realRole={mapSession.role}>
      <IncidentScopeProvider active={activeIncident} selectable={selectableIncidents}>
        <SidebarProvider initialCollapsed={sidebarCollapsed}>
          <MapClient
            session={mapSession}
            canManageStaff={canManageStaff(mapSession.role)}
            canTriage={canTriage(mapSession.role)}
            userProvince={province}
            isNational={isNationalRole(mapSession.role)}
          />
        </SidebarProvider>
      </IncidentScopeProvider>
    </RoleViewProvider>
  )
}
