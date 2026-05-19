'use client'

import { ChevronDown } from 'lucide-react'
import type { VulnerableStats } from '@/types'
import type { AlertLevel, ProvinceId } from '@/lib/water-level'
import { PROVINCE_CONFIGS } from '@/lib/water-level'

const ALERT_LABEL: Record<AlertLevel, string> = {
  normal:     'ปกติ',
  warning:    'เฝ้าระวัง',
  prepare:    'เตรียมพร้อม',
  critical:   'วิกฤต',
  danger:     'อันตรายสูง',
  rapid_rise: 'น้ำขึ้นเร็ว',
}

const ALERT_TONE: Record<AlertLevel, string> = {
  normal:     'var(--risk-safe)',
  warning:    'oklch(0.85 0.16 85)',
  prepare:    'oklch(0.78 0.18 55)',
  critical:   'oklch(0.68 0.22 25)',
  danger:     'oklch(0.58 0.24 20)',
  rapid_rise: 'oklch(0.75 0.20 310)',
}

interface Props {
  waterLevel: number | null
  activeZone: 1 | 2 | 3 | 4 | 5 | null
  alertLevel: AlertLevel
  vulnerable: VulnerableStats
  updatedAt?: string | null
  province: ProvinceId
  onProvinceChange: (p: ProvinceId) => void
  onFloodClick?: () => void
  onNearClick?: () => void
}

interface FieldProps {
  label: string
  value: string | number
  delta?: string
  color?: string
  onClick?: () => void
}

function Field({ label, value, delta, color = 'var(--fg)', onClick }: FieldProps) {
  const inner = (
    <>
      <span className="text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-[var(--fg-subtle)]">
        {label}
      </span>
      <div className="flex items-baseline gap-2.5 leading-none">
        <span className="font-mono text-[22px] font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
        {delta && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--fg-muted)]">
            {delta}
          </span>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex min-w-[112px] flex-col justify-center gap-1.5 rounded-md px-2 -mx-2 transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        title="คลิกเพื่อดูรายชื่อ"
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="flex min-w-[112px] flex-col justify-center gap-1.5">
      {inner}
    </div>
  )
}

const Divider = () => (
  <span aria-hidden className="h-10 w-px self-center bg-[var(--border)]" />
)

const ZONE_THRESHOLD: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '≥ 4.30 ม.',
  2: '≥ 4.50 ม.',
  3: '≥ 4.70 ม.',
  4: '≥ 5.00 ม.',
  5: '≥ 5.30 ม.',
}

export function StatusStrip({ waterLevel, activeZone, alertLevel, vulnerable, updatedAt, province, onProvinceChange, onFloodClick, onNearClick }: Props) {
  const wlDisplay = waterLevel != null ? waterLevel.toFixed(2) : '—'
  const zoneDisplay = activeZone != null ? `L${activeZone}` : '< L1'
  const zoneDelta = activeZone != null ? ZONE_THRESHOLD[activeZone] : 'ต่ำกว่า 4.30 ม.'

  const timeDisplay = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex h-[76px] shrink-0 items-stretch gap-10 border-b border-[var(--border)] bg-[var(--bg)] px-8">
      {/* Province selector */}
      <div className="flex min-w-[130px] flex-col justify-center gap-1.5">
        <span className="text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-[var(--fg-subtle)]">
          จังหวัด
        </span>
        <div className="relative flex items-center">
          <select
            value={province}
            onChange={(e) => onProvinceChange(e.target.value as ProvinceId)}
            className="w-full appearance-none rounded border border-[var(--border)] bg-[var(--bg-elevated)] py-0.5 pl-2 pr-6 font-mono text-[13px] font-semibold text-[var(--fg)] outline-none transition-colors hover:border-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-0"
          >
            {(Object.keys(PROVINCE_CONFIGS) as ProvinceId[]).map((id) => (
              <option key={id} value={id}>
                {PROVINCE_CONFIGS[id].label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={11}
            className="pointer-events-none absolute right-1.5 text-[var(--fg-muted)]"
          />
        </div>
      </div>
      <Divider />
      <Field
        label="ระดับน้ำ P.1"
        value={wlDisplay}
        delta={ALERT_LABEL[alertLevel]}
        color={ALERT_TONE[alertLevel]}
      />
      <Divider />
      <Field
        label="CMU โซนปัจจุบัน"
        value={zoneDisplay}
        delta={zoneDelta}
        color={activeZone != null ? ALERT_TONE[alertLevel] : 'var(--fg-muted)'}
      />
      <Divider />
      <Field
        label="ผู้ป่วยในพื้นที่ท่วม"
        value={vulnerable.flood}
        delta={vulnerable.flood > 0 ? 'ต้องอพยพ' : '—'}
        color={vulnerable.flood > 0 ? 'var(--risk-flood)' : 'var(--fg)'}
        onClick={onFloodClick}
      />
      <Divider />
      <Field
        label="ผู้ป่วยเสี่ยง"
        value={vulnerable.near}
        delta={vulnerable.near > 0 ? 'ถ้าน้ำขึ้น' : '—'}
        color={vulnerable.near > 0 ? 'var(--risk-near)' : 'var(--fg)'}
        onClick={onNearClick}
      />
      <Divider />
      <Field
        label="ปลอดภัย"
        value={vulnerable.safe}
        delta={`จาก ${vulnerable.total}`}
        color="var(--risk-safe)"
      />

      <div className="ml-auto flex items-center gap-3.5 self-center pl-6">
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          {timeDisplay ? 'อัปเดต' : 'CMU Water Center'}
        </span>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${
              alertLevel !== 'normal'
                ? 'bg-[var(--risk-flood)] pulse-live'
                : 'bg-[var(--signal-data)]'
            }`}
          />
          <span className="font-mono text-[12px] tabular-nums text-[var(--fg-muted)]">
            {timeDisplay ?? 'P.1 นวรัฐ'}
          </span>
        </div>
      </div>
    </div>
  )
}
