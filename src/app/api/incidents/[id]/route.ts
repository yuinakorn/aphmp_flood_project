import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { INCIDENT_STATUSES, INCIDENT_TYPES } from '@/lib/incident'
import { incidents } from '@/db/schema'

// PATCH /api/incidents/[id] — แก้ไข/ปิดเหตุการณ์ (admin/officer/eoc)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof incidents.$inferInsert> = { updatedAt: new Date() }

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return badRequest('name must be a non-empty string')
    patch.name = name
  }

  if ('type' in body) {
    if (!INCIDENT_TYPES.has(body.type as string)) return badRequest('Invalid type')
    patch.type = body.type as string
  }

  if ('status' in body) {
    if (!INCIDENT_STATUSES.has(body.status as string)) return badRequest('Invalid status')
    patch.status = body.status as string
    // ปิดเหตุการณ์ → ประทับเวลาสิ้นสุด; เปิดใหม่ → ล้าง endedAt
    patch.endedAt = body.status === 'closed' ? new Date() : null
  }

  for (const field of ['province', 'amphoe', 'tambon', 'description'] as const) {
    if (field in body) {
      patch[field] = typeof body[field] === 'string' ? (body[field] as string) : null
    }
  }

  if (Object.keys(patch).length === 1) return badRequest('No updatable fields provided')

  const db = getDb()
  const [updated] = await db
    .update(incidents)
    .set(patch)
    .where(eq(incidents.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: updated })
}
