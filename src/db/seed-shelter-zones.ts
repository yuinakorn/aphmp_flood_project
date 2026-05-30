/**
 * npm run db:seed:shelters
 * Seed: เพิ่มโซน intake ให้ทุกศูนย์พักพิงในระบบ (type=shelter|assembly)
 * + ตัวอย่าง admission แบบ walk-in 2-3 ราย เพื่อให้หน้า /admin/shelters มีข้อมูลแสดง
 */
import { existsSync, readFileSync } from 'node:fs'

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    process.env[line.slice(0, i)] ??= line.slice(i + 1)
  }
}

async function main() {
  const { getDb } = await import('@/lib/db')
  const { infrastructures, shelterZones, shelterAdmissions, householdMembers } = await import('./schema')
  const { inArray, eq } = await import('drizzle-orm')
  const db = getDb()

  // ─── 1. zones for every shelter/assembly ───
  const shelters = await db
    .select({ id: infrastructures.id, name: infrastructures.name })
    .from(infrastructures)
    .where(inArray(infrastructures.type, ['shelter', 'assembly']))

  if (shelters.length === 0) {
    console.log('⚠️  ไม่พบศูนย์พักพิง — seed infra ก่อน (npm run db:seed)')
    process.exit(0)
  }

  // โซนมาตรฐาน 3 โซนตาม Excel จริง — แต่ละศูนย์แก้ได้ทีหลัง
  const defaultZones = [
    { name: 'ผู้ป่วยติดเตียง / ส่งต่อ รพ.', sortOrder: 1 },
    { name: 'ผู้พักพิงทั่วไป', sortOrder: 2 },
    { name: 'กลุ่มเปราะบางพิเศษ', sortOrder: 3 },
  ]

  let zoneCount = 0
  const firstShelter = shelters[0]
  let firstShelterZoneIds: string[] = []

  for (const s of shelters) {
    const existing = await db.select({ id: shelterZones.id }).from(shelterZones).where(eq(shelterZones.shelterId, s.id))
    if (existing.length > 0) {
      if (s.id === firstShelter.id) firstShelterZoneIds = existing.map((z) => z.id)
      continue
    }
    const inserted = await db
      .insert(shelterZones)
      .values(defaultZones.map((z) => ({ ...z, shelterId: s.id })))
      .returning({ id: shelterZones.id })
    zoneCount += inserted.length
    if (s.id === firstShelter.id) firstShelterZoneIds = inserted.map((z) => z.id)
  }

  console.log(`✓ seeded ${zoneCount} zones across ${shelters.length} shelters`)

  // ─── 2. sample walk-in admissions ที่ shelter แรก (ถ้ายังไม่มี admission) ───
  const existingAdms = await db.select({ id: shelterAdmissions.id }).from(shelterAdmissions).where(eq(shelterAdmissions.shelterId, firstShelter.id))
  if (existingAdms.length > 0) {
    console.log(`✓ admissions already exist for ${firstShelter.name} — skip sample`)
    process.exit(0)
  }

  const samplePeople = [
    {
      prefix: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี',
      nationalId: '3500100123456', birthDate: '1955-03-12',
      nationality: 'ไทย', sex: 'ชาย', age: 70,
      phone: '081-2345678', hno: '45', villno: '3',
      cond: 'CKD ระยะ 5 ต้องล้างไต', drugAllergy: 'Penicillin',
      foodAllergy: '-', sourceSystem: 'walkin', type: 'bedridden',
    },
    {
      prefix: 'นาง', firstName: 'มาลี', lastName: 'แสงทอง',
      nationalId: '3500100987654', birthDate: '1948-07-22',
      nationality: 'ไทย', sex: 'หญิง', age: 77,
      phone: '085-1112222', hno: '78', villno: '5',
      cond: 'เบาหวาน + ความดัน', drugAllergy: '-', foodAllergy: 'อาหารทะเล',
      sourceSystem: 'walkin', type: 'elderly',
    },
    {
      prefix: 'นาย', firstName: 'อาทิตย์', lastName: 'พงษ์ไพร',
      nationalId: null, birthDate: '1995-11-05',
      nationality: 'ไร้สถานะ', sex: 'ชาย', age: 30,
      phone: null, hno: null, villno: null,
      cond: null, drugAllergy: null, foodAllergy: null,
      sourceSystem: 'walkin', type: null,
    },
  ]

  const insertedMembers = await db
    .insert(householdMembers)
    .values(samplePeople)
    .returning({ id: householdMembers.id, firstName: householdMembers.firstName })

  const admissions = insertedMembers.map((m, i) => ({
    shelterId: firstShelter.id,
    zoneId: firstShelterZoneIds[i % Math.max(firstShelterZoneIds.length, 1)] ?? null,
    memberId: m.id,
    status: i === 2 ? ('discharged' as const) : ('admitted' as const),
    intakePoint: 'จุดรับเข้าหน้าศูนย์',
    broughtByText: i === 0 ? 'หน่วย EMS รพ.' : null,
    exitReason: i === 2 ? ('moved_home' as const) : null,
    exitDestination: i === 2 ? 'กลับบ้านญาติ' : null,
    dischargedAt: i === 2 ? new Date() : null,
  }))

  await db.insert(shelterAdmissions).values(admissions)
  console.log(`✓ seeded ${admissions.length} sample admissions at ${firstShelter.name}`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
