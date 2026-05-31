import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canWriteFieldData, forbidden, isUuid, sessionUserId, unauthorized } from '@/lib/field-api'
import { accessLog, householdMembers } from '@/db/schema'

// GET /api/household-members/:id/national-id
// คืนเลขบัตรประชาชนเต็ม (PDPA) — เฉพาะเจ้าหน้าที่ที่มีสิทธิ์ + บันทึก audit ทุกครั้ง
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid member id')

  const db = getDb()
  const [m] = await db
    .select({ nationalId: householdMembers.nationalId })
    .from(householdMembers)
    .where(eq(householdMembers.id, id))
    .limit(1)

  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  void db
    .insert(accessLog)
    .values({ userId: sessionUserId(session), action: 'reveal_national_id', targetId: id, ip: null })
    .catch(() => {})

  return NextResponse.json({ nationalId: m.nationalId })
}
