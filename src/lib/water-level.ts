import type { ChannelGeometry } from './hydraulics'

export type AlertLevel =
  | 'normal'
  | 'warning'
  | 'prepare'
  | 'critical'
  | 'danger'
  | 'rapid_rise'

export type StationThreshold = {
  code: string
  name: string
  warning: number
  prepare: number
  critical: number
  danger: number
  rapidRise: number
}


// channel = หน้าตัดช่องน้ำโดยประมาณ (trapezoid) สำหรับสมการ Manning —
// เป็นค่า config เชิงสมมติฐานทางวิศวกรรม (ความกว้างท้องน้ำ/ลาดตลิ่ง/n/ความลาด)
// ใช้เป็น fallback ประมาณความเร็วน้ำ+เวลาเดินทางเมื่อหา lag จากข้อมูลจริงไม่ได้
// ค่าที่ขับ simulation จริงคือ level/discharge จาก water_level_observation
export const PROVINCE_CONFIGS = {
  chiangmai: {
    label: 'เชียงใหม่',
    river: 'ลุ่มน้ำปิง',
    s1: 'P.67',
    s2: 'P.1',
    travelLabel: 'P.67 → P.1 ประมาณ 4–6 ชม.',
    distanceLabel: 'ระยะ ~20 กม.',
    alertMode: 'threshold' as const,
    bounds: [[18.60, 98.85], [19.00, 99.15]] as [[number, number], [number, number]],
    fallbackTravelHours: [4, 6] as [number, number],
    channel: { bottomWidthM: 40, sideSlope: 2, manningN: 0.035, bedSlope: 0.0015, lengthKm: 20 } as ChannelGeometry,
  },
  nan: {
    label: 'น่าน',
    river: 'ลุ่มน้ำน่าน',
    s1: 'N.64',
    s2: 'N.1',
    travelLabel: 'N.64 → N.1 ประมาณ 6–8 ชม.',
    distanceLabel: 'ระยะ ~35 กม.',
    alertMode: 'threshold' as const,
    bounds: [[18.55, 100.65], [19.00, 101.00]] as [[number, number], [number, number]],
    fallbackTravelHours: [6, 8] as [number, number],
    channel: { bottomWidthM: 45, sideSlope: 2, manningN: 0.035, bedSlope: 0.0012, lengthKm: 35 } as ChannelGeometry,
  },
  chiangrai: {
    label: 'เชียงราย (เมือง)',
    river: 'ลุ่มน้ำกก',
    s1: 'G.10',
    s2: 'G.8A',
    travelLabel: 'G.10 → G.8A ประมาณ 3–5 ชม.',
    distanceLabel: 'ระยะ ~25 กม.',
    alertMode: 'threshold' as const,
    bounds: [[19.75, 99.70], [20.10, 100.10]] as [[number, number], [number, number]],
    fallbackTravelHours: [3, 5] as [number, number],
    channel: { bottomWidthM: 35, sideSlope: 2, manningN: 0.035, bedSlope: 0.002, lengthKm: 25 } as ChannelGeometry,
  },
  chiangrai_maesai: {
    label: 'เชียงราย (แม่สาย)',
    river: 'ลุ่มน้ำสาย',
    s1: 'Kh.72',
    s2: 'Kh.89',
    travelLabel: 'Kh.72 → Kh.89 ประมาณ 1–2 ชม.',
    distanceLabel: 'ระยะ ~12 กม.',
    alertMode: 'rise_speed' as const,
    bounds: [[20.30, 99.70], [20.55, 100.00]] as [[number, number], [number, number]],
    fallbackTravelHours: [1, 2] as [number, number],
    // แม่น้ำสายภูเขา: แคบ ชัน ขรุขระ — น้ำป่ามาเร็ว
    channel: { bottomWidthM: 15, sideSlope: 1.5, manningN: 0.04, bedSlope: 0.006, lengthKm: 12 } as ChannelGeometry,
  },
} as const

export type ProvinceId = keyof typeof PROVINCE_CONFIGS
export type ProvinceConfig = (typeof PROVINCE_CONFIGS)[ProvinceId]

// threshold ที่เป็น 0 หรือ null ถือว่า "ยังไม่กำหนด" — ไม่ใช้ trigger สถานะ
// (มิฉะนั้น level ใด ๆ ที่ > 0 จะถูกตีเป็น danger ทันที)
export function classifyAlert(
  level: number | null,
  rise3h: number | null,
  t: StationThreshold,
): AlertLevel {
  if (level == null) return 'normal'
  if (t.danger > 0 && level >= t.danger) return 'danger'
  if (t.critical > 0 && level >= t.critical) return 'critical'
  if (rise3h != null && t.rapidRise > 0 && rise3h >= t.rapidRise) return 'rapid_rise'
  if (t.prepare > 0 && level >= t.prepare) return 'prepare'
  if (t.warning > 0 && level >= t.warning) return 'warning'
  return 'normal'
}

// Rise-speed-first classifier for flash-flood rivers like Mae Sai (Sai River).
// Small mountain rivers respond far faster than large rivers — a 0.5 m/h rise
// at Kh.72 leaves only ~1–2 h before Kh.89 is affected, so speed matters more
// than absolute level alone.
//
// Thresholds are derived from Thai RID flash-flood guidance and the September
// 2024 Mae Sai event (≈ 0.5–0.8 m/h peak rise rate during critical phase).
export function classifyAlertMaesai(
  level: number | null,
  rise1h: number | null,
  rise3h: number | null,
  t: StationThreshold,
): AlertLevel {
  if (level == null) return 'normal'

  // Absolute level overrides first (infrastructure integrity)
  // threshold ที่เป็น 0 ถือว่ายังไม่กำหนด — ข้ามไป (ไม่งั้น level ใด ๆ จะเป็น danger ทันที)
  if (t.danger > 0 && level >= t.danger) return 'danger'
  if (t.critical > 0 && level >= t.critical) return 'critical'

  // Rise rate per hour — prefer 1-h reading, fall back to 3-h average
  const rph = rise1h ?? (rise3h != null ? rise3h / 3 : null)
  if (rph != null && rph > 0) {
    if (rph >= 1.00) return 'danger'    // ≥ 1.00 m/h — extreme flash flood
    if (rph >= 0.50) return 'critical'  // ≥ 0.50 m/h — very rapid rise
    if (rph >= 0.25) return 'prepare'   // ≥ 0.25 m/h — rising fast
    if (rph >= 0.10) return 'warning'   // ≥ 0.10 m/h — noticeable rise
  }

  // Absolute level fallback when water is rising slowly or stable
  if (t.prepare > 0 && level >= t.prepare) return 'prepare'
  if (t.warning > 0 && level >= t.warning) return 'warning'
  return 'normal'
}

export const ALERT_STYLES: Record<
  AlertLevel,
  { label: string; dot: string; text: string; bg: string }
> = {
  normal: {
    label: 'ปกติ',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  },
  warning: {
    label: 'เฝ้าระวัง',
    dot: 'bg-yellow-500',
    text: 'text-amber-800 dark:text-yellow-350',
    bg: 'bg-amber-50/50 border-amber-200 dark:bg-yellow-500/10 dark:border-yellow-500/30',
  },
  prepare: {
    label: 'เตรียมพร้อม',
    dot: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50/50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30',
  },
  critical: {
    label: 'วิกฤต',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50/50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30',
  },
  danger: {
    label: 'อันตรายสูง',
    dot: 'bg-red-600 animate-pulse',
    text: 'text-red-800 dark:text-red-300',
    bg: 'bg-red-100/40 border-red-300 dark:bg-red-600/15 dark:border-red-600/40',
  },
  rapid_rise: {
    label: 'น้ำขึ้นเร็ว',
    dot: 'bg-fuchsia-500 animate-pulse',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    bg: 'bg-fuchsia-50/50 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/30',
  },
}
