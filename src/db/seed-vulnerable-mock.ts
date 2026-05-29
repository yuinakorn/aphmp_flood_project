/**
 * npm run db:seed:vulnerable
 * สร้าง mock data กลุ่มเปราะบาง + family folder (ครัวเรือน/สมาชิก/ความสัมพันธ์)
 * 3 จังหวัด: เชียงใหม่ เชียงราย น่าน  (idempotent — ล้างของ mock เดิมก่อน)
 *
 * ความสอดคล้อง: สมาชิกครัวเรือนที่เป็นกลุ่มเปราะบาง (ผู้สูงอายุ/พิการ/โรคเรื้อรัง/ตั้งครรภ์)
 * จะมีฟิลด์สุขภาพ (type/priority/อุปกรณ์ ฯลฯ) เติมในแถว household_members แถวเดียวกัน — ไม่มีตารางแยก
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

// ── pools ──────────────────────────────────────────────────────────────────
const MALE = ['สมชาย', 'บุญมา', 'อินทร', 'คำปัน', 'ประสิทธิ์', 'มานพ', 'วิรัตน์', 'ทองดี', 'สมพงษ์', 'เสาร์', 'จันทร์', 'ตา']
const FEMALE = ['สมหญิง', 'บัวคำ', 'จันทร์ฉาย', 'มาลี', 'คำมูล', 'แสงเดือน', 'ปราณี', 'บุญยัง', 'นงคราญ', 'ศรีนวล', 'เกี๋ยงคำ', 'ดวงดี']
const SUR = ['ใจดี', 'ไชยวงค์', 'คำแสน', 'ศรีวิชัย', 'อินทจักร', 'ตาคำ', 'ปัญญา', 'มูลเมือง', 'สุขใจ', 'วงค์คำ', 'ธิวงค์', 'แก้วมา']

const rand = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))
const chance = (p: number) => Math.random() < p
const jitter = (n: number, d = 0.02) => n + (Math.random() - 0.5) * 2 * d
const thaiPhone = () => `0${rand(['8', '9', '6'])}${randInt(0, 9)}-${String(randInt(0, 999)).padStart(3, '0')}-${String(randInt(0, 9999)).padStart(4, '0')}`

// ── geo config (จุดศูนย์กลาง + อำเภอ/ตำบล/หมู่บ้านจริง) ─────────────────────────
interface Village { villcode: string; villageName: string; villno: string; amphoe: string; tambon: string; lat: number; lng: number }
interface ProvinceCfg { province: string; abbr: string; villages: Village[] }

function villages(abbr: string, base: [number, number], defs: Array<[string, string, string, string]>): Village[] {
  // defs: [villno, villageName, amphoe, tambon]
  return defs.map((d, i) => ({
    villcode: `${abbr}-${String(i + 1).padStart(2, '0')}`,
    villno: d[0],
    villageName: d[1],
    amphoe: d[2],
    tambon: d[3],
    lat: jitter(base[0], 0.06),
    lng: jitter(base[1], 0.06),
  }))
}

const PROVINCES: ProvinceCfg[] = [
  {
    province: 'เชียงใหม่', abbr: 'CM',
    villages: villages('CM', [18.79, 98.98], [
      ['1', 'บ้านสุเทพ', 'เมืองเชียงใหม่', 'สุเทพ'],
      ['4', 'บ้านช้างเผือก', 'เมืองเชียงใหม่', 'ช้างเผือก'],
      ['2', 'บ้านหางดง', 'หางดง', 'หางดง'],
      ['6', 'บ้านสันทรายหลวง', 'สันทราย', 'สันทรายหลวง'],
    ]),
  },
  {
    province: 'เชียงราย', abbr: 'CR',
    villages: villages('CR', [19.91, 99.83], [
      ['1', 'บ้านเวียง', 'เมืองเชียงราย', 'เวียง'],
      ['5', 'บ้านดู่', 'เมืองเชียงราย', 'บ้านดู่'],
      ['3', 'บ้านเหมืองแดง', 'แม่สาย', 'เวียงพางคำ'],
      ['7', 'บ้านเทิง', 'เทิง', 'เวียง'],
    ]),
  },
  {
    province: 'น่าน', abbr: 'NN',
    villages: villages('NN', [18.78, 100.77], [
      ['1', 'บ้านในเวียง', 'เมืองน่าน', 'ในเวียง'],
      ['3', 'บ้านดู่ใต้', 'เมืองน่าน', 'ดู่ใต้'],
      ['2', 'บ้านปัว', 'ปัว', 'ปัว'],
      ['5', 'บ้านริม', 'ท่าวังผา', 'ริม'],
    ]),
  },
]

type Sex = 'ชาย' | 'หญิง'
interface GenMember {
  prefix: string; firstName: string; lastName: string
  name: string // ชื่อเต็มประกอบไว้ ใช้อ้างอิงความสัมพันธ์ (father/mother/mate)
  age: number; sex: Sex; familyPosition: string; isHead: boolean
  isDisabled: boolean; isChronic: boolean
  father?: string; mother?: string; mate?: string
  pregnant?: boolean
}

function prefixOf(sex: Sex, age: number): string {
  if (age <= 12) return sex === 'ชาย' ? 'ด.ช.' : 'ด.ญ.'
  if (sex === 'ชาย') return 'นาย'
  return age <= 25 ? 'น.ส.' : 'นาง'
}

function makeFamily(): GenMember[] {
  const sur = rand(SUR)
  const members: GenMember[] = []

  const mk = (
    sex: Sex,
    age: number,
    familyPosition: string,
    isHead: boolean,
    opts: { isDisabled?: boolean; isChronic?: boolean } = {},
  ): GenMember => {
    const firstName = rand(sex === 'ชาย' ? MALE : FEMALE)
    const prefix = prefixOf(sex, age)
    return {
      prefix, firstName, lastName: sur,
      name: `${prefix}${firstName} ${sur}`,
      age, sex, familyPosition, isHead,
      isDisabled: opts.isDisabled ?? false,
      isChronic: opts.isChronic ?? false,
    }
  }

  const headMale = chance(0.6)
  const headSex: Sex = headMale ? 'ชาย' : 'หญิง'
  const headAge = randInt(48, 80)
  const head = mk(headSex, headAge, 'หัวหน้าครัวเรือน', true, { isDisabled: chance(0.12), isChronic: chance(0.3) })
  members.push(head)

  let spouse: GenMember | undefined
  if (chance(0.7)) {
    const sSex: Sex = headMale ? 'หญิง' : 'ชาย'
    spouse = mk(sSex, Math.max(40, headAge + randInt(-6, 4)), 'คู่สมรส', false, { isDisabled: chance(0.1), isChronic: chance(0.28) })
    spouse.mate = head.name
    head.mate = spouse.name
    members.push(spouse)
  }

  // ปู่/ย่า/ตา/ยาย (ผู้สูงอายุมาก)
  if (chance(0.55)) {
    const gSex: Sex = chance(0.5) ? 'ชาย' : 'หญิง'
    members.push(mk(gSex, randInt(68, 93), gSex === 'ชาย' ? 'บิดา' : 'มารดา', false, { isDisabled: chance(0.25), isChronic: chance(0.5) }))
  }

  // บุตร
  const father = headMale ? head.name : spouse?.name
  const mother = headMale ? spouse?.name : head.name
  const nKids = randInt(0, 3)
  for (let i = 0; i < nKids; i++) {
    const kSex: Sex = chance(0.5) ? 'ชาย' : 'หญิง'
    const kid = mk(kSex, randInt(0, 28), 'บุตร', false, { isDisabled: chance(0.06), isChronic: chance(0.08) })
    kid.father = father
    kid.mother = mother
    members.push(kid)
  }

  // หญิงตั้งครรภ์ (โอกาสน้อย)
  const fertile = members.filter((m) => m.sex === 'หญิง' && m.age >= 18 && m.age <= 43 && !m.isHead)
  if (fertile.length && chance(0.18)) rand(fertile).pregnant = true

  // การันตีให้มีกลุ่มเปราะบางอย่างน้อย 1 คนในเกือบทุกครัวเรือน
  const hasVuln = members.some((m) => m.age >= 60 || m.age <= 5 || m.isDisabled || m.isChronic)
  if (!hasVuln) {
    if (chance(0.5)) head.isChronic = true
    else head.isDisabled = true
  }

  return members
}

function groupOf(m: GenMember): 'elderly' | 'child' | 'disabled' | 'chronic' | 'general' {
  if (m.age >= 60) return 'elderly'
  if (m.age <= 5) return 'child'
  if (m.isDisabled) return 'disabled'
  if (m.isChronic) return 'chronic'
  return 'general'
}

// map สมาชิกเปราะบาง → ทะเบียน vulnerable_persons (type + priority + อุปกรณ์)
function toVulnerable(m: GenMember): { type: string; label: string; priority: string; cond: string | null; equipment: string | null } | null {
  const g = groupOf(m)
  if (m.pregnant) return { type: 'pregnant', label: 'หญิงตั้งครรภ์', priority: 'B', cond: 'ตั้งครรภ์', equipment: null }
  if (g === 'elderly') {
    if (m.isDisabled && chance(0.4)) return { type: 'bedridden', label: 'ผู้ป่วยติดเตียง', priority: 'A', cond: 'ติดเตียง ช่วยเหลือตัวเองไม่ได้', equipment: 'เตียงลม, สายให้อาหาร' }
    return { type: 'elderly', label: 'ผู้สูงอายุ', priority: m.age >= 75 ? 'B' : 'C', cond: m.isChronic ? 'มีโรคประจำตัว' : null, equipment: null }
  }
  if (g === 'disabled') return { type: 'disabled', label: 'ผู้พิการ/ทุพพลภาพ', priority: 'B', cond: 'พิการ', equipment: chance(0.5) ? 'รถเข็น' : null }
  if (g === 'chronic') return { type: 'other', label: 'ผู้ป่วยโรคเรื้อรัง', priority: 'C', cond: 'โรคเรื้อรัง', equipment: null }
  return null // เด็กเล็ก/ทั่วไป — ไม่เข้าทะเบียน care registry
}

async function main() {
  const { getDb } = await import('@/lib/db')
  const { households, householdMembers } = await import('./schema')
  const db = getDb()

  // ล้างของ mock เดิม (ลำดับตาม FK)
  await db.delete(householdMembers)
  await db.delete(households)

  let houseN = 0
  let memberN = 0
  let vulnN = 0

  for (const prov of PROVINCES) {
    for (const v of prov.villages) {
      const nHouses = randInt(2, 4)
      for (let h = 0; h < nHouses; h++) {
        const lat = jitter(v.lat, 0.01)
        const lng = jitter(v.lng, 0.01)
        const hno = `${randInt(1, 299)}/${randInt(1, 20)}`

        const [house] = await db.insert(households).values({
          hno,
          villageName: v.villageName,
          villno: v.villno,
          villcode: v.villcode,
          tambon: v.tambon,
          amphoe: v.amphoe,
          province: prov.province,
          lat: String(lat),
          lng: String(lng),
        }).returning()
        houseN++

        const fam = makeFamily()
        for (const m of fam) {
          // member = คน 1 คน; ถ้าเข้าเกณฑ์กลุ่มดูแลให้ใส่ฟิลด์สุขภาพในแถวเดียวกัน (type != null)
          const vp = toVulnerable(m)
          await db.insert(householdMembers).values({
            householdId: house.id,
            prefix: m.prefix,
            firstName: m.firstName,
            lastName: m.lastName,
            age: m.age,
            sex: m.sex,
            phone: thaiPhone(),
            familyPosition: m.familyPosition,
            isHead: m.isHead,
            isDisabled: m.isDisabled,
            isChronic: m.isChronic,
            father: m.father ?? null,
            mother: m.mother ?? null,
            mate: m.mate ?? null,
            // ── ส่วนขยายสุขภาพ (เฉพาะคนในทะเบียนดูแล) ──
            ...(vp
              ? {
                  type: vp.type,
                  label: vp.label,
                  cond: vp.cond,
                  equipment: vp.equipment,
                  village: `ม.${v.villno} ${v.villageName}`,
                  tambon: v.tambon,
                  amphoe: v.amphoe,
                  province: prov.province,
                  lat: String(jitter(lat, 0.001)),
                  lng: String(jitter(lng, 0.001)),
                  caregiverPhone: `08${randInt(1, 9)}${String(randInt(0, 9999999)).padStart(7, '0')}`,
                  careUnit: `รพ.สต.${v.tambon}`,
                  medicalPriority: vp.priority,
                  followUpStatus: 'pending',
                  consent: chance(0.7),
                  sourceSystem: 'import',
                  sourceUnit: prov.abbr,
                  sourceSyncedAt: new Date(),
                }
              : {}),
          })
          memberN++
          if (vp) vulnN++
        }
      }
    }
  }

  console.log(`✓ ครัวเรือน ${houseN} · สมาชิก ${memberN} · กลุ่มเปราะบาง(ทะเบียน) ${vulnN}`)
  console.log('เสร็จสิ้น')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
