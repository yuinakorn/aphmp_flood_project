import { notFound, redirect } from 'next/navigation'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { infrastructures, rescueTeams, shelterZones } from '@/db/schema'
import { getActiveIncident } from '@/lib/incident-scope'
import { ShelterDetail } from './ShelterDetail'
import type { RescueTeam, RescueTeamStatus, RescueTeamType } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ShelterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params

  const db = getDb()
  const [shelter] = await db.select().from(infrastructures).where(eq(infrastructures.id, id))
  if (!shelter || !inArray(infrastructures.type, ['shelter', 'assembly'])) {
    notFound()
  }

  const scope = await getActiveIncident(session.user?.role)
  const [zones, teamsRaw] = await Promise.all([
    db.select().from(shelterZones).where(eq(shelterZones.shelterId, id)).orderBy(asc(shelterZones.sortOrder), asc(shelterZones.createdAt)),
    db.select().from(rescueTeams)
      .where(scope ? and(eq(rescueTeams.incidentId, scope.id)) : undefined)
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

  const canEdit = ['admin', 'officer', 'eoc', 'ems', 'ddpm'].includes(session.user?.role ?? '')

  return (
    <ShelterDetail
      shelter={{
        id: shelter.id,
        name: shelter.name,
        type: shelter.type,
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
