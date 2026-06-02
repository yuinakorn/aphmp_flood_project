/**
 * POST /api/ingest/vulnerable
 *
 * Endpoint สำหรับหน่วยบริการภายนอก (รพ.สต., อปท.) push ข้อมูลกลุ่มเปราะบางเข้าระบบ
 *
 * Auth: API key ต่อหน่วย — ส่งเป็น Authorization: Bearer <key>
 * Body: { persons: IngestPerson[], sourceSystem: string, deleteMissing?: boolean }
 *
 * Logic:
 *  - upsert แต่ละคนด้วย (source_system, source_unit, source_id)
 *  - ถ้า deleteMissing = true (default): soft-delete record จากหน่วยนี้ที่ไม่อยู่ใน batch
 *  - คืน { inserted, updated, deleted, errors }
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { householdMembers } from '@/db/schema'
import { authenticateUnit, extractBearerKey } from '@/lib/unit-auth'
import { badRequest } from '@/lib/field-api'
import { audit } from '@/lib/audit'

// -----------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------

const SOURCE_SYSTEMS = new Set(['jhcis', 'hosxp', 'manual', 'import'])
const VALID_TYPES = new Set(['bedridden', 'elderly', 'disabled', 'pregnant', 'other'])
const VALID_PRIORITIES = new Set(['A', 'B', 'C'])

interface IngestPerson {
  sourceId: string
  prefix?: string | null
  firstName: string
  lastName: string
  type: string
  label?: string
  age?: number | null
  cond?: string | null
  equipment?: string | null
  village?: string | null
  tambon?: string | null
  amphoe?: string | null
  province?: string | null
  lat: number
  lng: number
  caregiverPhone?: string | null
  medicalPriority?: string
  consent?: boolean
}

interface IngestBody {
  persons: IngestPerson[]
  sourceSystem: string
  deleteMissing?: boolean
}

// -----------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------

function validatePerson(p: unknown, idx: number): { ok: true; data: IngestPerson } | { ok: false; error: string } {
  if (!p || typeof p !== 'object') return { ok: false, error: `persons[${idx}]: not an object` }
  const r = p as Record<string, unknown>

  if (!r.sourceId || typeof r.sourceId !== 'string' || !r.sourceId.trim())
    return { ok: false, error: `persons[${idx}]: sourceId is required` }
  if (!r.firstName || typeof r.firstName !== 'string' || !r.firstName.trim())
    return { ok: false, error: `persons[${idx}]: firstName is required` }
  if (!r.lastName || typeof r.lastName !== 'string' || !r.lastName.trim())
    return { ok: false, error: `persons[${idx}]: lastName is required` }
  if (!r.type || typeof r.type !== 'string' || !VALID_TYPES.has(r.type))
    return { ok: false, error: `persons[${idx}]: type must be one of ${[...VALID_TYPES].join(', ')}` }

  const lat = Number(r.lat)
  const lng = Number(r.lng)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90)
    return { ok: false, error: `persons[${idx}]: lat is invalid` }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    return { ok: false, error: `persons[${idx}]: lng is invalid` }

  if (r.medicalPriority !== undefined && !VALID_PRIORITIES.has(r.medicalPriority as string))
    return { ok: false, error: `persons[${idx}]: medicalPriority must be A, B, or C` }

  return {
    ok: true,
    data: {
      sourceId: String(r.sourceId).trim(),
      prefix: typeof r.prefix === 'string' ? r.prefix.trim() : null,
      firstName: String(r.firstName).trim(),
      lastName: String(r.lastName).trim(),
      type: r.type as string,
      label: typeof r.label === 'string' ? r.label.trim() : defaultLabel(r.type as string),
      age: r.age != null ? Number(r.age) || null : null,
      cond: typeof r.cond === 'string' ? r.cond : null,
      equipment: typeof r.equipment === 'string' ? r.equipment : null,
      village: typeof r.village === 'string' ? r.village : null,
      tambon: typeof r.tambon === 'string' ? r.tambon : null,
      amphoe: typeof r.amphoe === 'string' ? r.amphoe : null,
      province: typeof r.province === 'string' ? r.province : null,
      lat,
      lng,
      caregiverPhone: typeof r.caregiverPhone === 'string' ? r.caregiverPhone : null,
      medicalPriority: typeof r.medicalPriority === 'string' ? r.medicalPriority : 'C',
      consent: r.consent === true,
    },
  }
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

// -----------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Authenticate unit
  const rawKey = extractBearerKey(req.headers.get('authorization'))
  if (!rawKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 })

  const unit = await authenticateUnit(rawKey)
  if (!unit) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  // 2. Parse body
  const body = (await req.json().catch(() => null)) as IngestBody | null
  if (!body) return badRequest('Invalid JSON body')

  const { persons, sourceSystem, deleteMissing = true } = body

  if (!sourceSystem || !SOURCE_SYSTEMS.has(sourceSystem))
    return badRequest(`sourceSystem must be one of: ${[...SOURCE_SYSTEMS].join(', ')}`)
  if (!Array.isArray(persons))
    return badRequest('persons must be an array')
  if (persons.length === 0)
    return NextResponse.json({ inserted: 0, updated: 0, deleted: 0, errors: [] })
  if (persons.length > 2000)
    return badRequest('persons array exceeds limit of 2000 per request')

  // 3. Validate all persons, collect valid + error list
  const valid: IngestPerson[] = []
  const errors: string[] = []
  for (let i = 0; i < persons.length; i++) {
    const result = validatePerson(persons[i], i)
    if (result.ok) valid.push(result.data)
    else errors.push(result.error)
  }

  // 4. Upsert valid persons
  const db = getDb()
  const now = new Date()
  let inserted = 0
  let updated = 0

  const upsertedSourceIds: string[] = []

  for (const p of valid) {
    const values = {
      prefix: p.prefix ?? null,
      firstName: p.firstName,
      lastName: p.lastName,
      type: p.type,
      label: p.label ?? defaultLabel(p.type),
      age: p.age != null ? p.age as unknown as number : null,
      cond: p.cond,
      equipment: p.equipment,
      village: p.village,
      tambon: p.tambon,
      amphoe: p.amphoe,
      province: p.province,
      lat: String(p.lat),
      lng: String(p.lng),
      caregiverPhone: p.caregiverPhone,
      medicalPriority: p.medicalPriority ?? 'C',
      consent: p.consent ?? false,
      sourceSystem,
      sourceUnit: unit.unitCode,
      sourceId: p.sourceId,
      sourceSyncedAt: now,
      deletedAt: null, // คืนสภาพถ้าเคย soft-delete
      updatedAt: now,
    }

    // conflict target: (source_system, source_unit, source_id)
    const result = await db
      .insert(householdMembers)
      .values({ ...values, followUpStatus: 'pending' })
      .onConflictDoUpdate({
        target: [
          householdMembers.sourceSystem,
          householdMembers.sourceUnit,
          householdMembers.sourceId,
        ],
        set: values,
        // เพิ่ม where เพื่อนับว่าเป็น update หรือ insert
        setWhere: sql`${householdMembers.sourceSyncedAt} IS DISTINCT FROM ${now}`,
      })
      .returning({ id: householdMembers.id, createdAt: householdMembers.createdAt })

    if (result.length > 0) {
      const isNew = result[0].createdAt?.getTime() === now.getTime()
      if (isNew) inserted++
      else updated++
    }

    upsertedSourceIds.push(p.sourceId)
  }

  // 5. Soft-delete records จากหน่วยนี้ที่ไม่อยู่ใน batch
  let deleted = 0
  if (deleteMissing && upsertedSourceIds.length > 0) {
    const deleteResult = await db
      .update(householdMembers)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(householdMembers.sourceSystem, sourceSystem),
          eq(householdMembers.sourceUnit, unit.unitCode),
          isNull(householdMembers.deletedAt),
          notInArray(householdMembers.sourceId, upsertedSourceIds),
        ),
      )
      .returning({ id: householdMembers.id })

    deleted = deleteResult.length
  }

  void audit(req, null, {
    action: 'ingest_vulnerable',
    entity: 'household_member',
    metadata: { unit: unit.unitCode, sourceSystem, inserted, updated, deleted, errors: errors.length },
  })

  return NextResponse.json(
    {
      inserted,
      updated,
      deleted,
      errors,
      unit: { code: unit.unitCode, name: unit.unitName },
      syncedAt: now.toISOString(),
    },
    { status: errors.length === valid.length && valid.length === 0 ? 400 : 200 },
  )
}
