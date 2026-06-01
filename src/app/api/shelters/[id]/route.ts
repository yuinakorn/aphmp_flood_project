import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { infrastructures } from '@/db/schema'

const SHELTER_TYPES = new Set(['shelter', 'assembly'])

// PATCH /api/shelters/:id — แก้ข้อมูลศูนย์ (ชื่อ, พิกัด, ความจุ, รองรับสุขภาพ ฯลฯ)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof infrastructures.$inferInsert> = {}

  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.type === 'string' && SHELTER_TYPES.has(body.type)) patch.type = body.type
  if (typeof body.contact === 'string') patch.contact = body.contact || null
  if (typeof body.capacity === 'number' || body.capacity === null) patch.capacity = body.capacity as number | null
  if (typeof body.bedriddenCapacity === 'number' || body.bedriddenCapacity === null) patch.bedriddenCapacity = body.bedriddenCapacity as number | null
  if (typeof body.oxygenSupport === 'boolean') patch.oxygenSupport = body.oxygenSupport
  if (typeof body.wheelchairSupport === 'boolean') patch.wheelchairSupport = body.wheelchairSupport
  if (typeof body.electricitySupport === 'boolean') patch.electricitySupport = body.electricitySupport
  if (body.lat !== undefined) {
    const v = Number(body.lat)
    if (!Number.isFinite(v)) return badRequest('lat invalid')
    patch.lat = String(v)
  }
  if (body.lng !== undefined) {
    const v = Number(body.lng)
    if (!Number.isFinite(v)) return badRequest('lng invalid')
    patch.lng = String(v)
  }

  if (Object.keys(patch).length === 0) return badRequest('no fields to update')

  patch.updatedAt = new Date()

  // province guard — non-national แก้ได้เฉพาะศูนย์ในจังหวัดสังกัด
  const national = isNationalRole(session.user.role)
  const where = national
    ? eq(infrastructures.id, id)
    : and(eq(infrastructures.id, id), eq(infrastructures.province, session.user.province ?? '__none__'))

  const db = getDb()
  const [updated] = await db
    .update(infrastructures)
    .set(patch)
    .where(where)
    .returning()

  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ data: updated })
}
