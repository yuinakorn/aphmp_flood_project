import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'
import { shelterZones } from '@/db/schema'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const db = getDb()
  const rows = await db
    .select()
    .from(shelterZones)
    .where(eq(shelterZones.shelterId, id))
    .orderBy(asc(shelterZones.sortOrder), asc(shelterZones.createdAt))

  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const db = getDb()
  const [created] = await db
    .insert(shelterZones)
    .values({
      shelterId: id,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
    })
    .returning()

  void audit(req, session, { action: 'create_zone', entity: 'shelter_zone', targetId: created.id, metadata: { shelterId: id } })

  return NextResponse.json({ data: created }, { status: 201 })
}
