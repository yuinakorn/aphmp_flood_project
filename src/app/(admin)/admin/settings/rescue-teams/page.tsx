import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canTriage } from '@/lib/field-api'
import { getDb } from '@/lib/db'
import { rescueTeams } from '@/db/schema'
import { getActiveIncident } from '@/lib/incident-scope'
import type { RescueTeam, RescueTeamStatus, RescueTeamType, UserRole } from '@/types'
import { RescueTeamsClient } from '../../rescue-teams/RescueTeamsClient'

export const metadata = { title: 'ทีมกู้ภัย — ตั้งค่า' }

export default async function SettingsRescueTeamsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (!canTriage(role)) redirect('/admin')

  const scope = await getActiveIncident(role, session?.user?.province ?? null)
  const db = getDb()

  const teamWhere = scope ? eq(rescueTeams.incidentId, scope.id) : undefined
  const teams = await db
    .select()
    .from(rescueTeams)
    .where(teamWhere)
    .orderBy(desc(rescueTeams.createdAt))

  const teamList: RescueTeam[] = teams.map((t) => ({
    id: t.id,
    incidentId: t.incidentId,
    name: t.name,
    teamType: t.teamType as RescueTeamType,
    contact: t.contact ?? undefined,
    zone: t.zone ?? undefined,
    status: t.status as RescueTeamStatus,
    lat: t.lat ? Number(t.lat) : undefined,
    lng: t.lng ? Number(t.lng) : undefined,
    registeredBy: t.registeredBy ?? undefined,
  }))

  return (
    <RescueTeamsClient
      teams={teamList}
      canManage={canTriage(role)}
      scopedToIncident={!!scope}
      incidentName={scope?.name ?? null}
    />
  )
}
