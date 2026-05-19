'use client'

import { useEffect, useState, useCallback } from 'react'
import { TriangleAlert, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { FloodAlertResponse } from '@/app/api/cmu-flood-alert/route'
import type { AlertLevel } from '@/lib/water-level'

const POLL_INTERVAL_MS = 5 * 60 * 1000

type EffectiveLevel = AlertLevel | 'patients_only'

interface AlertMeta {
  color: string   // icon, label, water-level number
  bg: string      // subtle tint behind the header row
  border: string  // full border color
  label: string
  pulse: boolean
}

const ALERT_META: Record<EffectiveLevel, AlertMeta> = {
  normal:        { color: 'oklch(0.55 0.010 245)', bg: 'oklch(0.22 0.011 245 / 0)',    border: 'oklch(0.30 0.012 245)',      label: 'ปกติ',         pulse: false },
  patients_only: { color: 'oklch(0.68 0.15 230)',  bg: 'oklch(0.68 0.15 230 / 0.10)',  border: 'oklch(0.68 0.15 230 / 0.5)', label: 'ผู้ป่วยในโซน',  pulse: false },
  warning:       { color: 'oklch(0.82 0.16 85)',   bg: 'oklch(0.82 0.16 85 / 0.10)',   border: 'oklch(0.82 0.16 85 / 0.55)', label: 'เฝ้าระวัง',    pulse: false },
  prepare:       { color: 'oklch(0.76 0.18 55)',   bg: 'oklch(0.76 0.18 55 / 0.12)',   border: 'oklch(0.76 0.18 55 / 0.60)', label: 'เตรียมพร้อม', pulse: false },
  critical:      { color: 'oklch(0.68 0.20 30)',   bg: 'oklch(0.68 0.20 30 / 0.14)',   border: 'oklch(0.68 0.20 30 / 0.70)', label: 'วิกฤต',        pulse: false },
  danger:        { color: 'oklch(0.62 0.22 22)',   bg: 'oklch(0.62 0.22 22 / 0.16)',   border: 'oklch(0.62 0.22 22 / 0.80)', label: 'อันตรายสูง',  pulse: true  },
  rapid_rise:    { color: 'oklch(0.75 0.20 310)',  bg: 'oklch(0.75 0.20 310 / 0.12)',  border: 'oklch(0.75 0.20 310 / 0.65)', label: 'น้ำขึ้นเร็ว', pulse: true  },
}

const ZONE_THRESHOLD: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '4.30', 2: '4.50', 3: '4.70', 4: '5.00', 5: '5.30',
}

const ZONE_COLOR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'oklch(0.82 0.16 85)',
  2: 'oklch(0.76 0.18 55)',
  3: 'oklch(0.72 0.19 45)',
  4: 'oklch(0.68 0.20 30)',
  5: 'oklch(0.62 0.22 22)',
}

export function FloodAlertBanner() {
  const [data, setData] = useState<FloodAlertResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const fetchAlert = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cmu-flood-alert')
      if (res.ok) {
        const json = (await res.json()) as FloodAlertResponse
        setData(json)
        setDismissed(false)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlert()
    const id = setInterval(fetchAlert, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchAlert])

  if (!data) return null

  const hasPatients =
    data.counts.level1 + data.counts.level2 + data.counts.level3 +
    data.counts.level4 + data.counts.level5 > 0

  const isNormal = data.alertLevel === 'normal'
  if (isNormal && !hasPatients) return null
  if (dismissed) return null

  const effectiveLevel: EffectiveLevel =
    !isNormal ? data.alertLevel : hasPatients ? 'patients_only' : 'normal'

  const meta = ALERT_META[effectiveLevel]

  const levelEntries = ([1, 2, 3, 4, 5] as const).map((l) => ({
    l,
    count: data.counts[`level${l}` as keyof typeof data.counts] as number,
    active: data.activeZone != null && l <= data.activeZone,
  }))

  const flooded = levelEntries.filter((e) => e.active  && e.count > 0)
  const atRisk  = levelEntries.filter((e) => !e.active && e.count > 0)

  return (
    <div
      role="alert"
      className="pointer-events-auto absolute left-1/2 top-3 z-[500] w-full max-w-[520px] -translate-x-1/2 overflow-hidden rounded-lg"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${meta.border}`,
        boxShadow: '0 4px 24px oklch(0 0 0 / 0.55)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-3.5 py-2.5"
        style={{ background: meta.bg }}
      >
        {/* Status pill */}
        <div className="flex shrink-0 items-center gap-1.5">
          <TriangleAlert
            size={13}
            strokeWidth={2.2}
            className={meta.pulse ? 'animate-pulse' : ''}
            style={{ color: meta.color }}
          />
          <span
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
        </div>

        {/* Separator */}
        <span className="h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />

        {/* Water level — primary number */}
        {data.waterLevel != null && (
          <div className="flex shrink-0 items-baseline gap-1">
            <span
              className="font-mono text-[20px] font-semibold tabular-nums leading-none"
              style={{ color: meta.color }}
            >
              {data.waterLevel.toFixed(2)}
            </span>
            <span className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
              ม.
            </span>
            <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
              P.1
            </span>
          </div>
        )}

        {/* Patient count */}
        {data.affectedTotal > 0 && (
          <>
            <span className="h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />
            <div className="flex items-baseline gap-1">
              <span
                className="font-mono text-[20px] font-semibold tabular-nums leading-none"
                style={{ color: 'var(--risk-flood)' }}
              >
                {data.affectedTotal}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>ราย</span>
              <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>ในพื้นที่ท่วม</span>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={fetchAlert}
            disabled={loading}
            aria-label="รีเฟรช"
            className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: 'var(--fg-subtle)' }}
          >
            <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'ย่อ' : 'ดูรายละเอียด'}
            className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: 'var(--fg-subtle)' }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="ปิด"
            className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: 'var(--fg-subtle)' }}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Expanded detail ──────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-sunken)] px-3.5 py-2.5">
          {flooded.length > 0 && (
            <div className="mb-2.5">
              <p className="mb-1.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                ท่วมแล้ว
              </p>
              <div className="flex flex-wrap gap-1.5">
                {flooded.map(({ l, count }) => (
                  <div
                    key={l}
                    className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: ZONE_COLOR[l] }}
                    />
                    <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--fg)' }}>
                      L{l}
                    </span>
                    <span className="text-[9.5px]" style={{ color: 'var(--fg-subtle)' }}>
                      ≥ {ZONE_THRESHOLD[l]} ม.
                    </span>
                    <span
                      className="font-mono text-[11px] font-bold tabular-nums"
                      style={{ color: ZONE_COLOR[l] }}
                    >
                      {count}
                    </span>
                    <span className="text-[9.5px]" style={{ color: 'var(--fg-muted)' }}>ราย</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {atRisk.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                เสี่ยงถ้าน้ำขึ้น
              </p>
              <div className="flex flex-wrap gap-1.5">
                {atRisk.map(({ l, count }) => (
                  <div
                    key={l}
                    className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 opacity-70"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full opacity-50"
                      style={{ background: ZONE_COLOR[l] }}
                    />
                    <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--fg-muted)' }}>
                      L{l}
                    </span>
                    <span className="text-[9.5px]" style={{ color: 'var(--fg-subtle)' }}>
                      ถึง {ZONE_THRESHOLD[l]} ม.
                    </span>
                    <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: 'var(--fg-muted)' }}>
                      {count}
                    </span>
                    <span className="text-[9.5px]" style={{ color: 'var(--fg-subtle)' }}>ราย</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasPatients && (
            <p className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
              ยังไม่พบผู้ป่วยกลุ่มเปราะบางในพื้นที่น้ำท่วม
            </p>
          )}

          <p className="mt-2 text-[9px]" style={{ color: 'var(--fg-subtle)' }}>
            อัปเดต {new Date(data.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · CMU Water Center · P.1 นวรัฐ
          </p>
        </div>
      )}
    </div>
  )
}
