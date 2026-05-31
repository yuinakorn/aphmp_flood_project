import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { shelterStaff, users } from '@/db/schema'

function isAdmin(role?: string | null) {
  return role === 'admin' || role === 'eoc'
}

// GET /api/shelters/:id/staff — รายชื่อผู้รับผิดชอบประจำศูนย์
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!isAdmin(session.user.role)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const db = getDb()
  const data = await db
    .select({ id: shelterStaff.id, userId: users.id, name: users.name, email: users.email, role: users.role })
    .from(shelterStaff)
    .innerJoin(users, eq(shelterStaff.userId, users.id))
    .where(eq(shelterStaff.shelterId, id))

  return NextResponse.json({ data })
}

// POST /api/shelters/:id/staff  body: { email }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!isAdmin(session.user.role)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')

  const body = (await req.json().catch(() => null)) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email) return badRequest('email is required')

  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้อีเมลนี้' }, { status: 404 })

  await db.insert(shelterStaff).values({ userId: user.id, shelterId: id }).onConflictDoNothing()
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}

// DELETE /api/shelters/:id/staff?userId=
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!isAdmin(session.user.role)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid shelter id')
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId || !isUuid(userId)) return badRequest('invalid userId')

  const db = getDb()
  await db.delete(shelterStaff).where(and(eq(shelterStaff.shelterId, id), eq(shelterStaff.userId, userId)))
  return NextResponse.json({ ok: true })
}
