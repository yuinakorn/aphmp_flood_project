/**
 * GET  /api/vulnerable/[id] — ดูรายละเอียดคนเดียว + PDPA mask เหมือน list
 * PATCH /api/vulnerable/[id] — officer/admin อัปเดต followUpStatus, careUnit, assignedVhvId, medicalPriority
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { isNationalRole } from '@/lib/incident-scope'
import { getDb } from '@/lib/db'
import { classifyRiskByPolygons } from '@/lib/geo'
import { loadRiskZonesByProvince, zonesFor } from '@/lib/flood-risk'
import {
  badRequest,
  canWriteFieldData,
  composeName,
  forbidden,
  isUuid,
  numberFromDb,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { accessLog, households, householdMembers } from '@/db/schema'
import type { UserRole } from '@/types'

const FULL_ACCESS_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm'])
function canViewFull(role?: UserRole): role is UserRole {
  return !!role && FULL_ACCESS_ROLES.has(role)
}

// -----------------------------------------------------------------------
// GET
// -----------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  const role = (session?.user?.role ?? 'anonymous') as UserRole
  const fullAccess = canViewFull(role)

  const db = getDb()
  const [p] = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.id, id))
    .limit(1)

  if (!p || p.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // province guard — เจ้าหน้าที่ (non-national) เปิดดูได้เฉพาะคนในจังหวัดสังกัด
  if (session?.user && !isNationalRole(role) && p.province !== (session.user.province ?? null)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const lat = numberFromDb(p.lat)
  const lng = numberFromDb(p.lng)
  const zonesByProvince = await loadRiskZonesByProvince()
  const risk =
    lat !== null && lng !== null
      ? classifyRiskByPolygons(lat, lng, zonesFor(zonesByProvince, p.province))
      : 'safe'

  if (fullAccess && session?.user?.id) {
    void db
      .insert(accessLog)
      .values({ userId: session.user.id, action: 'view_vulnerable', targetId: p.id, ip: null })
      .catch(() => {})
  }

  if (!fullAccess) {
    return NextResponse.json({
      data: {
        id: p.id,
        type: p.type,
        label: p.label,
        tambon: p.tambon,
        amphoe: p.amphoe,
        province: p.province,
        risk,
        followUpStatus: p.followUpStatus,
        medicalPriority: p.medicalPriority,
        lat: lat !== null ? Math.round(lat * 100) / 100 : null,
        lng: lng !== null ? Math.round(lng * 100) / 100 : null,
      },
    })
  }

  return NextResponse.json({
    data: {
      id: p.id,
      name: composeName(p.prefix, p.firstName, p.lastName),
      prefix: p.prefix,
      firstName: p.firstName,
      lastName: p.lastName,
      type: p.type,
      label: p.label,
      age: p.age,
      cond: p.cond,
      equipment: p.equipment,
      householdId: p.householdId,
      hno: p.hno,
      villno: p.villno,
      village: p.village,
      tambon: p.tambon,
      amphoe: p.amphoe,
      province: p.province,
      lat,
      lng,
      lifeSupport: p.lifeSupport ?? null,
      caregiverPhone: p.caregiverPhone,
      careUnit: p.careUnit,
      assignedVhvId: p.assignedVhvId,
      medicalPriority: p.medicalPriority,
      followUpStatus: p.followUpStatus,
      lastContactedAt: p.lastContactedAt?.toISOString() ?? null,
      lastVisitedAt: p.lastVisitedAt?.toISOString() ?? null,
      lastKnownStatus: p.lastKnownStatus,
      consent: p.consent,
      sourceSystem: p.sourceSystem,
      sourceUnit: p.sourceUnit,
      sourceSyncedAt: p.sourceSyncedAt?.toISOString() ?? null,
      createdAt: p.createdAt?.toISOString() ?? null,
      updatedAt: p.updatedAt?.toISOString() ?? null,
      risk,
    },
  })
}

// -----------------------------------------------------------------------
// PATCH — อัปเดตเฉพาะ field ที่ officer ควรแตะได้
// -----------------------------------------------------------------------

const VALID_FOLLOW_UP = new Set([
  'pending', 'contacted', 'needs_help', 'moved', 'referred', 'closed',
])
const VALID_PRIORITIES = new Set(['A', 'B', 'C'])
const LIFE_SUPPORT_CODES = new Set([
  'oxygen', 'dialysis_capd', 'dialysis_hd', 'ventilator', 'anti_seizure', 'feeding_tube',
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof householdMembers.$inferInsert> = {
    updatedAt: new Date(),
  }

  if ('followUpStatus' in body) {
    if (!VALID_FOLLOW_UP.has(body.followUpStatus as string))
      return badRequest(`followUpStatus must be one of: ${[...VALID_FOLLOW_UP].join(', ')}`)
    patch.followUpStatus = body.followUpStatus as string
  }

  if ('medicalPriority' in body) {
    if (!VALID_PRIORITIES.has(body.medicalPriority as string))
      return badRequest('medicalPriority must be A, B, or C')
    patch.medicalPriority = body.medicalPriority as string
  }

  if ('careUnit' in body) {
    patch.careUnit = typeof body.careUnit === 'string' ? body.careUnit : null
  }

  if ('assignedVhvId' in body) {
    if (body.assignedVhvId !== null && !isUuid(body.assignedVhvId))
      return badRequest('assignedVhvId must be a UUID or null')
    patch.assignedVhvId = (body.assignedVhvId as string | null) ?? null
  }

  if ('lastKnownStatus' in body) {
    patch.lastKnownStatus = typeof body.lastKnownStatus === 'string' ? body.lastKnownStatus : null
  }

  if ('lastContactedAt' in body) {
    const d = body.lastContactedAt ? new Date(body.lastContactedAt as string) : null
    patch.lastContactedAt = d && !isNaN(d.getTime()) ? d : null
  }

  if ('lifeSupport' in body) {
    const ls = body.lifeSupport
    if (ls === null) {
      patch.lifeSupport = null
    } else if (
      Array.isArray(ls) &&
      ls.every((c) => typeof c === 'string' && LIFE_SUPPORT_CODES.has(c))
    ) {
      patch.lifeSupport = [...new Set(ls as string[])]
    } else {
      return badRequest('lifeSupport must be null or an array of valid codes')
    }
  }

  // พิกัดหมุด — ข้อมูลภาคสนาม (household-map principle): อสม./จนท. ที่เขียน field ได้
  // (canWriteFieldData ผ่าน guard แล้ว) แก้/ปักหมุดได้ ไม่จำกัดเฉพาะ admin/officer
  if ('lat' in body) {
    const n = body.lat === null ? null : Number(body.lat)
    if (n !== null && !Number.isFinite(n)) return badRequest('lat must be a number or null')
    patch.lat = n !== null ? String(n) : null
  }
  if ('lng' in body) {
    const n = body.lng === null ? null : Number(body.lng)
    if (n !== null && !Number.isFinite(n)) return badRequest('lng must be a number or null')
    patch.lng = n !== null ? String(n) : null
  }

  // ── core fields (admin/officer เท่านั้น) ──────────────────────────────────
  const isAdmin = session.user.role === 'admin' || session.user.role === 'officer'

  if (isAdmin) {
    if ('prefix' in body) patch.prefix = typeof body.prefix === 'string' ? body.prefix : null
    if ('firstName' in body) {
      if (typeof body.firstName !== 'string' || !body.firstName.trim())
        return badRequest('firstName is required')
      patch.firstName = body.firstName.trim()
    }
    if ('lastName' in body) {
      if (typeof body.lastName !== 'string' || !body.lastName.trim())
        return badRequest('lastName is required')
      patch.lastName = body.lastName.trim()
    }
    if ('age' in body) {
      patch.age = body.age !== null && body.age !== '' ? Number(body.age) : null
    }
    if ('type' in body) {
      const VALID_TYPES = new Set(['bedridden', 'elderly', 'disabled', 'pregnant', 'other'])
      if (!VALID_TYPES.has(body.type as string)) return badRequest('invalid type')
      patch.type = body.type as string
    }
    if ('cond' in body) patch.cond = typeof body.cond === 'string' ? body.cond : null
    if ('village' in body) patch.village = typeof body.village === 'string' ? body.village : null
    if ('tambon' in body) patch.tambon = typeof body.tambon === 'string' ? body.tambon : null
    if ('amphoe' in body) patch.amphoe = typeof body.amphoe === 'string' ? body.amphoe : null
    if ('province' in body) patch.province = typeof body.province === 'string' ? body.province : null
    if ('caregiverPhone' in body) {
      patch.caregiverPhone = typeof body.caregiverPhone === 'string' ? body.caregiverPhone : null
    }
  }

  const national = isNationalRole(session.user.role as UserRole)
  const db = getDb()

  // ── ย้ายสมาชิกไปครัวเรือนที่เลือก (admin/officer) — รับพิกัด/ที่อยู่จากบ้านปลายทาง ──
  // household-map principle: สมาชิกอยู่บ้านไหน ใช้พิกัด+ที่อยู่ของบ้านนั้น
  if (isAdmin && isUuid(body.householdId)) {
    const targetId = body.householdId as string
    const [target] = await db
      .select()
      .from(households)
      .where(
        national
          ? eq(households.id, targetId)
          : and(eq(households.id, targetId), eq(households.province, session.user.province ?? '__none__')),
      )
      .limit(1)
    if (!target) return badRequest('ไม่พบครัวเรือนที่เลือก')
    patch.householdId = target.id
    patch.hno = target.hno
    patch.villno = target.villno
    patch.village = target.villageName
    patch.tambon = target.tambon
    patch.amphoe = target.amphoe
    if (target.province) patch.province = target.province
    if (target.lat != null) patch.lat = String(target.lat)
    if (target.lng != null) patch.lng = String(target.lng)
  }

  // ถ้าไม่มี field นอกจาก updatedAt → ไม่มีอะไรอัปเดต
  if (Object.keys(patch).length === 1) return badRequest('No updatable fields provided')

  // province guard — non-national แก้ได้เฉพาะคนในจังหวัดสังกัด (ใส่เงื่อนไขใน WHERE)
  const where = national
    ? eq(householdMembers.id, id)
    : and(eq(householdMembers.id, id), eq(householdMembers.province, session.user.province ?? '__none__'))

  const [updated] = await db
    .update(householdMembers)
    .set(patch)
    .where(where)
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // household-map principle: 1 บ้าน = 1 พิกัด — แก้พิกัดคนเดียว ย้ายทั้งบ้าน
  // (sync ขึ้น households เพื่อให้หมุดบนแผนที่ขยับ + sync สมาชิกทุกคนให้ risk ตรงกัน)
  if (('lat' in patch || 'lng' in patch) && updated.householdId) {
    const coords: { lat?: string | null; lng?: string | null } = {}
    if ('lat' in patch) coords.lat = patch.lat as string | null
    if ('lng' in patch) coords.lng = patch.lng as string | null
    await db.update(households).set(coords).where(eq(households.id, updated.householdId))
    await db
      .update(householdMembers)
      .set(coords)
      .where(and(eq(householdMembers.householdId, updated.householdId), isNull(householdMembers.deletedAt)))
  }

  void db
    .insert(accessLog)
    .values({
      userId: sessionUserId(session),
      action: 'update_vulnerable',
      targetId: id,
      ip: null,
    })
    .catch(() => {})

  return NextResponse.json({ data: updated })
}

// -----------------------------------------------------------------------
// DELETE — soft delete (admin/officer)
// -----------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const national = isNationalRole(session.user.role as UserRole)
  const where = national
    ? eq(householdMembers.id, id)
    : and(eq(householdMembers.id, id), eq(householdMembers.province, session.user.province ?? '__none__'))

  const db = getDb()
  const [deleted] = await db
    .update(householdMembers)
    .set({ deletedAt: new Date() })
    .where(where)
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  void db
    .insert(accessLog)
    .values({
      userId: sessionUserId(session),
      action: 'delete_vulnerable',
      targetId: id,
      ip: null,
    })
    .catch(() => {})

  return NextResponse.json({ ok: true })
}
