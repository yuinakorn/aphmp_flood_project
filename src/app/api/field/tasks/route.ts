import { NextRequest, NextResponse } from 'next/server'
import { and, asc, isNotNull, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { classifyRisk } from '@/lib/geo'
import { canWriteFieldData, composeName, forbidden, numberFromDb, parseBbox, unauthorized } from '@/lib/field-api'
import { householdMembers } from '@/db/schema'
import type { FollowUpStatus, MedicalPriority, RiskLevel } from '@/types'
import floodPointsData from '../../../../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

const riskOrder: Record<RiskLevel, number> = { flood: 0, near: 1, safe: 2 }
const priorityOrder: Record<MedicalPriority, number> = { A: 0, B: 1, C: 2 }
const statusOrder: Record<FollowUpStatus, number> = {
  needs_help: 0,
  pending: 1,
  contacted: 2,
  referred: 3,
  moved: 4,
  closed: 5,
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const { searchParams } = new URL(req.url)
  const bbox = parseBbox(searchParams.get('bbox'))
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)

  const db = getDb()
  const rows = await db
    .select()
    .from(householdMembers)
    .where(and(isNotNull(householdMembers.type), isNull(householdMembers.deletedAt)))
    .orderBy(asc(householdMembers.createdAt))

  const tasks = rows
    .map((p) => {
      const lat = numberFromDb(p.lat)
      const lng = numberFromDb(p.lng)
      const risk = lat !== null && lng !== null ? classifyRisk(lat, lng, floodCoords) : 'safe'
      return {
        id: p.id,
        name: composeName(p.prefix, p.firstName, p.lastName),
        type: p.type,
        label: p.label,
        age: p.age,
        cond: p.cond,
        equipment: p.equipment,
        village: p.village,
        tambon: p.tambon,
        amphoe: p.amphoe,
        lat,
        lng,
        risk,
        medicalPriority: (p.medicalPriority ?? 'C') as MedicalPriority,
        followUpStatus: (p.followUpStatus ?? 'pending') as FollowUpStatus,
        careUnit: p.careUnit,
        caregiverPhone: p.caregiverPhone,
        lastContactedAt: p.lastContactedAt?.toISOString() ?? null,
        lastVisitedAt: p.lastVisitedAt?.toISOString() ?? null,
        lastKnownStatus: p.lastKnownStatus,
      }
    })
    .filter((p) => {
      if (status && p.followUpStatus !== status) return false
      if (!bbox || p.lat === null || p.lng === null) return true
      return (
        p.lng >= bbox.minLng &&
        p.lng <= bbox.maxLng &&
        p.lat >= bbox.minLat &&
        p.lat <= bbox.maxLat
      )
    })
    .sort((a, b) => {
      const byRisk = riskOrder[a.risk] - riskOrder[b.risk]
      if (byRisk) return byRisk
      const byPriority = priorityOrder[a.medicalPriority] - priorityOrder[b.medicalPriority]
      if (byPriority) return byPriority
      return statusOrder[a.followUpStatus] - statusOrder[b.followUpStatus]
    })
    .slice(0, limit)

  return NextResponse.json({
    data: tasks,
    meta: {
      total: tasks.length,
      generatedAt: new Date().toISOString(),
    },
  })
}
