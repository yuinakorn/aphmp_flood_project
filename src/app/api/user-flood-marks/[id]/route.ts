/**
 * PATCH  /api/user-flood-marks/[id] — แก้ไขหมุด (เจ้าของ หรือ admin)
 * DELETE /api/user-flood-marks/[id] — soft-delete หมุด (เจ้าของ หรือ admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { deriveFloodMarkLevel } from '@/lib/flood-marks'
import { badRequest, forbidden, isUuid, sessionUserId, unauthorized } from '@/lib/field-api'
import { userFloodMarks } from '@/db/schema'
import { audit } from '@/lib/audit'
import type { UserRole } from '@/types'

async function loadOwned(id: string) {
  const db = getDb()
  const [row] = await db.select().from(userFloodMarks).where(eq(userFloodMarks.id, id)).limit(1)
  return row
}

function canMutate(row: typeof userFloodMarks.$inferSelect, userId: string | null, role?: UserRole) {
  return role === 'admin' || (!!userId && row.createdBy === userId)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()

  const row = await loadOwned(id)
  if (!row || row.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canMutate(row, sessionUserId(session), session.user.role as UserRole)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof userFloodMarks.$inferInsert> = { updatedAt: new Date() }

  if ('waterLevelCm' in body) {
    const cm = Number(body.waterLevelCm)
    if (!Number.isFinite(cm) || cm < 0 || cm > 2000)
      return badRequest('waterLevelCm must be a number between 0 and 2000')
    patch.waterLevelCm = String(cm)
    patch.level = deriveFloodMarkLevel(cm)
  }

  for (const key of ['placeDetail', 'placeAround', 'province', 'amphoe', 'tambon', 'contactPhone'] as const) {
    if (key in body) {
      patch[key] = typeof body[key] === 'string' ? (body[key] as string).trim() || null : null
    }
  }

  if ('observedAt' in body) {
    const d = body.observedAt ? new Date(body.observedAt as string) : null
    if (d && !isNaN(d.getTime())) patch.observedAt = d
  }

  if (Object.keys(patch).length === 1) return badRequest('No updatable fields provided')

  const db = getDb()
  const [updated] = await db
    .update(userFloodMarks)
    .set(patch)
    .where(eq(userFloodMarks.id, id))
    .returning()

  void audit(req, session, { action: 'update_flood_mark', entity: 'flood_mark', targetId: id, metadata: { fields: Object.keys(patch) } })

  return NextResponse.json({ data: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()

  const row = await loadOwned(id)
  if (!row || row.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canMutate(row, sessionUserId(session), session.user.role as UserRole)) return forbidden()

  const db = getDb()
  await db
    .update(userFloodMarks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(userFloodMarks.id, id))

  void audit(req, session, { action: 'delete_flood_mark', entity: 'flood_mark', targetId: id })

  return NextResponse.json({ ok: true })
}
