/**
 * โหลด "โซนเสี่ยงน้ำท่วม" (flood_risk_zones) สำหรับใช้จำแนกความเสี่ยงของบ้าน/บุคคล
 * แทนชุดจุดน้ำท่วม mockup เดิม (public/data/flood-points.json — จังหวัดน่าน)
 *
 * โพลิกอนเก็บเป็น [lng,lat][] (ตรงกับ pointInPolygon / classifyRiskByPolygons ใน geo.ts)
 * จัดกลุ่มตามจังหวัด เพื่อให้แต่ละคนถูกจำแนกเทียบกับโซนในจังหวัดของตนเองเท่านั้น
 */
import { isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { floodRiskZones } from '@/db/schema'

export type ZonesByProvince = Map<string, [number, number][][]>

export async function loadRiskZonesByProvince(): Promise<ZonesByProvince> {
  const db = getDb()
  const rows = await db
    .select({ province: floodRiskZones.province, polygon: floodRiskZones.polygon })
    .from(floodRiskZones)
    .where(isNull(floodRiskZones.deletedAt))

  const map: ZonesByProvince = new Map()
  for (const r of rows) {
    const poly = (r.polygon ?? []) as [number, number][]
    if (poly.length < 3) continue
    const arr = map.get(r.province) ?? []
    arr.push(poly)
    map.set(r.province, arr)
  }
  return map
}

/** โพลิกอนของจังหวัดที่ระบุ (คืน [] ถ้าไม่มีโซน หรือ province เป็น null) */
export function zonesFor(
  byProvince: ZonesByProvince,
  province: string | null | undefined,
): [number, number][][] {
  if (!province) return []
  return byProvince.get(province) ?? []
}
