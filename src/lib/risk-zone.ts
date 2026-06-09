/**
 * นิยามกลาง "ประเภทโซนพื้นที่เสี่ยง" — ใช้ร่วมทั้ง API, panel และ map
 *
 * 2 ระดับ:
 *  - category : โซนถาวร (permanent เช่น น้ำท่วมซ้ำซาก) · โซนชั่วคราว (temporary เช่น แผ่นดินไหว โรคระบาด)
 *               — เป็นแนวคิดระบบ ตายตัว (ไม่ตั้งค่าได้)
 *  - hazardType : ชนิดภัยจริง — ตั้งค่าได้ (CRUD) เก็บในตาราง hazard_types, อ้างอิงด้วย `code`
 * หมายเหตุ: เกณฑ์ "ในเขตน้ำท่วม" นับเฉพาะ hazardType === 'flood' เท่านั้น (ดู flood-risk.ts)
 */
export type ZoneCategory = 'permanent' | 'temporary'

export const ZONE_CATEGORIES: { value: ZoneCategory; label: string; hint: string }[] = [
  { value: 'permanent', label: 'โซนถาวร', hint: 'พื้นที่เสี่ยงประจำ เช่น น้ำท่วมซ้ำซาก' },
  { value: 'temporary', label: 'โซนชั่วคราว', hint: 'เหตุการณ์เฉพาะกิจ เช่น แผ่นดินไหว โรคระบาด' },
]

export const ZONE_CATEGORY_VALUES = new Set<ZoneCategory>(['permanent', 'temporary'])
export function isZoneCategory(v: unknown): v is ZoneCategory {
  return typeof v === 'string' && ZONE_CATEGORY_VALUES.has(v as ZoneCategory)
}
export function zoneCategoryLabel(c: ZoneCategory): string {
  return ZONE_CATEGORIES.find((x) => x.value === c)?.label ?? c
}

// รูปแบบ "ชนิดภัย" ฝั่ง client (map มาจากตาราง hazard_types)
export interface HazardTypeDef {
  id: string
  code: string
  label: string
  category: ZoneCategory
  color: string
  emoji: string
  sortOrder: number
  isActive: boolean
  isSystem: boolean
}

// meta สำรองเมื่ออ้างถึง code ที่ถูกลบ/ปิดใช้งานไปแล้ว — กัน UI พัง
export const FALLBACK_HAZARD = { label: 'ภัยอื่น ๆ', color: 'oklch(0.62 0.02 260)', emoji: '⚠️' }

// ชุดสีมาตรฐาน — ใช้ทั้งตั้งค่าชนิดภัย และเลือกสีโซนตอนวาด
export const COLOR_PRESETS = [
  'oklch(0.60 0.18 240)', // ฟ้า-น้ำ
  'oklch(0.58 0.16 50)',  // ส้ม-ดิน
  'oklch(0.55 0.20 330)', // ม่วง-ชมพู
  'oklch(0.60 0.23 25)',  // แดง
  'oklch(0.70 0.17 145)', // เขียว
  'oklch(0.75 0.15 95)',  // เหลือง
  'oklch(0.62 0.02 260)', // เทา
]

/** สร้าง lookup meta จาก hazardTypes list (สำหรับ label/สี/emoji ตาม code) */
export function hazardMetaMap(
  defs: HazardTypeDef[],
): Record<string, { label: string; color: string; emoji: string }> {
  const m: Record<string, { label: string; color: string; emoji: string }> = {}
  for (const d of defs) m[d.code] = { label: d.label, color: d.color, emoji: d.emoji }
  return m
}
