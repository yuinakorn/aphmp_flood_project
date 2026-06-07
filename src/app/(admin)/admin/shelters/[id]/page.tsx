import { notFound, redirect } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { incidents, infrastructures, rescueTeams, shelterZones } from '@/db/schema'
import { getActiveIncident, isNationalRole } from '@/lib/incident-scope'
import { canAccessShelter } from '@/lib/shelter-access'
import { ShelterDetail } from './ShelterDetail'
import type { RescueTeam, RescueTeamStatus, RescueTeamType } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ShelterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params

  const db = getDb()
  const [shelter] = await db.select().from(infrastructures).where(eq(infrastructures.id, id))
  if (!shelter || !['shelter', 'assembly'].includes(shelter.type)) {
    notFound()
  }

  // province guard — เจ้าหน้าที่ (non-national) เปิดศูนย์ข้ามจังหวัดไม่ได้
  if (!isNationalRole(session.user?.role) && shelter.province !== (session.user?.province ?? null)) {
    notFound()
  }

  // ผู้รับผิดชอบประจำศูนย์ (shelter_manager) เข้าได้เฉพาะศูนย์ที่ตนดูแล
  const userId = typeof session.user?.id === 'string' ? session.user.id : null
  if (!(await canAccessShelter(session.user?.role, userId, id))) {
    notFound()
  }

  const scope = await getActiveIncident(session.user?.role, session.user?.province ?? null)
  const shelterProvince = shelter.province ?? null

  const [zones, teamsRaw] = await Promise.all([
    db.select().from(shelterZones).where(eq(shelterZones.shelterId, id)).orderBy(asc(shelterZones.sortOrder), asc(shelterZones.createdAt)),
    db.select({
      id: rescueTeams.id,
      incidentId: rescueTeams.incidentId,
      name: rescueTeams.name,
      teamType: rescueTeams.teamType,
      contact: rescueTeams.contact,
      zone: rescueTeams.zone,
      status: rescueTeams.status,
      lat: rescueTeams.lat,
      lng: rescueTeams.lng,
      registeredBy: rescueTeams.registeredBy,
    })
      .from(rescueTeams)
      .leftJoin(incidents, eq(rescueTeams.incidentId, incidents.id))
      .where(and(
        scope ? eq(rescueTeams.incidentId, scope.id) : undefined,
        shelterProvince ? eq(incidents.province, shelterProvince) : undefined,
      ))
      .orderBy(desc(rescueTeams.createdAt)),
  ])

  const teams: RescueTeam[] = teamsRaw.map((t) => ({
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

  const canEdit = ['admin', 'officer', 'eoc', 'ems', 'ddpm', 'shelter_manager'].includes(session.user?.role ?? '')

  return (
    <ShelterDetail
      shelter={{
        id: shelter.id,
        name: shelter.name,
        type: shelter.type,
        province: shelter.province ?? null,
        capacity: shelter.capacity ?? null,
        bedriddenCapacity: shelter.bedriddenCapacity ?? null,
        oxygenSupport: shelter.oxygenSupport ?? false,
        wheelchairSupport: shelter.wheelchairSupport ?? false,
        electricitySupport: shelter.electricitySupport ?? false,
        contact: shelter.contact ?? null,
        lat: Number(shelter.lat),
        lng: Number(shelter.lng),
      }}
      zones={zones.map((z) => ({
        id: z.id,
        shelterId: z.shelterId,
        name: z.name,
        description: z.description,
        sortOrder: z.sortOrder,
      }))}
      teams={teams}
      canEdit={canEdit}
    />
  )
}
