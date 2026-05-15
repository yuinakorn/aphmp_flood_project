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

export const STATION_THRESHOLDS: Record<string, StationThreshold> = {
  'P.67': {
    code: 'P.67',
    name: 'บ้านแม่แต (ต้นน้ำ)',
    warning: 2.0,
    prepare: 2.5,
    critical: 2.8,
    danger: 3.0,
    rapidRise: 0.2,
  },
  'P.1': {
    code: 'P.1',
    name: 'สะพานนวรัฐ (ตัวเมือง)',
    warning: 2.5,
    prepare: 3.0,
    critical: 3.4,
    danger: 3.7,
    rapidRise: 0.2,
  },
}

export function classifyAlert(
  level: number | null,
  rise3h: number | null,
  t: StationThreshold,
): AlertLevel {
  if (level == null) return 'normal'
  if (level >= t.danger) return 'danger'
  if (level >= t.critical) return 'critical'
  if (rise3h != null && rise3h >= t.rapidRise) return 'rapid_rise'
  if (level >= t.prepare) return 'prepare'
  if (level >= t.warning) return 'warning'
  return 'normal'
}

export const ALERT_STYLES: Record<
  AlertLevel,
  { label: string; dot: string; text: string; bg: string }
> = {
  normal: {
    label: 'ปกติ',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  warning: {
    label: 'เฝ้าระวัง',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  prepare: {
    label: 'เตรียมพร้อม',
    dot: 'bg-orange-400',
    text: 'text-orange-300',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
  critical: {
    label: 'วิกฤต',
    dot: 'bg-red-500',
    text: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
  },
  danger: {
    label: 'อันตรายสูง',
    dot: 'bg-red-600 animate-pulse',
    text: 'text-red-300',
    bg: 'bg-red-600/15 border-red-600/40',
  },
  rapid_rise: {
    label: 'น้ำขึ้นเร็ว',
    dot: 'bg-fuchsia-400 animate-pulse',
    text: 'text-fuchsia-300',
    bg: 'bg-fuchsia-500/10 border-fuchsia-500/30',
  },
}
