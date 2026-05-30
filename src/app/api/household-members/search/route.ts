import { NextRequest, NextResponse } from 'next/server'
import { eq, or, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { canWriteFieldData, composeName, forbidden, maskNationalId, unauthorized } from '@/lib/field-api'
import { householdMembers } from '@/db/schema'

// GET /api/household-members/search?q=<nationalId or name>
// คืนรายการคนที่ match (สำหรับฟอร์มรับเข้าศูนย์พักพิง) — อย่างน้อยกรอก 3 ตัวอักษร/4 หลัก
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json({ data: [] })

  const digitsOnly = q.replace(/\D/g, '')
  const looksLikeId = digitsOnly.length >= 4 && digitsOnly === q.replace(/\s/g, '')

  const db = getDb()

  const namePattern = `%${q}%`
  const rows = await db
    .select()
    .from(householdMembers)
    .where(
      looksLikeId
        ? eq(householdMembers.nationalId, digitsOnly)
        : or(
            sql`${householdMembers.firstName} ILIKE ${namePattern}`,
            sql`${householdMembers.lastName} ILIKE ${namePattern}`,
          ),
    )
    .limit(10)

  const data = rows.map((r) => ({
    id: r.id,
    name: composeName(r.prefix, r.firstName, r.lastName),
    nationalIdMasked: maskNationalId(r.nationalId),
    age: r.age,
    sex: r.sex,
    nationality: r.nationality,
    phone: r.phone,
    conditions: r.cond,
    foodAllergy: r.foodAllergy,
    drugAllergy: r.drugAllergy,
    isVulnerable: !!r.type,
  }))

  return NextResponse.json({ data })
}
