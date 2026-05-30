import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { rescueTeams, helpRequests, householdMembers } from '@/db/schema'
import { getActiveIncident } from '@/lib/incident-scope'
import { EocDashboard } from './EocDashboard'
import type { Incident, RescueTeam, RescueTeamType, RescueTeamStatus, VulnerablePerson } from '@/types'

export const metadata = { title: 'ศูนย์บัญชาการ EOC — GIS Health Intelligence' }

export default async function EocPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'viewer'

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const cookie = (await cookies()).toString()
  const init = { cache: 'no-store' as const, headers: { cookie } }

  const scope = await getActiveIncident(role)

  const db = getDb()

  // requests/teams: ถ้ามี scope → กรอง incidentId; ถ้าไม่มี → "ทั้งหมด" (โหมดปกติ)
  const teamWhere = scope ? eq(rescueTeams.incidentId, scope.id) : undefined
  const reqWhere = scope ? eq(helpRequests.incidentId, scope.id) : undefined

  const [personsRes, teams, requests] = await Promise.all([
    fetch(`${base}/api/vulnerable`, init).then((r) => r.json()).catch(() => []),
    db.select().from(rescueTeams)
      .where(teamWhere ? and(teamWhere) : undefined)
      .orderBy(desc(rescueTeams.createdAt)),
    db
      .select({
        id: helpRequests.id,
        requestType: helpRequests.requestType,
        priority: helpRequests.priority,
        status: helpRequests.status,
        description: helpRequests.description,
        observedAt: helpRequests.observedAt,
        memberFirst: householdMembers.firstName,
        memberLast: householdMembers.lastName,
      })
      .from(helpRequests)
      .leftJoin(householdMembers, eq(helpRequests.memberId, householdMembers.id))
      .where(reqWhere ? and(reqWhere) : undefined)
      .orderBy(desc(helpRequests.createdAt))
      .limit(50),
  ])

  const allPersons: VulnerablePerson[] = Array.isArray(personsRes) ? personsRes : []

  // กรอง persons ตามพื้นที่ของ incident — tambon ละเอียดสุด → amphoe → province
  const persons: VulnerablePerson[] = (() => {
    if (!scope) return allPersons
    if (scope.tambon) return allPersons.filter((p) => p.tambon === scope.tambon && p.amphoe === scope.amphoe)
    if (scope.amphoe) return allPersons.filter((p) => p.amphoe === scope.amphoe)
    if (scope.province) return allPersons.filter((p) => (p as VulnerablePerson & { province?: string }).province === scope.province)
    return allPersons
  })()

  const activeIncidents: Incident[] = scope ? [scope] : []

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
    <EocDashboard
      persons={persons}
      activeIncidents={activeIncidents}
      rescueTeams={teamList}
      requests={requests.map((r) => ({
        id: r.id,
        requestType: r.requestType,
        priority: r.priority,
        status: r.status,
        description: r.description ?? '',
        observedAt: (r.observedAt as unknown as Date)?.toString?.() ?? '',
        memberName: [r.memberFirst, r.memberLast].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
      }))}
      realRole={role}
    />
  )
}
