'use client'

import { useCallback, useEffect, useState } from 'react'
import { Droplets, RefreshCw, X } from 'lucide-react'
import { ALERT_STYLES, type AlertLevel, type StationThreshold } from '@/lib/water-level'
import { WaterTankCanvas } from './WaterTankCanvas'

type StationSummary = {
  code: string
  level: number | null
  discharge: number | null
  pct: number
  alert: AlertLevel
  thresholds: StationThreshold | null
}

type ProvinceSummary = {
  label: string
  river: string
  updatedAt: string | null
  s1: StationSummary
  s2: StationSummary
}

type SummaryData = Record<string, ProvinceSummary>

const PROVINCE_ORDER = ['chiangmai', 'nan', 'chiangrai']

function StationRow({ station, role }: { station: StationSummary; role: string }) {
  const style = ALERT_STYLES[station.alert]
  const pctDisplay = Math.round(station.pct)

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
      <div className="relative">
        <WaterTankCanvas pct={station.pct} alert={station.alert} width={44} height={64} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[10px] font-bold text-white drop-shadow">
            {pctDisplay}%
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-1">
          <span className="font-mono text-[10.5px] font-bold tracking-wider text-[var(--fg)]">
            {station.code}
          </span>
          <span className={`text-[9px] font-semibold ${style.text} flex items-center gap-0.5`}>
            <span className={`inline-block size-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        </div>

        <div className="mb-1 text-[9px] text-[var(--fg-subtle)]">{role}</div>

        <div className="flex items-baseline gap-0.5">
          <span className="font-mono text-[14px] font-semibold leading-none">
            {station.level != null ? station.level.toFixed(2) : '—'}
          </span>
          <span className="text-[9.5px] text-[var(--fg-muted)]">m</span>
        </div>

        {station.thresholds && (
          <div className="mt-0.5 flex gap-2 text-[8.5px] text-[var(--fg-subtle)]">
            <span>วิกฤต {station.thresholds.critical.toFixed(1)}</span>
            <span className="text-red-500/70">อันตราย {station.thresholds.danger.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function WaterLevelSidebar({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setSpinning(true)
    try {
      const res = await fetch('/api/water-level/summary')
      if (res.ok) {
        const json = await res.json()
        setData(json as SummaryData)
        setLastFetched(new Date())
      }
    } catch {
      // network error — keep stale data
    } finally {
      setLoading(false)
      if (manual) setTimeout(() => setSpinning(false), 600)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(() => fetchData(), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchData])

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Droplets size={13} strokeWidth={1.75} className="text-sky-400" />
          <span className="text-[11.5px] font-semibold tracking-tight">ระดับน้ำสถานี</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fetchData(true)}
            aria-label="รีเฟรชข้อมูล"
            className="flex size-5 items-center justify-center rounded text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
          >
            <RefreshCw size={10} strokeWidth={2.2} className={spinning ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดแผง"
              className="flex size-5 items-center justify-center rounded text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
            >
              <X size={11} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-24 items-center justify-center text-[10.5px] text-[var(--fg-subtle)]">
            กำลังโหลด...
          </div>
        ) : !data ? (
          <div className="flex h-24 items-center justify-center text-[10.5px] text-[var(--fg-subtle)]">
            ไม่มีข้อมูล
          </div>
        ) : (
          <div className="space-y-3 p-2">
            {PROVINCE_ORDER.map((id) => {
              const province = data[id]
              if (!province) return null
              return (
                <div key={id}>
                  <div className="mb-1.5 flex items-baseline gap-1.5 px-0.5">
                    <span className="text-[10.5px] font-semibold text-[var(--fg)]">
                      {province.label}
                    </span>
                    <span className="text-[9px] text-[var(--fg-subtle)]">{province.river}</span>
                  </div>
                  <div className="space-y-1.5">
                    <StationRow station={province.s1} role="ต้นน้ำ" />
                    <StationRow station={province.s2} role="ปลายน้ำ" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer timestamp */}
      {lastFetched && (
        <div className="border-t border-[var(--border)] px-3 py-1.5 text-[9px] text-[var(--fg-subtle)]">
          อัปเดต {lastFetched.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
      )}
    </aside>
  )
}
