/**
 * npm run db:seed:overview-demo
 *
 * Seed ข้อมูล "เดโม" สำหรับหน้า /admin/overview ให้ตรงกับ incident ที่ active (ต.แม่สาย อ.แม่สาย เชียงราย)
 * เพื่อให้คิว survivability / ribbon / donut / bars มีเคสจริงให้เห็น
 *
 * - พิกัดวางทับจุดน้ำใน public/data/flood-points.json เพื่อให้ classifyRisk คืน flood/near จริง
 *   (พิกัด demo ไม่ตรงภูมิศาสตร์แม่สายเป๊ะ — เป็นข้อมูลทดสอบ ดูได้เฉพาะหน้านี้ที่ไม่มีแผนที่)
 * - life_support / caregiver / last_contacted_at ใส่หลากหลายเพื่อโชว์ P1/P2/P3 + confidence
 * - idempotent: ลบของเดิม (villcode='DEMO-MS' / source_system='overview-demo') ก่อน insert ใหม่
 *
 * ⚠️ ข้อมูลทดสอบ — ลบได้ด้วยการรันซ้ำ หรือ DELETE where villcode='DEMO-MS'
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

import floodPointsData from '../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

type Member = {
  prefix: string
  firstName: string
  lastName: string
  age: number
  sex: string
  type: string | null
  isChronic?: boolean
  isHead?: boolean
  familyPosition?: string
  lifeSupport?: string[]
  phone?: string | null
  caregiverPhone?: string | null
  contactHrsAgo?: number | null // ชั่วโมงตั้งแต่ติดต่อล่าสุด (null = ไม่เคยบันทึก)
}
type House = {
  hno: string
  villno: string
  village: string
  proximity: 'flood' | 'near' | 'safe'
  members: Member[]
}

// แต่ละบ้าน — ออกแบบให้ครอบคลุม P1/P2/P3 + กรณีข้อมูลไม่ครบ
const HOUSES: House[] = [
  {
    hno: '42/1', villno: '4', village: 'บ้านเหมืองแดง', proximity: 'flood',
    members: [
      { prefix: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี(เดโม)', age: 74, sex: 'ชาย', type: 'bedridden', isHead: true, familyPosition: 'หัวหน้าครัวเรือน', lifeSupport: ['oxygen'], caregiverPhone: null, contactHrsAgo: 9 },
      { prefix: 'นาง', firstName: 'พิกุล', lastName: 'ใจดี(เดโม)', age: 70, sex: 'หญิง', type: null, familyPosition: 'คู่สมรส', isChronic: true },
      { prefix: 'น.ส.', firstName: 'มะลิ', lastName: 'ใจดี(เดโม)', age: 32, sex: 'หญิง', type: null, familyPosition: 'บุตร', phone: '08x-xxx-4521' },
      { prefix: 'ด.ช.', firstName: 'ต้น', lastName: 'ใจดี(เดโม)', age: 8, sex: 'ชาย', type: null, familyPosition: 'หลาน' },
    ],
  },
  {
    hno: '7', villno: '3', village: 'บ้านป่ายาง', proximity: 'flood',
    members: [
      { prefix: 'นาง', firstName: 'บุญมา', lastName: 'แสงทอง(เดโม)', age: 68, sex: 'หญิง', type: 'elderly', isChronic: true, isHead: true, familyPosition: 'หัวหน้าครัวเรือน', lifeSupport: ['dialysis_capd'], caregiverPhone: '08x-xxx-7788', contactHrsAgo: 3 },
      { prefix: 'นาย', firstName: 'สาคร', lastName: 'แสงทอง(เดโม)', age: 71, sex: 'ชาย', type: null, familyPosition: 'คู่สมรส' },
    ],
  },
  {
    hno: '88', villno: '6', village: 'บ้านสันยาว', proximity: 'flood',
    members: [
      { prefix: 'นาย', firstName: 'คำ', lastName: 'ดวงดี(เดโม)', age: 81, sex: 'ชาย', type: 'bedridden', isHead: true, familyPosition: 'หัวหน้าครัวเรือน', lifeSupport: ['feeding_tube'], caregiverPhone: '08x-xxx-1199', contactHrsAgo: 14 },
      { prefix: 'นาง', firstName: 'บัว', lastName: 'ดวงดี(เดโม)', age: 76, sex: 'หญิง', type: null, familyPosition: 'คู่สมรส' },
    ],
  },
  {
    hno: '19', villno: '1', village: 'บ้านเวียงพาน', proximity: 'near',
    members: [
      { prefix: 'ด.ช.', firstName: 'ธนา', lastName: 'คำมูล(เดโม)', age: 9, sex: 'ชาย', type: 'other', isHead: false, familyPosition: 'หลาน', lifeSupport: ['anti_seizure'], caregiverPhone: null, contactHrsAgo: 30 },
      { prefix: 'นาง', firstName: 'พิน', lastName: 'คำมูล(เดโม)', age: 70, sex: 'หญิง', type: 'elderly', isHead: true, familyPosition: 'หัวหน้าครัวเรือน' },
      { prefix: 'ด.ญ.', firstName: 'นา', lastName: 'คำมูล(เดโม)', age: 12, sex: 'หญิง', type: null, familyPosition: 'หลาน' },
    ],
  },
  {
    hno: '25', villno: '2', village: 'บ้านไม้ลุงขน', proximity: 'near',
    members: [
      { prefix: 'นาง', firstName: 'สาคร', lastName: 'พรหมมา(เดโม)', age: 28, sex: 'หญิง', type: 'pregnant', isHead: true, familyPosition: 'หัวหน้าครัวเรือน', caregiverPhone: '08x-xxx-2020', contactHrsAgo: 1 },
      { prefix: 'นาย', firstName: 'วีระ', lastName: 'พรหมมา(เดโม)', age: 31, sex: 'ชาย', type: null, familyPosition: 'คู่สมรส' },
    ],
  },
  {
    hno: '14', villno: '5', village: 'บ้านถ้ำผาจม', proximity: 'flood',
    members: [
      { prefix: 'นาย', firstName: 'แก้ว', lastName: 'มูลคำ(เดโม)', age: 66, sex: 'ชาย', type: 'disabled', isHead: true, familyPosition: 'หัวหน้าครัวเรือน', lifeSupport: ['oxygen'], caregiverPhone: null, contactHrsAgo: 20 },
    ],
  },
  {
    hno: '101', villno: '7', village: 'บ้านเหมืองแดง', proximity: 'safe',
    members: [
      { prefix: 'นาง', firstName: 'เงิน', lastName: 'สุขใจ(เดโม)', age: 72, sex: 'หญิง', type: 'elderly', isHead: true, familyPosition: 'หัวหน้าครัวเรือน', caregiverPhone: '08x-xxx-3030', contactHrsAgo: 6 },
    ],
  },
  {
    hno: '55', villno: '4', village: 'บ้านเหมืองแดง', proximity: 'safe',
    members: [
      { prefix: 'นาย', firstName: 'ทอง', lastName: 'อินทร์(เดโม)', age: 79, sex: 'ชาย', type: 'elderly', isHead: true, familyPosition: 'หัวหน้าครัวเรือน', caregiverPhone: null, contactHrsAgo: null },
    ],
  },
]

function coordFor(proximity: 'flood' | 'near' | 'safe', i: number): [number, number] {
  const base = floodCoords[(i * 97) % floodCoords.length] // กระจายจุด
  if (proximity === 'flood') return base // ทับจุดน้ำ → <0.5km
  if (proximity === 'near') return [base[0] + 0.012, base[1] + 0.012] // ~1.8km → near
  return [base[0] + 0.06, base[1] + 0.06] // ~9km → safe
}

async function main() {
  const { getDb } = await import('@/lib/db')
  const { households, householdMembers } = await import('./schema')
  const { eq, sql } = await import('drizzle-orm')
  const db = getDb()

  // idempotent cleanup
  await db.delete(householdMembers).where(eq(householdMembers.sourceSystem, 'overview-demo'))
  await db.delete(households).where(eq(households.villcode, 'DEMO-MS'))

  let nHouse = 0
  let nMember = 0
  for (let i = 0; i < HOUSES.length; i++) {
    const h = HOUSES[i]
    const [lat, lng] = coordFor(h.proximity, i)
    const [house] = await db
      .insert(households)
      .values({
        hno: h.hno,
        villageName: h.village,
        villno: h.villno,
        villcode: 'DEMO-MS',
        tambon: 'แม่สาย',
        amphoe: 'แม่สาย',
        province: 'เชียงราย',
        lat: String(lat),
        lng: String(lng),
      })
      .returning()
    nHouse++

    for (const m of h.members) {
      const contactAt =
        m.contactHrsAgo == null ? null : new Date(Date.now() - m.contactHrsAgo * 3_600_000)
      await db.insert(householdMembers).values({
        householdId: house.id,
        prefix: m.prefix,
        firstName: m.firstName,
        lastName: m.lastName,
        age: m.age,
        sex: m.sex,
        type: m.type,
        isHead: m.isHead ?? false,
        isChronic: m.isChronic ?? false,
        familyPosition: m.familyPosition ?? null,
        lifeSupport: m.lifeSupport ?? null,
        phone: m.phone ?? null,
        caregiverPhone: m.caregiverPhone ?? null,
        hno: h.hno,
        villno: h.villno,
        village: h.village,
        tambon: 'แม่สาย',
        amphoe: 'แม่สาย',
        province: 'เชียงราย',
        lat: String(lat),
        lng: String(lng),
        lastContactedAt: contactAt,
        followUpStatus: 'pending',
        consent: true,
        sourceSystem: 'overview-demo',
        careUnit: 'รพ.สต.แม่สาย',
      })
      nMember++
    }
  }

  console.log(`seeded households: ${nHouse}, members: ${nMember} (ต.แม่สาย — overview-demo)`)
  console.log('เปิด /admin/overview ใหม่ → ควรเห็นคิวเคสร้อน P1/P2/P3 + ribbon/donut/bars มีตัวเลข')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
