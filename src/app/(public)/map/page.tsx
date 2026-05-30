import { MapClient } from './MapClient'
import { auth } from '@/lib/auth'
import { RoleViewProvider } from '@/components/shell/RoleViewProvider'
import { IncidentScopeProvider } from '@/components/shell/IncidentScopeProvider'
import { getActiveIncident, getSelectableIncidents } from '@/lib/incident-scope'

export const metadata = {
  title: 'Flood Map — GIS Health Intelligence',
  description: 'โมดูลเฝ้าระวังน้ำท่วม บนแพลตฟอร์มข้อมูลสุขภาพเชิงพื้นที่ GIS Health Intelligence',
}

export default async function MapPage() {
  const session = await auth()
  const mapSession = session?.user
    ? { id: session.user.id ?? '', role: session.user.role ?? 'viewer', name: session.user.name ?? '' }
    : null

  if (!mapSession) return <MapClient session={null} />

  const [activeIncident, selectableIncidents] = await Promise.all([
    getActiveIncident(mapSession.role),
    getSelectableIncidents(mapSession.role),
  ])

  return (
    <RoleViewProvider realRole={mapSession.role}>
      <IncidentScopeProvider active={activeIncident} selectable={selectableIncidents}>
        <MapClient session={mapSession} />
      </IncidentScopeProvider>
    </RoleViewProvider>
  )
}
