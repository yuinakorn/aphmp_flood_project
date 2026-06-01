/**
 * npm run db:backfill:life-support
 *
 * Seed `household_members.life_support` (flag อุปกรณ์พยุงชีพ) จากข้อมูลที่มีอยู่:
 *   - freeform `equipment` / `cond` (จับคีย์เวิร์ดภาษาไทย/อังกฤษ)
 *   - `health_visits.oxygen_ready = true` (เคยประเมินว่าออกซิเจนพร้อม)
 *
 * เป็นเพียง "ค่าเริ่มต้นโดยประมาณ" — อสม. แก้ให้ถูกต้องผ่านฟอร์มเยี่ยมภายหลัง
 * (ระบบนี้ "ไม่มี" การเชื่อม HIS ดังนั้นไม่มี consumable countdown — เก็บเป็น flag คงที่)
 *
 * ปลอดภัย/idempotent: อัปเดตเฉพาะแถวที่ life_support IS NULL และพบสัญญาณอย่างน้อย 1 อย่าง
 * (ไม่ทับค่าที่ อสม. กรอกไว้แล้ว, ไม่เซ็ตคนที่ไม่พบสัญญาณ — ปล่อยให้ อสม. ประเมินเอง)
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

// code → คีย์เวิร์ดที่บ่งชี้ (lowercase, ครอบคลุมไทย+อังกฤษ)
const RULES: { code: string; keys: string[] }[] = [
  { code: 'oxygen',       keys: ['ออกซิเจน', 'ออกซิ', 'oxygen', 'o2', 'ถังอ๊อก', 'อ๊อกซิเจน'] },
  { code: 'dialysis_capd', keys: ['ฟอกไต', 'ล้างไต', 'ไตวาย', 'capd', 'dialysis', 'ไตเรื้อรัง', 'ckd'] },
  { code: 'ventilator',   keys: ['เครื่องช่วยหายใจ', 'ventilat', 'respirator', 'เจาะคอ', 'tracheostomy'] },
  { code: 'anti_seizure', keys: ['ลมชัก', 'กันชัก', 'อาการชัก', 'ชักเกร็ง', 'epilep', 'seizure'] },
  { code: 'feeding_tube', keys: ['สายให้อาหาร', 'สายยางให้อาหาร', 'สายอาหาร', 'feeding', 'ng tube', 'peg'] },
]

function classify(text: string, hasOxygenReady: boolean): string[] {
  const t = text.toLowerCase()
  const codes = new Set<string>()
  for (const { code, keys } of RULES) {
    if (keys.some((k) => t.includes(k))) codes.add(code)
  }
  if (hasOxygenReady) codes.add('oxygen')
  return [...codes]
}

async function main() {
  const { getDb } = await import('@/lib/db')
  const { householdMembers, healthVisits } = await import('./schema')
  const { isNull, isNotNull, and, eq } = await import('drizzle-orm')
  const db = getDb()

  // 1) สมาชิกในทะเบียนดูแล (type != null) ที่ยังไม่มี life_support
  const rows = await db
    .select({
      id: householdMembers.id,
      equipment: householdMembers.equipment,
      cond: householdMembers.cond,
    })
    .from(householdMembers)
    .where(and(isNotNull(householdMembers.type), isNull(householdMembers.lifeSupport)))

  // 2) member ที่เคยประเมินว่า oxygen_ready = true (เอาไว้บวก 'oxygen')
  const oxRows = await db
    .select({ memberId: healthVisits.memberId })
    .from(healthVisits)
    .where(eq(healthVisits.oxygenReady, true))
  const oxygenReady = new Set(oxRows.map((r) => r.memberId).filter(Boolean) as string[])

  let updated = 0
  const tally: Record<string, number> = {}

  for (const r of rows) {
    const text = `${r.equipment ?? ''} ${r.cond ?? ''}`
    const codes = classify(text, oxygenReady.has(r.id))
    if (codes.length === 0) continue // ไม่พบสัญญาณ → ปล่อยให้ อสม. ประเมิน
    await db
      .update(householdMembers)
      .set({ lifeSupport: codes, updatedAt: new Date() })
      .where(eq(householdMembers.id, r.id))
    updated++
    for (const c of codes) tally[c] = (tally[c] ?? 0) + 1
  }

  console.log(`scanned (in care, life_support null): ${rows.length}`)
  console.log(`updated with seeded life_support:     ${updated}`)
  console.log('by code:', tally)
  console.log('— อสม. ควรทบทวน/แก้ค่าผ่านฟอร์มเยี่ยมให้ตรงจริง —')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
