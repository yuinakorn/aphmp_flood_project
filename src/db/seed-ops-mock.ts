/**
 * npm run db:seed:ops
 * เพิ่ม mock ผู้บาดเจ็บ/เสียชีวิต + โรคเฝ้าระวัง ผูกกับ incident ที่ active/monitoring
 * เพื่อให้ OpsPanel / counters ของ Phase E มีตัวเลขจริงให้ดู
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
  const { incidentCasualties, diseaseSurveillance, incidents } = await import('./schema')
  const { inArray } = await import('drizzle-orm')
  const db = getDb()

  const active = await db
    .select({ id: incidents.id, amphoe: incidents.amphoe, tambon: incidents.tambon })
    .from(incidents)
    .where(inArray(incidents.status, ['active', 'monitoring']))
    .limit(1)

  const inc = active[0]
  if (!inc) {
    console.log('✗ ไม่พบ incident ที่ active/monitoring — สร้างเหตุการณ์ก่อนแล้วรันใหม่')
    process.exit(0)
  }
  const incidentId = inc.id
  const amphoe = inc.amphoe ?? 'แม่สาย'
  const tambon = inc.tambon ?? 'เวียงพางคำ'

  const casualties = [
    { incidentId, casualtyType: 'dead', cause: 'drowning', personName: 'นายสมชาย ใจดี', age: 67, sex: 'ชาย', amphoe, tambon, notes: 'พบในบ้านชั้นเดียวริมน้ำ' },
    { incidentId, casualtyType: 'dead', cause: 'electrocution', personName: 'นางสาวมาลี ทองคำ', age: 54, sex: 'หญิง', amphoe, tambon },
    { incidentId, casualtyType: 'injured', severity: 'moderate', cause: 'trauma', personName: 'นายอนุชา ก้าวหน้า', age: 41, sex: 'ชาย', amphoe, tambon, notes: 'ลื่นล้มขณะอพยพ' },
    { incidentId, casualtyType: 'injured', severity: 'minor', cause: 'trauma', age: 33, sex: 'หญิง', amphoe, tambon },
    { incidentId, casualtyType: 'injured', severity: 'severe', cause: 'other', personName: 'เด็กชายภูมิ รักไทย', age: 9, sex: 'ชาย', amphoe, tambon },
    { incidentId, casualtyType: 'missing', personName: 'นายประสิทธิ์ มั่นคง', age: 72, sex: 'ชาย', amphoe, tambon, notes: 'ออกจากบ้านไปก่อนน้ำขึ้น ยังติดต่อไม่ได้' },
    { incidentId, casualtyType: 'ill', cause: 'disease', personName: 'นางบุญมี สุขสันต์', age: 60, sex: 'หญิง', amphoe, tambon, notes: 'ผู้ป่วย CKD ขาดการฟอกไต' },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const surveillance = [
    { incidentId, diseaseCode: 'foot_immersion', caseCount: 48, reportDate: today, amphoe, tambon },
    { incidentId, diseaseCode: 'diarrhea', caseCount: 23, reportDate: today, amphoe, tambon },
    { incidentId, diseaseCode: 'fever', caseCount: 31, reportDate: today, amphoe, tambon },
    { incidentId, diseaseCode: 'conjunctivitis', caseCount: 12, reportDate: today, amphoe, tambon },
    { incidentId, diseaseCode: 'stress', caseCount: 19, reportDate: today, amphoe, tambon },
    { incidentId, diseaseCode: 'leptospirosis', caseCount: 4, reportDate: today, amphoe, tambon },
    { incidentId, diseaseCode: 'foot_immersion', caseCount: 35, reportDate: yesterday, amphoe, tambon },
    { incidentId, diseaseCode: 'diarrhea', caseCount: 18, reportDate: yesterday, amphoe, tambon },
    { incidentId, diseaseCode: 'other', diseaseLabel: 'งูสวัด', caseCount: 3, reportDate: today, amphoe, tambon },
  ]

  await db.insert(incidentCasualties).values(casualties)
  await db.insert(diseaseSurveillance).values(surveillance)
  console.log(
    `✓ seeded ${casualties.length} casualties + ${surveillance.length} surveillance rows (incident: ${incidentId})`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
