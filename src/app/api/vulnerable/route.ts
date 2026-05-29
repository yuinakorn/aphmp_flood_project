/**
 * GET /api/vulnerable
 * คืนรายการกลุ่มเปราะบางจาก vulnerable_persons table (Postgres)
 *
 * PDPA mask:
 *  - anonymous / viewer → เห็นแค่ type, risk, tambon, amphoe, province — ไม่เห็นชื่อ/พิกัดแน่ชัด/เบอร์โทร
 *  - officer / admin / eoc / vhv / ems / ddpm → เห็นข้อมูลเต็ม (บันทึก audit log)
 *
 * POST /api/vulnerable
 * สร้าง record เดี่ยวแบบ manual (สำหรับ officer/admin กรอกเอง ไม่ผ่าน ingest)
 * — ส่ง batch ผ่าน /api/ingest/vulnerable แทน
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { classifyRisk } from '@/lib/geo'
import {
  badRequest,
  canWriteFieldData,
  composeName,
  forbidden,
  isUuid,
  numberFromDb,
  parseBbox,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { accessLog, vulnerablePersons } from '@/db/schema'
import type { UserRole } from '@/types'
import floodPointsData from '../../../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

// Roles ที่เห็นข้อมูลส่วนตัวได้
const FULL_ACCESS_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm'])

function canViewFull(role?: UserRole): role is UserRole {
  return !!role && FULL_ACCESS_ROLES.has(role)
}

// -----------------------------------------------------------------------
// GET
// -----------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth()
  const role = (session?.user?.role ?? 'anonymous') as UserRole
  const fullAccess = canViewFull(role)

  const { searchParams } = new URL(req.url)
  const bbox = parseBbox(searchParams.get('bbox'))
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const province = searchParams.get('province')
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000)

  const db = getDb()

  const conditions = [isNull(vulnerablePersons.deletedAt)]
  if (status) conditions.push(eq(vulnerablePersons.followUpStatus, status))
  if (priority) conditions.push(eq(vulnerablePersons.medicalPriority, priority))
  if (province) conditions.push(eq(vulnerablePersons.province, province))

  const rows = await db
    .select()
    .from(vulnerablePersons)
    .where(and(...conditions))
    .limit(limit)

  const data = rows
    .map((p) => {
      const lat = numberFromDb(p.lat)
      const lng = numberFromDb(p.lng)

      // กรอง bbox ใน-memory (ถ้ามี)
      if (bbox && lat !== null && lng !== null) {
        if (lng < bbox.minLng || lng > bbox.maxLng || lat < bbox.minLat || lat > bbox.maxLat) {
          return null
        }
      }

      const risk = lat !== null && lng !== null ? classifyRisk(lat, lng, floodCoords) : 'safe'

      if (!fullAccess) {
        // PDPA mask — anonymous/viewer เห็นแค่ aggregate context
        return {
          id: p.id,
          type: p.type,
          label: p.label,
          tambon: p.tambon,
          amphoe: p.amphoe,
          province: p.province,
          risk,
          followUpStatus: p.followUpStatus,
          medicalPriority: p.medicalPriority,
          // พิกัดปัดเศษให้ห่างจากบ้านจริง ~500m (3 ทศนิยม ≈ 111m/digit)
          lat: lat !== null ? Math.round(lat * 100) / 100 : null,
          lng: lng !== null ? Math.round(lng * 100) / 100 : null,
        }
      }

      // Full access
      return {
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
        village: p.village,
        tambon: p.tambon,
        amphoe: p.amphoe,
        province: p.province,
        lat,
        lng,
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
        risk,
      }
    })
    .filter(Boolean)

  // Audit log สำหรับ full-access (fire-and-forget)
  if (fullAccess && session?.user?.id) {
    void db
      .insert(accessLog)
      .values({
        userId: session.user.id,
        action: 'list_vulnerable',
        ip: null,
      })
      .catch(() => {})
  }

  return NextResponse.json(data)
}

// -----------------------------------------------------------------------
// POST — manual entry (officer/admin เดี่ยว)
// สำหรับ batch ส่งผ่าน /api/ingest/vulnerable แทน
// -----------------------------------------------------------------------

const VALID_TYPES = new Set(['bedridden', 'elderly', 'disabled', 'pregnant', 'other'])
const VALID_PRIORITIES = new Set(['A', 'B', 'C'])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const prefix = typeof body.prefix === 'string' ? body.prefix.trim() : null
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
  if (!firstName) return badRequest('firstName is required')
  if (!lastName) return badRequest('lastName is required')

  const type = typeof body.type === 'string' ? body.type : ''
  if (!VALID_TYPES.has(type)) return badRequest(`type must be one of: ${[...VALID_TYPES].join(', ')}`)

  const lat = body.lat !== undefined ? Number(body.lat) : NaN
  const lng = body.lng !== undefined ? Number(body.lng) : NaN
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return badRequest('lat is invalid')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return badRequest('lng is invalid')

  const medicalPriority = typeof body.medicalPriority === 'string' ? body.medicalPriority : 'C'
  if (!VALID_PRIORITIES.has(medicalPriority)) return badRequest('medicalPriority must be A, B, or C')

  const assignedVhvId = body.assignedVhvId
  if (assignedVhvId !== undefined && !isUuid(assignedVhvId)) {
    return badRequest('assignedVhvId must be a UUID')
  }

  const db = getDb()
  const [created] = await db
    .insert(vulnerablePersons)
    .values({
      prefix,
      firstName,
      lastName,
      type,
      label: typeof body.label === 'string' ? body.label : defaultLabel(type),
      age: body.age != null ? Number(body.age) || null : null,
      cond: typeof body.cond === 'string' ? body.cond : null,
      equipment: typeof body.equipment === 'string' ? body.equipment : null,
      village: typeof body.village === 'string' ? body.village : null,
      tambon: typeof body.tambon === 'string' ? body.tambon : null,
      amphoe: typeof body.amphoe === 'string' ? body.amphoe : null,
      province: typeof body.province === 'string' ? body.province : null,
      lat: String(lat),
      lng: String(lng),
      caregiverPhone: typeof body.caregiverPhone === 'string' ? body.caregiverPhone : null,
      careUnit: typeof body.careUnit === 'string' ? body.careUnit : null,
      assignedVhvId: isUuid(assignedVhvId) ? assignedVhvId : null,
      medicalPriority,
      consent: body.consent === true,
      followUpStatus: 'pending',
      sourceSystem: 'manual',
      createdBy: sessionUserId(session),
    })
    .returning()

  // Audit log
  void db
    .insert(accessLog)
    .values({
      userId: sessionUserId(session),
      action: 'create_vulnerable',
      targetId: created.id,
      ip: null,
    })
    .catch(() => {})

  return NextResponse.json({ data: created }, { status: 201 })
}

function defaultLabel(type: string): string {
  const labels: Record<string, string> = {
    bedridden: 'ผู้ป่วยติดเตียง',
    elderly: 'ผู้สูงอายุ',
    disabled: 'ผู้พิการ/ทุพพลภาพ',
    pregnant: 'หญิงตั้งครรภ์',
    other: 'กลุ่มเปราะบางอื่นๆ',
  }
  return labels[type] ?? 'กลุ่มเปราะบาง'
}
