/**
 * npm run db:seed:rescue
 * เพิ่มทีมกู้ภัย/หน่วยเคลื่อนที่เร็ว mock ตาม north star (health_gis_emergency_dashboard.html)
 * ผูกกับ incident ที่กำลัง active/monitoring ถ้ามี
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
  const { rescueTeams, incidents } = await import('./schema')
  const { inArray } = await import('drizzle-orm')
  const db = getDb()

  const active = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(inArray(incidents.status, ['active', 'monitoring']))
    .limit(1)
  const incidentId = active[0]?.id ?? null

  const rows = [
    {
      incidentId,
      name: 'ทีม GMC มณฑลทหารบกที่ 38',
      teamType: 'gmc_truck',
      contact: '054-711123',
      zone: 'โซนที่ 2 (บ.ท่าลี / บ.พญาภู)',
      status: 'active',
      lat: '18.7820', lng: '100.7780',
    },
    {
      incidentId,
      name: 'กู้ภัยแม่สายร่วมกตัญญู (ทีมเรือยาง)',
      teamType: 'rescue_boat',
      contact: '086-4545454',
      zone: 'โซนที่ 5 (พื้นที่ขอบเขตแม่สาย)',
      status: 'active',
      lat: '20.4290', lng: '99.8810',
    },
    {
      incidentId,
      name: 'หน่วยสุขภาพจิต MCAT รพ.น่าน',
      teamType: 'mcat_psych',
      contact: '054-719500',
      zone: 'โซนที่ 4 (เขตโรงเรียน/โรงพยาบาลสนาม)',
      status: 'active',
      lat: '18.7756', lng: '100.7716',
    },
  ]

  await db.insert(rescueTeams).values(rows)
  console.log(`✓ seeded ${rows.length} rescue teams (incident: ${incidentId ?? 'none'})`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
