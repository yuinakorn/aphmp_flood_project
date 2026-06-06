import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'
import { householdMembers } from '@/db/schema'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid member id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof householdMembers.$inferInsert> = {}

  if (typeof body.prefix === 'string') patch.prefix = body.prefix
  if (typeof body.firstName === 'string' && body.firstName.trim()) patch.firstName = body.firstName.trim()
  if (typeof body.lastName === 'string') patch.lastName = body.lastName.trim()
  if (typeof body.nationalId === 'string') patch.nationalId = body.nationalId || null
  if (typeof body.birthDate === 'string') patch.birthDate = body.birthDate || null
  if (typeof body.age === 'number') patch.age = body.age
  if (body.age === null) patch.age = null
  if (typeof body.sex === 'string') patch.sex = body.sex
  if (typeof body.nationality === 'string') patch.nationality = body.nationality
  if (typeof body.phone === 'string') patch.phone = body.phone
  if (typeof body.hno === 'string') patch.hno = body.hno
  if (typeof body.villno === 'string') patch.villno = body.villno
  if (typeof body.tambon === 'string') patch.tambon = body.tambon
  if (typeof body.amphoe === 'string') patch.amphoe = body.amphoe
  if (typeof body.conditions === 'string') patch.cond = body.conditions
  if (typeof body.foodAllergy === 'string') patch.foodAllergy = body.foodAllergy
  if (typeof body.drugAllergy === 'string') patch.drugAllergy = body.drugAllergy

  if (Object.keys(patch).length === 0) return badRequest('no fields to update')

  const db = getDb()
  const [updated] = await db
    .update(householdMembers)
    .set(patch)
    .where(eq(householdMembers.id, id))
    .returning({ id: householdMembers.id })

  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })

  void audit(req, session, {
    action: 'update_member',
    entity: 'household_member',
    targetId: id,
    metadata: { fields: Object.keys(patch) },
  })

  return NextResponse.json({ data: updated })
}
