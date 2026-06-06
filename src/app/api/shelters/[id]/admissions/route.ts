import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canTriage,
  composeName,
  forbidden,
  isUuid,
  maskNationalId,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { householdMembers, hospitalReferrals, infrastructures, shelterAdmissions, shelterZones } from '@/db/schema'
import { getActiveIncidentId } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'

// GET /api/shelters/:id/admissions?zoneId=&status=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const sp = new URL(req.url).searchParams
  const zoneId = sp.get('zoneId')
  const status = sp.get('status') // 'current' | 'all' | specific
  // ?scope=all → ไม่ filter; ค่า default → ผูกกับ incident-scope cookie (ถ้ามี)
  const scopeMode = sp.get('scope') ?? 'auto'

  const conditions = [eq(shelterAdmissions.shelterId, id)]
  if (zoneId && isUuid(zoneId)) conditions.push(eq(shelterAdmissions.zoneId, zoneId))
  if (status === 'current') conditions.push(eq(shelterAdmissions.status, 'admitted'))
  else if (status && status !== 'all') conditions.push(eq(shelterAdmissions.status, status))

  if (scopeMode !== 'all') {
    const activeIncidentId = await getActiveIncidentId()
    if (activeIncidentId) conditions.push(eq(shelterAdmissions.incidentId, activeIncidentId))
  }

  const db = getDb()
  const rows = await db
    .select({
      adm: shelterAdmissions,
      zoneName: shelterZones.name,
      m: householdMembers,
    })
    .from(shelterAdmissions)
    .leftJoin(shelterZones, eq(shelterAdmissions.zoneId, shelterZones.id))
    .leftJoin(householdMembers, eq(shelterAdmissions.memberId, householdMembers.id))
    .where(and(...conditions))
    .orderBy(desc(shelterAdmissions.admittedAt))

  // ดึงสถานะการส่งต่อ (referral) ล่าสุดต่อ admission — ให้ฝั่งศูนย์เห็นว่าปลายทางรับหรือยัง
  const admIds = rows.map((r) => r.adm.id)
  const refByAdm = new Map<string, { status: string; facility: string | null }>()
  if (admIds.length > 0) {
    const refRows = await db
      .select({
        admissionId: hospitalReferrals.admissionId,
        status: hospitalReferrals.status,
        referredAt: hospitalReferrals.referredAt,
        facilityName: infrastructures.name,
        facilityText: hospitalReferrals.toFacilityText,
      })
      .from(hospitalReferrals)
      .leftJoin(infrastructures, eq(hospitalReferrals.toFacilityId, infrastructures.id))
      .where(inArray(hospitalReferrals.admissionId, admIds))
      .orderBy(desc(hospitalReferrals.referredAt))
    for (const rr of refRows) {
      if (rr.admissionId && !refByAdm.has(rr.admissionId)) {
        refByAdm.set(rr.admissionId, { status: rr.status, facility: rr.facilityName ?? rr.facilityText ?? null })
      }
    }
  }

  const data = rows.map((r) => ({
    id: r.adm.id,
    status: r.adm.status,
    zoneId: r.adm.zoneId,
    zoneName: r.zoneName,
    intakePoint: r.adm.intakePoint,
    broughtByText: r.adm.broughtByText,
    broughtByTeamId: r.adm.broughtByTeamId,
    exitReason: r.adm.exitReason,
    exitDestination: r.adm.exitDestination ?? refByAdm.get(r.adm.id)?.facility ?? null,
    referralStatus: refByAdm.get(r.adm.id)?.status ?? null,
    notes: r.adm.notes,
    admittedAt: r.adm.admittedAt,
    dischargedAt: r.adm.dischargedAt,
    person: r.m
      ? {
          id: r.m.id,
          name: composeName(r.m.prefix, r.m.firstName, r.m.lastName),
          prefix: r.m.prefix,
          firstName: r.m.firstName,
          lastName: r.m.lastName,
          nationalIdMasked: maskNationalId(r.m.nationalId, 5), // 5 หลักท้าย — ยืนยันตัวตนระดับหนึ่ง
          birthDate: r.m.birthDate,
          age: r.m.age,
          sex: r.m.sex,
          nationality: r.m.nationality,
          phone: r.m.phone,
          hno: r.m.hno,
          villno: r.m.villno,
          tambon: r.m.tambon,
          amphoe: r.m.amphoe,
          conditions: r.m.cond,
          foodAllergy: r.m.foodAllergy,
          drugAllergy: r.m.drugAllergy,
          equipment: r.m.equipment,
          lifeSupport: r.m.lifeSupport,
          vulnerableType: r.m.type,
          vulnerableLabel: r.m.label,
          isVulnerable: !!r.m.type,
        }
      : null,
  }))

  return NextResponse.json({ data })
}

// POST /api/shelters/:id/admissions
// body: { zoneId?, memberId?, person?: { ... }, intakePoint?, broughtByTeamId?, broughtByText?, notes? }
// ถ้า memberId ไม่ส่ง → สร้าง householdMember walk-in อัตโนมัติจาก person fields
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const db = getDb()

  let memberId = typeof body.memberId === 'string' && isUuid(body.memberId) ? body.memberId : null

  if (!memberId) {
    const person = (body.person ?? {}) as Record<string, unknown>
    const firstName = typeof person.firstName === 'string' ? person.firstName.trim() : ''
    const lastName = typeof person.lastName === 'string' ? person.lastName.trim() : ''
    if (!firstName) return badRequest('person.firstName is required for walk-in')

    const [created] = await db
      .insert(householdMembers)
      .values({
        prefix: typeof person.prefix === 'string' ? person.prefix : null,
        firstName,
        lastName,
        nationalId: typeof person.nationalId === 'string' ? person.nationalId : null,
        birthDate: typeof person.birthDate === 'string' ? person.birthDate : null,
        nationality: typeof person.nationality === 'string' ? person.nationality : null,
        sex: typeof person.sex === 'string' ? person.sex : null,
        age: typeof person.age === 'number' ? person.age : null,
        phone: typeof person.phone === 'string' ? person.phone : null,
        hno: typeof person.hno === 'string' ? person.hno : null,
        villno: typeof person.villno === 'string' ? person.villno : null,
        tambon: typeof person.tambon === 'string' ? person.tambon : null,
        amphoe: typeof person.amphoe === 'string' ? person.amphoe : null,
        province: typeof person.province === 'string' ? person.province : null,
        cond: typeof person.conditions === 'string' ? person.conditions : null,
        foodAllergy: typeof person.foodAllergy === 'string' ? person.foodAllergy : null,
        drugAllergy: typeof person.drugAllergy === 'string' ? person.drugAllergy : null,
        type: typeof person.vulnerableType === 'string' ? person.vulnerableType : null,
        sourceSystem: 'walkin',
        createdBy: sessionUserId(session),
      })
      .returning({ id: householdMembers.id })

    memberId = created.id
  }

  // ป้องกันรับเข้าซ้ำ — เช็คว่ามี admission ที่ admitted อยู่แล้วหรือไม่ (ทั้งในศูนย์เดียวกันและศูนย์อื่น)
  const [activeAdm] = await db
    .select({ shelterName: infrastructures.name, shelterId: shelterAdmissions.shelterId })
    .from(shelterAdmissions)
    .leftJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
    .where(and(eq(shelterAdmissions.memberId, memberId), eq(shelterAdmissions.status, 'admitted')))
    .limit(1)

  if (activeAdm) {
    const name = activeAdm.shelterName ?? 'ศูนย์พักพิงอื่น'
    const isSame = activeAdm.shelterId === id
    return NextResponse.json(
      { error: isSame ? `ผู้พักพิงรายนี้อยู่ในศูนย์นี้แล้ว` : `ผู้พักพิงรายนี้กำลังพักอยู่ที่ "${name}" อยู่แล้ว กรุณาย้ายออกจากศูนย์เดิมก่อน` },
      { status: 409 }
    )
  }

  const zoneId = typeof body.zoneId === 'string' && isUuid(body.zoneId) ? body.zoneId : null
  const incidentId = await getActiveIncidentId()

  const [created] = await db
    .insert(shelterAdmissions)
    .values({
      shelterId: id,
      zoneId,
      memberId,
      incidentId,
      status: 'admitted',
      intakePoint: typeof body.intakePoint === 'string' ? body.intakePoint : null,
      broughtByTeamId:
        typeof body.broughtByTeamId === 'string' && isUuid(body.broughtByTeamId) ? body.broughtByTeamId : null,
      broughtByText: typeof body.broughtByText === 'string' ? body.broughtByText : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
      admittedBy: sessionUserId(session),
    })
    .returning()

  void audit(req, session, {
    action: 'create_admission',
    entity: 'shelter_admission',
    targetId: created.id,
    metadata: { shelterId: id, walkin: !body.memberId },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
