/**
 * npm run db:backfill:flood-codes
 * เติมรหัสจุด (code) ให้ flood mark เดิมที่ยังไม่มี — running number แยกตามจังหวัด
 * เรียงตาม observedAt เก่า→ใหม่ แล้วตั้งค่าตัวนับ (user_flood_mark_code_seq) ให้ตรงกับเลขล่าสุด
 * idempotent: รันซ้ำได้ จะข้ามหมุดที่มี code แล้ว
 */
import { existsSync, readFileSync } from 'node:fs'
import { asc, eq, isNull, and } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'
import { floodMarkProvinceAbbr, formatFloodMarkCode } from '@/lib/flood-marks'

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    process.env[line.slice(0, i)] ??= line.slice(i + 1)
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not configured')
  const client = postgres(url, { prepare: false })
  const db = drizzle(client, { schema })

  // หมุดที่ยังใช้งานอยู่และยังไม่มี code — เรียงตามเวลาวัด (เก่าก่อน) แล้ว createdAt/id เพื่อ tie-break คงที่
  const rows = await db
    .select()
    .from(schema.userFloodMarks)
    .where(and(isNull(schema.userFloodMarks.deletedAt), isNull(schema.userFloodMarks.code)))
    .orderBy(
      asc(schema.userFloodMarks.observedAt),
      asc(schema.userFloodMarks.createdAt),
      asc(schema.userFloodMarks.id),
    )

  // ตัวนับเริ่มต้นต่อ prefix = ค่าล่าสุดที่มีอยู่แล้วในตาราง seq (กันการรันต่อจากของเดิม)
  const existingSeq = await db.select().from(schema.userFloodMarkCodeSeq)
  const counters = new Map<string, number>(existingSeq.map((s) => [s.prefix, s.lastNo]))

  let assigned = 0
  let skipped = 0

  for (const row of rows) {
    const abbr = floodMarkProvinceAbbr(row.province)
    if (!abbr) {
      skipped++
      continue
    }
    const next = (counters.get(abbr) ?? 0) + 1
    counters.set(abbr, next)
    const code = formatFloodMarkCode(abbr, next)
    await db
      .update(schema.userFloodMarks)
      .set({ code })
      .where(eq(schema.userFloodMarks.id, row.id))
    assigned++
  }

  // sync ตัวนับให้ตรงกับเลขล่าสุดของแต่ละ prefix
  for (const [prefix, lastNo] of counters) {
    await db
      .insert(schema.userFloodMarkCodeSeq)
      .values({ prefix, lastNo })
      .onConflictDoUpdate({ target: schema.userFloodMarkCodeSeq.prefix, set: { lastNo } })
  }

  console.log(`backfill เสร็จ: เติม ${assigned} จุด, ข้าม ${skipped} จุด (ไม่มีจังหวัด/นอกขอบเขต)`)
  for (const [prefix, lastNo] of [...counters].sort()) {
    console.log(`  ${prefix}: ${lastNo}`)
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
