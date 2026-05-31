import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  composeName,
  maskNationalId,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { householdMembers, shelterAdmissions, shelterZones, infrastructures } from '@/db/schema'
import { getActiveIncidentId } from '@/lib/incident-scope'
import { getShelterAccessScope } from '@/lib/shelter-access'

export interface RosterPersonRow {
  id: string
  status: string
  zoneId: string | null
  zoneName: string | null
  intakePoint: string | null
  broughtByText: string | null
  exitReason: string | null
  exitDestination: string | null
  notes: string | null
  admittedAt: string | null
  dischargedAt: string | null
  person: {
    id: string
    name: string
    nationalIdMasked: string | null
    birthDate: string | null
    age: number | null
    sex: string | null
    nationality: string | null
    phone: string | null
    hno: string | null
    villno: string | null
    tambon: string | null
    conditions: string | null
    foodAllergy: string | null
    drugAllergy: string | null
    isVulnerable: boolean
  } | null
}

export interface RosterShelter {
  shelterId: string
  shelterName: string
  summary: { cumulative: number; current: number; discharged: number; toHospital: number }
  rows: RosterPersonRow[]
}

// GET /api/eoc/roster?status=&shelterId=
// roster ผู้พักพิงรวมทุกศูนย์ในเหตุการณ์ที่ scope อยู่ — จำกัดตามสิทธิ์ผู้ใช้ (shelter_staff)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const incidentId = await getActiveIncidentId()
  if (!incidentId) return badRequest('no active incident scope')

  const scope = await getShelterAccessScope(session.user.role, sessionUserId(session))
  // scoped user ที่ไม่มีศูนย์ในความรับผิดชอบ → ว่าง
  if (!scope.all && scope.shelterIds.length === 0) {
    return NextResponse.json({ incidentId, shelters: [], totals: emptyTotals() })
  }

  const sp = new URL(req.url).searchParams
  const status = sp.get('status') // 'current' | specific | null=all
  const shelterIdParam = sp.get('shelterId')

  const conditions = [eq(shelterAdmissions.incidentId, incidentId)]
  if (status === 'current') conditions.push(eq(shelterAdmissions.status, 'admitted'))
  else if (status && status !== 'all') conditions.push(eq(shelterAdmissions.status, status))

  // จำกัดศูนย์ตามสิทธิ์ + พารามิเตอร์
  let allowedShelterIds: string[] | null = scope.all ? null : scope.shelterIds
  if (shelterIdParam) {
    if (allowedShelterIds && !allowedShelterIds.includes(shelterIdParam)) {
      return NextResponse.json({ incidentId, shelters: [], totals: emptyTotals() })
    }
    allowedShelterIds = [shelterIdParam]
  }
  if (allowedShelterIds) conditions.push(inArray(shelterAdmissions.shelterId, allowedShelterIds))

  const db = getDb()
  const rows = await db
    .select({
      adm: shelterAdmissions,
      zoneName: shelterZones.name,
      shelterName: infrastructures.name,
      m: householdMembers,
    })
    .from(shelterAdmissions)
    .leftJoin(shelterZones, eq(shelterAdmissions.zoneId, shelterZones.id))
    .leftJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
    .leftJoin(householdMembers, eq(shelterAdmissions.memberId, householdMembers.id))
    .where(and(...conditions))
    .orderBy(desc(shelterAdmissions.admittedAt))

  const byShelter = new Map<string, RosterShelter>()
  for (const r of rows) {
    const sid = r.adm.shelterId
    let group = byShelter.get(sid)
    if (!group) {
      group = {
        shelterId: sid,
        shelterName: r.shelterName ?? 'ไม่ระบุชื่อศูนย์',
        summary: { cumulative: 0, current: 0, discharged: 0, toHospital: 0 },
        rows: [],
      }
      byShelter.set(sid, group)
    }
    group.summary.cumulative += 1
    if (r.adm.status === 'admitted') group.summary.current += 1
    if (r.adm.status === 'discharged') group.summary.discharged += 1
    if (r.adm.exitReason === 'admitted_hospital') group.summary.toHospital += 1

    group.rows.push({
      id: r.adm.id,
      status: r.adm.status,
      zoneId: r.adm.zoneId,
      zoneName: r.zoneName,
      intakePoint: r.adm.intakePoint,
      broughtByText: r.adm.broughtByText,
      exitReason: r.adm.exitReason,
      exitDestination: r.adm.exitDestination,
      notes: r.adm.notes,
      admittedAt: r.adm.admittedAt ? r.adm.admittedAt.toISOString() : null,
      dischargedAt: r.adm.dischargedAt ? r.adm.dischargedAt.toISOString() : null,
      person: r.m
        ? {
            id: r.m.id,
            name: composeName(r.m.prefix, r.m.firstName, r.m.lastName),
            nationalIdMasked: maskNationalId(r.m.nationalId),
            birthDate: r.m.birthDate,
            age: r.m.age,
            sex: r.m.sex,
            nationality: r.m.nationality,
            phone: r.m.phone,
            hno: r.m.hno,
            villno: r.m.villno,
            tambon: r.m.tambon,
            conditions: r.m.cond,
            foodAllergy: r.m.foodAllergy,
            drugAllergy: r.m.drugAllergy,
            isVulnerable: !!r.m.type,
          }
        : null,
    })
  }

  const shelters = Array.from(byShelter.values()).sort((a, b) =>
    a.shelterName.localeCompare(b.shelterName, 'th'),
  )
  const totals = shelters.reduce(
    (acc, s) => ({
      cumulative: acc.cumulative + s.summary.cumulative,
      current: acc.current + s.summary.current,
      discharged: acc.discharged + s.summary.discharged,
      toHospital: acc.toHospital + s.summary.toHospital,
    }),
    emptyTotals(),
  )

  return NextResponse.json({ incidentId, shelters, totals })
}

function emptyTotals() {
  return { cumulative: 0, current: 0, discharged: 0, toHospital: 0 }
}
