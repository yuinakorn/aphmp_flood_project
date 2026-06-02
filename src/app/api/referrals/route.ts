/**
 * GET  /api/referrals?status=&facilityId=&incidentId=  — รายการส่งต่อ (inbox ปลายทาง)
 * POST /api/referrals  — สร้างการส่งต่อจากศูนย์พักพิง → รพ. + อัปเดตสถานะ admission เป็น transferred
 *
 * scope จังหวัด: non-national เห็น/สร้างได้เฉพาะเหตุการณ์ในจังหวัดสังกัด (อิงศูนย์ต้นทาง)
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, sessionUserId, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { hospitalReferrals, shelterAdmissions, infrastructures, householdMembers } from '@/db/schema'
import type { UserRole } from '@/types'

const VALID_PRIORITY = new Set(['low', 'normal', 'high', 'critical'])

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role as UserRole)) return forbidden()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const facilityId = searchParams.get('facilityId')
  const incidentId = searchParams.get('incidentId')

  const fromShelter = alias(infrastructures, 'from_shelter')
  const toFacility = alias(infrastructures, 'to_facility')

  const conds = []
  if (status) conds.push(eq(hospitalReferrals.status, status))
  if (facilityId && isUuid(facilityId)) conds.push(eq(hospitalReferrals.toFacilityId, facilityId))
  if (incidentId && isUuid(incidentId)) conds.push(eq(hospitalReferrals.incidentId, incidentId))
  // province scope (non-national) — อิงจังหวัดของศูนย์ต้นทาง
  const national = isNationalRole(session.user.role)
  if (!national) {
    const prov = session.user.province ?? null
    if (!prov) return NextResponse.json({ data: [] })
    conds.push(eq(fromShelter.province, prov))
  }

  const db = getDb()
  const rows = await db
    .select({
      id: hospitalReferrals.id,
      incidentId: hospitalReferrals.incidentId,
      admissionId: hospitalReferrals.admissionId,
      memberId: hospitalReferrals.memberId,
      fromShelterId: hospitalReferrals.fromShelterId,
      fromShelterName: fromShelter.name,
      toFacilityId: hospitalReferrals.toFacilityId,
      toFacilityName: toFacility.name,
      toFacilityText: hospitalReferrals.toFacilityText,
      personName: hospitalReferrals.personName,
      reason: hospitalReferrals.reason,
      priority: hospitalReferrals.priority,
      status: hospitalReferrals.status,
      notes: hospitalReferrals.notes,
      referredAt: hospitalReferrals.referredAt,
      updatedAt: hospitalReferrals.updatedAt,
    })
    .from(hospitalReferrals)
    .leftJoin(fromShelter, eq(hospitalReferrals.fromShelterId, fromShelter.id))
    .leftJoin(toFacility, eq(hospitalReferrals.toFacilityId, toFacility.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(hospitalReferrals.referredAt))

  const data = rows.map((r) => ({
    ...r,
    referredAt: (r.referredAt as unknown as Date)?.toISOString?.() ?? '',
    updatedAt: r.updatedAt ? (r.updatedAt as unknown as Date).toISOString() : null,
  }))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role as UserRole)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const admissionId = typeof body.admissionId === 'string' ? body.admissionId : ''
  if (!isUuid(admissionId)) return badRequest('admissionId is required')

  const toFacilityId = typeof body.toFacilityId === 'string' && isUuid(body.toFacilityId) ? body.toFacilityId : null
  const toFacilityText = typeof body.toFacilityText === 'string' && body.toFacilityText.trim() ? body.toFacilityText.trim() : null
  if (!toFacilityId && !toFacilityText) return badRequest('ต้องระบุโรงพยาบาลปลายทาง')

  const priority = typeof body.priority === 'string' && VALID_PRIORITY.has(body.priority) ? body.priority : 'normal'
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null

  const db = getDb()
  const [adm] = await db.select().from(shelterAdmissions).where(eq(shelterAdmissions.id, admissionId)).limit(1)
  if (!adm) return NextResponse.json({ error: 'ไม่พบรายการรับเข้า' }, { status: 404 })

  // ชื่อผู้ป่วย snapshot (จากทะเบียนถ้ามี member)
  let personName: string | null = null
  if (adm.memberId) {
    const [m] = await db
      .select({ prefix: householdMembers.prefix, firstName: householdMembers.firstName, lastName: householdMembers.lastName })
      .from(householdMembers)
      .where(eq(householdMembers.id, adm.memberId))
      .limit(1)
    if (m) personName = [m.prefix, m.firstName, m.lastName].filter(Boolean).join(' ')
  }

  // ชื่อ รพ.ปลายทาง (สำหรับ exitDestination)
  let facilityName = toFacilityText
  if (toFacilityId) {
    const [f] = await db.select({ name: infrastructures.name }).from(infrastructures).where(eq(infrastructures.id, toFacilityId)).limit(1)
    facilityName = f?.name ?? facilityName
  }

  const [referral] = await db
    .insert(hospitalReferrals)
    .values({
      incidentId: adm.incidentId,
      admissionId: adm.id,
      memberId: adm.memberId,
      fromShelterId: adm.shelterId,
      toFacilityId,
      toFacilityText,
      personName,
      reason,
      priority,
      status: 'pending',
      referredBy: sessionUserId(session),
    })
    .returning()

  // อัปเดต admission → ส่งต่อ รพ.
  await db
    .update(shelterAdmissions)
    .set({ status: 'transferred', exitReason: 'admitted_hospital', exitDestination: facilityName, dischargedAt: new Date() })
    .where(eq(shelterAdmissions.id, admissionId))

  void audit(req, session, {
    action: 'create_referral',
    entity: 'hospital_referral',
    targetId: referral.id,
    metadata: { admissionId, fromShelterId: adm.shelterId, toFacilityId, priority },
  })

  return NextResponse.json({ data: referral }, { status: 201 })
}
