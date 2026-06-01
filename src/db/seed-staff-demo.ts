/**
 * seed-staff-demo.ts — เจ้าหน้าที่ทดสอบสำหรับ ThaiD (จำลอง)
 * รัน: npm run db:seed:staff
 *
 * ครอบทุกสถานะของ state machine (active / pending / suspended)
 * CID ที่ไม่อยู่ในรายการนี้ = not_found → เข้าสู่ flow self-register
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

import { hashCid } from '@/lib/cid'
import type { UserRole } from '@/types'

const DEMO_STAFF: {
  cid: string
  name: string
  role: UserRole
  province: string
  unitName: string
  status: 'active' | 'pending' | 'suspended'
}[] = [
  // เชียงราย
  { cid: '1101700234568', name: 'นพ. สมชาย ผู้บัญชาการ', role: 'eoc', province: 'เชียงราย', unitName: 'สสจ.เชียงราย (EOC)', status: 'active' },
  { cid: '3570100987656', name: 'นาง สมศรี เจ้าหน้าที่', role: 'officer', province: 'เชียงราย', unitName: 'รพ.สต.แม่สาย', status: 'active' },
  { cid: '1123400567890', name: 'อสม. สมหญิง ใจดี', role: 'vhv', province: 'เชียงราย', unitName: 'รพ.สต.เวียงพางคำ', status: 'pending' },
  // เชียงใหม่
  { cid: '1550100234562', name: 'นพ. มานพ เวียงพิงค์', role: 'eoc', province: 'เชียงใหม่', unitName: 'สสจ.เชียงใหม่ (EOC)', status: 'active' },
  { cid: '1550100789122', name: 'นาง วันดี ดอยสุเทพ', role: 'officer', province: 'เชียงใหม่', unitName: 'รพ.สต.สันทราย', status: 'active' },
  { cid: '5901100112238', name: 'นาย ถูกระงับ สิทธิ์', role: 'officer', province: 'เชียงใหม่', unitName: 'รพ.สต.ทดสอบ', status: 'suspended' },
  // น่าน
  { cid: '1655200345670', name: 'นพ. ประยุทธ น่านนคร', role: 'eoc', province: 'น่าน', unitName: 'สสจ.น่าน (EOC)', status: 'active' },
  { cid: '1655200891232', name: 'นาง บัวลอย เมืองน่าน', role: 'vhv', province: 'น่าน', unitName: 'รพ.สต.เวียงสา', status: 'active' },
]

// เหตุการณ์ทดสอบประจำจังหวัด — ให้เจ้าหน้าที่แต่ละจังหวัดมีเหตุการณ์ให้เลือก (idempotent ตามชื่อ)
const DEMO_INCIDENTS: { name: string; province: string; amphoe: string; tambon: string }[] = [
  { name: 'น้ำท่วม สันทราย (ทดสอบ)', province: 'เชียงใหม่', amphoe: 'สันทราย', tambon: 'สันทรายหลวง' },
  { name: 'น้ำท่วม เวียงสา (ทดสอบ)', province: 'น่าน', amphoe: 'เวียงสา', tambon: 'กลางเวียง' },
]

async function main() {
  const { getDb } = await import('@/lib/db')
  const { users, incidents } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')
  const db = getDb()

  // เหตุการณ์ทดสอบประจำจังหวัด
  for (const inc of DEMO_INCIDENTS) {
    const [existing] = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.name, inc.name)).limit(1)
    if (existing) {
      console.log(`↻ incident มีอยู่แล้ว: ${inc.name}`)
    } else {
      await db.insert(incidents).values({ name: inc.name, type: 'flood', status: 'active', province: inc.province, amphoe: inc.amphoe, tambon: inc.tambon })
      console.log(`+ เปิดเหตุการณ์: ${inc.name} [${inc.province}]`)
    }
  }

  for (const s of DEMO_STAFF) {
    const cidHash = hashCid(s.cid)
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.cidHash, cidHash)).limit(1)
    const values = {
      cidHash,
      name: s.name,
      role: s.role,
      province: s.province,
      unitName: s.unitName,
      status: s.status,
      registeredVia: 'whitelist' as const,
    }
    if (existing) {
      await db.update(users).set(values).where(eq(users.id, existing.id))
      console.log(`↻ updated ${s.cid} — ${s.name} [${s.status}]`)
    } else {
      await db.insert(users).values(values)
      console.log(`+ created ${s.cid} — ${s.name} [${s.status}]`)
    }
  }
  console.log('\n✓ seed staff demo เสร็จ')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
