import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { canWriteFieldData, composeName, forbidden, maskNationalId, unauthorized } from '@/lib/field-api'
import { householdMembers, infrastructures, shelterAdmissions } from '@/db/schema'

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

  // ชื่อเต็มต่อกัน (คำนำหน้า + ชื่อ + นามสกุล) เพื่อให้ค้น "ชื่อ นามสกุล" ข้ามคอลัมน์ได้
  const fullName = sql`concat_ws(' ', ${householdMembers.prefix}, ${householdMembers.firstName}, ${householdMembers.lastName})`
  // แยกเป็นคำ ๆ — ทุกคำต้องปรากฏในชื่อเต็ม (รองรับสลับลำดับ ชื่อ/นามสกุล)
  const tokens = q.split(/\s+/).filter(Boolean)
  const nameWhere = and(...tokens.map((t) => sql`${fullName} ILIKE ${`%${t}%`}`))

  const rows = await db
    .select()
    .from(householdMembers)
    .where(looksLikeId ? eq(householdMembers.nationalId, digitsOnly) : nameWhere)
    .limit(10)

  if (rows.length === 0) return NextResponse.json({ data: [] })

  // ดึง active admission ของแต่ละคนพร้อมชื่อศูนย์
  const memberIds = rows.map((r) => r.id)
  const activeAdmRows = await db
    .select({
      memberId: shelterAdmissions.memberId,
      shelterName: infrastructures.name,
    })
    .from(shelterAdmissions)
    .leftJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
    .where(
      and(
        inArray(shelterAdmissions.memberId, memberIds),
        eq(shelterAdmissions.status, 'admitted'),
      ),
    )

  const activeByShelter = new Map<string, string>()
  for (const row of activeAdmRows) {
    if (row.memberId && !activeByShelter.has(row.memberId)) {
      activeByShelter.set(row.memberId, row.shelterName ?? 'ศูนย์พักพิง')
    }
  }

  const data = rows.map((r) => ({
    id: r.id,
    name: composeName(r.prefix, r.firstName, r.lastName),
    nationalIdMasked: maskNationalId(r.nationalId, 5), // โชว์ 5 หลักท้ายเพื่อแยกคนชื่อซ้ำ
    age: r.age,
    sex: r.sex,
    nationality: r.nationality,
    phone: r.phone,
    conditions: r.cond,
    foodAllergy: r.foodAllergy,
    drugAllergy: r.drugAllergy,
    equipment: r.equipment,
    lifeSupport: r.lifeSupport,
    vulnerableType: r.type,
    vulnerableLabel: r.label,
    isVulnerable: !!r.type,
    activeShelterName: activeByShelter.get(r.id) ?? null,
  }))

  return NextResponse.json({ data })
}
