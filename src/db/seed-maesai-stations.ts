/**
 * npm run db:seed:maesai
 * เพิ่ม/อัปเดตเกณฑ์เตือนของสถานีแม่น้ำสาย (Kh.72 ต้นน้ำ, Kh.89 ปลายน้ำ) ใน water_station
 *
 * ที่มาของค่า (Kh.89 — สถานีใต้สะพานมิตรภาพไทย-เมียนมา แห่งที่ 1 อ.แม่สาย):
 *   - เฝ้าระวัง (warning) 3.40 ม.  — ระดับเฝ้าระวังที่หน่วยงานใช้
 *   - น้ำล้นตลิ่ง (danger) 4.40 ม. — ระดับน้ำล้นตลิ่งเข้าท่วมชุมชน
 *   อ้างอิงข่าว ปภ./ThaiPBS เหตุการณ์แม่น้ำสาย 2567–2568
 *   prepare/critical เป็นค่า interpolate ระหว่าง 3.40–4.40 (ยังไม่มีตัวเลขทางการแยก)
 *
 * Kh.72 (ต้นน้ำ): ยังไม่มีเกณฑ์ระดับสัมบูรณ์ที่เผยแพร่ทางการ — เว้น null
 *   สถานีนี้เป็นแม่น้ำสายฉับพลัน ใช้ "อัตราการขึ้นของน้ำ" (rise speed) เป็นตัวชี้วัดหลักอยู่แล้ว
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
  const { waterStations } = await import('./schema')
  const db = getDb()

  const rows = [
    {
      stationCode: 'Kh.72',
      stationNameTh: 'แม่น้ำสาย ตอนบน (ต้นน้ำ)',
      stationNameEn: 'Mae Sai River upstream',
      riverBasin: 'ลุ่มน้ำสาย',
      province: 'เชียงราย',
      district: 'แม่สาย',
      warningLevel: null,
      prepareLevel: null,
      criticalLevel: null,
      dangerLevel: null,
      rapidRiseThreshold: '0.30',
      isActive: true,
    },
    {
      stationCode: 'Kh.89',
      stationNameTh: 'สะพานมิตรภาพไทย-เมียนมา แม่สาย (ปลายน้ำ)',
      stationNameEn: 'Mae Sai Friendship Bridge (downstream)',
      riverBasin: 'ลุ่มน้ำสาย',
      province: 'เชียงราย',
      district: 'แม่สาย',
      warningLevel: '3.40',
      prepareLevel: '3.70',
      criticalLevel: '4.10',
      dangerLevel: '4.40',
      rapidRiseThreshold: '0.30',
      isActive: true,
    },
  ]

  for (const r of rows) {
    await db
      .insert(waterStations)
      .values(r)
      .onConflictDoUpdate({
        target: waterStations.stationCode,
        set: {
          stationNameTh: r.stationNameTh,
          stationNameEn: r.stationNameEn,
          riverBasin: r.riverBasin,
          province: r.province,
          district: r.district,
          warningLevel: r.warningLevel,
          prepareLevel: r.prepareLevel,
          criticalLevel: r.criticalLevel,
          dangerLevel: r.dangerLevel,
          rapidRiseThreshold: r.rapidRiseThreshold,
          isActive: r.isActive,
          updatedAt: new Date(),
        },
      })
    console.log(`✓ ${r.stationCode} — ${r.stationNameTh}`)
  }

  console.log('เสร็จสิ้น')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
