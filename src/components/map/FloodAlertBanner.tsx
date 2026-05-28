'use client'

import { useEffect, useState, useCallback } from 'react'
import { TriangleAlert, X, RotateCcw } from 'lucide-react'
import type { AlertLevel } from '@/lib/water-level'
import { PROVINCE_CONFIGS, type ProvinceId } from '@/lib/water-level'

const POLL_INTERVAL_MS = 5 * 60 * 1000
const ROTATE_MS = 4500

interface StationSnap {
  code: string
  level: number | null
  alert: AlertLevel
}
interface ProvinceSummary {
  label: string
  river: string
  updatedAt: string | null
  s1: StationSnap
  s2: StationSnap
}
type SummaryData = Record<string, ProvinceSummary>

interface AlertMeta {
  color: string
  bg: string
  border: string
  label: string
  pulse: boolean
}

const ALERT_META: Record<AlertLevel, AlertMeta> = {
  normal:     { color: 'oklch(0.74 0.10 145)', bg: 'oklch(0.74 0.10 145 / 0.08)', border: 'oklch(0.74 0.10 145 / 0.40)', label: 'ปกติ',        pulse: false },
  warning:    { color: 'oklch(0.82 0.16 85)',  bg: 'oklch(0.82 0.16 85 / 0.10)',  border: 'oklch(0.82 0.16 85 / 0.55)', label: 'เฝ้าระวัง',   pulse: false },
  prepare:    { color: 'oklch(0.76 0.18 55)',  bg: 'oklch(0.76 0.18 55 / 0.12)',  border: 'oklch(0.76 0.18 55 / 0.60)', label: 'เตรียมพร้อม', pulse: false },
  rapid_rise: { color: 'oklch(0.75 0.20 310)', bg: 'oklch(0.75 0.20 310 / 0.12)', border: 'oklch(0.75 0.20 310 / 0.65)', label: 'น้ำขึ้นเร็ว', pulse: true  },
  critical:   { color: 'oklch(0.68 0.20 30)',  bg: 'oklch(0.68 0.20 30 / 0.14)',  border: 'oklch(0.68 0.20 30 / 0.70)', label: 'วิกฤต',       pulse: true  },
  danger:     { color: 'oklch(0.62 0.22 22)',  bg: 'oklch(0.62 0.22 22 / 0.16)',  border: 'oklch(0.62 0.22 22 / 0.80)', label: 'อันตรายสูง',  pulse: true  },
}

const SEVERITY: Record<AlertLevel, number> = {
  normal: 0, warning: 1, prepare: 2, rapid_rise: 3, critical: 4, danger: 5,
}

function moreSevere(a: AlertLevel, b: AlertLevel): AlertLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b
}

const PROVINCE_ORDER = Object.keys(PROVINCE_CONFIGS) as ProvinceId[]

interface ProvinceCard {
  id: string
  label: string
  river: string
  alert: AlertLevel
  s2: StationSnap
}

export function FloodAlertBanner() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/water-level/summary')
      if (res.ok) setData((await res.json()) as SummaryData)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchSummary, 0) // defer initial fetch out of the effect body
    const id = setInterval(fetchSummary, POLL_INTERVAL_MS)
    return () => {
      clearTimeout(t)
      clearInterval(id)
    }
  }, [fetchSummary])

  // Build ordered cards from whatever provinces the summary returned
  const cards: ProvinceCard[] = data
    ? PROVINCE_ORDER.flatMap((id) => {
        const p = data[id]
        if (!p) return []
        return [{
          id,
          label: p.label,
          river: p.river,
          alert: moreSevere(p.s1.alert, p.s2.alert),
          s2: p.s2,
        }]
      })
    : []

  // Auto-rotate through provinces
  useEffect(() => {
    if (paused || cards.length <= 1) return
    const id = setInterval(() => setIdx((i) => (i + 1) % cards.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [paused, cards.length])

  if (dismissed || cards.length === 0) return null

  const safeIdx = idx % cards.length
  const card = cards[safeIdx]
  const meta = ALERT_META[card.alert]
  const s2Display = card.s2.level != null ? card.s2.level.toFixed(2) : '—'

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto absolute left-1/2 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-[480px] -translate-x-1/2 overflow-hidden rounded-lg"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${meta.border}`,
        boxShadow: '0 4px 24px oklch(0 0 0 / 0.55)',
      }}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 md:gap-3" style={{ background: meta.bg }}>
        {/* Swapping card body */}
        <div key={safeIdx} className="animate-card-swap flex min-w-0 flex-1 items-center gap-2.5 md:gap-3">
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

          <span className="h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />

          {/* Province */}
          <div className="flex min-w-0 shrink items-baseline gap-1.5">
            <span className="truncate text-[13px] font-semibold leading-none text-[var(--fg)]">
              {card.label}
            </span>
            <span className="hidden shrink-0 text-[10px] text-[var(--fg-subtle)] sm:inline">
              {card.river}
            </span>
          </div>

          <span className="h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />

          {/* Downstream water level */}
          <div className="flex shrink-0 items-baseline gap-1">
            <span
              className="font-mono text-[20px] font-semibold tabular-nums leading-none"
              style={{ color: meta.color }}
            >
              {s2Display}
            </span>
            <span className="font-mono text-[11px] text-[var(--fg-muted)]">ม.</span>
            <span className="text-[10px] text-[var(--fg-subtle)]">{card.s2.code}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Province dots */}
          {cards.length > 1 && (
            <div className="hidden items-center gap-1 sm:flex" role="tablist" aria-label="เลือกจังหวัด">
              {cards.map((c, i) => {
                const active = i === safeIdx
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={c.label}
                    onClick={() => setIdx(i)}
                    className="flex size-3 items-center justify-center"
                  >
                    <span
                      className="rounded-full transition-all"
                      style={{
                        width: active ? 7 : 5,
                        height: active ? 7 : 5,
                        background: ALERT_META[c.alert].color,
                        opacity: active ? 1 : 0.4,
                      }}
                    />
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            aria-label="รีเฟรช"
            className="flex size-6 items-center justify-center rounded transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: 'var(--fg-subtle)' }}
          >
            <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
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
    </div>
  )
}
