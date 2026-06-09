import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { rescueTeams, helpRequests, caseAssignments, householdMembers, infrastructures } from '@/db/schema'
import { getActiveIncident } from '@/lib/incident-scope'
import type { RescueTeam, RescueTeamStatus, RescueTeamType, UserRole } from '@/types'
import { RescueMissionsClient } from './RescueMissionsClient'

export const metadata = { title: 'ศูนย์ปฏิบัติการทีมกู้ชีพกู้ภัย — GIS Health Intelligence' }

export default async function RescueMissionsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole

  const scope = await getActiveIncident(role, session?.user?.province ?? null)
  const db = getDb()

  const teamWhere = scope ? eq(rescueTeams.incidentId, scope.id) : undefined
  const teamsRaw = await db
    .select()
    .from(rescueTeams)
    .where(teamWhere)
    .orderBy(desc(rescueTeams.createdAt))

  const activeIncidents = scope ? [scope] : []

  // Load shelters near the incident/province
  const shelterProvince = scope?.province ?? session?.user?.province ?? null
  const sheltersRaw = await db
    .select({
      id: infrastructures.id,
      name: infrastructures.name,
      capacity: infrastructures.capacity,
      occupancy: infrastructures.occupancy,
      province: infrastructures.province,
    })
    .from(infrastructures)
    .where(
      and(
        inArray(infrastructures.type, ['shelter', 'assembly', 'temporary_health_post']),
        shelterProvince ? eq(infrastructures.province, shelterProvince) : undefined
      )
    )

  // Query help requests with their assignments and member details
  const reqWhere = scope ? eq(helpRequests.incidentId, scope.id) : undefined
  const requestsRaw = await db
    .select({
      id: helpRequests.id,
      requestType: helpRequests.requestType,
      priority: helpRequests.priority,
      status: helpRequests.status,
      description: helpRequests.description,
      observedAt: helpRequests.observedAt,
      memberId: helpRequests.memberId,
      memberPrefix: householdMembers.prefix,
      memberFirst: householdMembers.firstName,
      memberLast: householdMembers.lastName,
      memberPhone: householdMembers.phone,
      memberAge: householdMembers.age,
      memberCond: householdMembers.cond,
      memberLifeSupport: householdMembers.lifeSupport,
      memberHno: householdMembers.hno,
      memberVillage: householdMembers.village,
      memberVillno: householdMembers.villno,
      memberTambon: householdMembers.tambon,
      memberAmphoe: householdMembers.amphoe,
      lat: helpRequests.lat,
      lng: helpRequests.lng,
      assignmentId: caseAssignments.id,
      rescueTeamId: caseAssignments.rescueTeamId,
      assignedTeam: caseAssignments.assignedTeam,
      assignmentStatus: caseAssignments.status,
      notes: caseAssignments.notes,
    })
    .from(helpRequests)
    .innerJoin(householdMembers, eq(helpRequests.memberId, householdMembers.id))
    .leftJoin(caseAssignments, eq(helpRequests.id, caseAssignments.helpRequestId))
    .where(reqWhere ? and(reqWhere) : undefined)
    .orderBy(desc(helpRequests.createdAt), desc(caseAssignments.updatedAt))

  const teamList: RescueTeam[] = teamsRaw.map((t) => ({
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

  const shelters = sheltersRaw.map((s) => ({
    id: s.id,
    name: s.name,
    capacity: s.capacity,
    occupancy: s.occupancy ?? 0,
    province: s.province,
  }))

  const latestRequests = new Map<string, (typeof requestsRaw)[number]>()
  for (const request of requestsRaw) {
    if (!latestRequests.has(request.id)) {
      latestRequests.set(request.id, request)
    }
  }

  const requests = Array.from(latestRequests.values()).map((r) => {
    const nameParts = [r.memberPrefix, r.memberFirst, r.memberLast].filter(Boolean)
    const memberName = nameParts.join(' ') || 'ไม่ระบุชื่อ'

    return {
      id: r.id,
      requestType: r.requestType,
      priority: r.priority,
      status: r.status,
      description: r.description ?? '',
      observedAt: r.observedAt ? new Date(r.observedAt).toISOString() : '',
      memberId: r.memberId ?? '',
      memberName,
      memberPhone: r.memberPhone ?? '',
      memberAge: r.memberAge,
      memberCond: r.memberCond ?? '',
      memberLifeSupport: Array.isArray(r.memberLifeSupport) ? (r.memberLifeSupport as string[]) : [],
      memberHno: r.memberHno ?? '',
      memberVillage: r.memberVillage ?? '',
      memberVillno: r.memberVillno ?? '',
      memberTambon: r.memberTambon ?? '',
      memberAmphoe: r.memberAmphoe ?? '',
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      assignmentId: r.assignmentId ?? null,
      rescueTeamId: r.rescueTeamId ?? null,
      assignedTeam: r.assignedTeam ?? '',
      assignmentStatus: r.assignmentStatus ?? '',
      notes: r.notes ?? '',
    }
  })

  // Load all vulnerable persons for on-site picker search
  const vulnerablePersonsRaw = await db
    .select({
      id: householdMembers.id,
      prefix: householdMembers.prefix,
      firstName: householdMembers.firstName,
      lastName: householdMembers.lastName,
      phone: householdMembers.phone,
      age: householdMembers.age,
      cond: householdMembers.cond,
      lifeSupport: householdMembers.lifeSupport,
      village: householdMembers.village,
      tambon: householdMembers.tambon,
      amphoe: householdMembers.amphoe,
      province: householdMembers.province,
      type: householdMembers.type,
      lat: householdMembers.lat,
      lng: householdMembers.lng,
    })
    .from(householdMembers)
    .where(and(eq(householdMembers.followUpStatus, 'needs_help'), isNull(householdMembers.deletedAt)))
    .limit(200)

  const vulnerablePersons = vulnerablePersonsRaw.map((p) => {
    const nameParts = [p.prefix, p.firstName, p.lastName].filter(Boolean)
    const name = nameParts.join(' ') || 'ไม่ระบุชื่อ'
    return {
      id: p.id,
      name,
      phone: p.phone ?? '',
      age: p.age,
      cond: p.cond ?? '',
      lifeSupport: Array.isArray(p.lifeSupport) ? (p.lifeSupport as string[]) : [],
      village: p.village ?? '',
      tambon: p.tambon ?? '',
      amphoe: p.amphoe ?? '',
      province: p.province ?? '',
      type: p.type ?? '',
      lat: p.lat ? Number(p.lat) : null,
      lng: p.lng ? Number(p.lng) : null,
    }
  })

  return (
    <RescueMissionsClient
      teams={teamList}
      shelters={shelters}
      requests={requests}
      vulnerablePersons={vulnerablePersons}
      activeIncidents={activeIncidents}
      incidentId={scope?.id ?? null}
      role={role}
    />
  )
}
