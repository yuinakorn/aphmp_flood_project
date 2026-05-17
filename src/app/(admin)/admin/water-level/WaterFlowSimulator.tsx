'use client'

import { useMemo, useState } from 'react'
import { Sliders } from 'lucide-react'
import {
  STATION_THRESHOLDS,
  classifyAlert,
  type StationThreshold,
} from '@/lib/water-level'
import { WaterFlowAnimation } from './WaterFlowAnimation'

type StationInit = {
  level: number | null
  discharge: number | null
  rise3h: number | null
}

type Props = {
  p67: StationInit
  p1: StationInit
}

const LEVEL_MAX_P67 = 3.5
const LEVEL_MAX_P1 = 4.2
const DISCHARGE_MAX = 500

type Preset = {
  id: string
  label: string
  values?: { p67Level: number; p1Level: number; p67Q: number; p1Q: number }
}

const PRESETS: Preset[] = [
  { id: 'live', label: 'Live' },
  {
    id: 'dry',
    label: 'แล้ง',
    values: { p67Level: 0.1, p1Level: 0.4, p67Q: 40, p1Q: 55 },
  },
  {
    id: 'warning',
    label: 'เฝ้าระวัง',
    values: { p67Level: 2.1, p1Level: 2.6, p67Q: 120, p1Q: 140 },
  },
  {
    id: 'prepare',
    label: 'เตรียมพร้อม',
    values: { p67Level: 2.6, p1Level: 3.1, p67Q: 200, p1Q: 230 },
  },
  {
    id: 'critical',
    label: 'วิกฤต',
    values: { p67Level: 2.9, p1Level: 3.5, p67Q: 280, p1Q: 320 },
  },
  {
    id: 'danger',
    label: 'อันตราย',
    values: { p67Level: 3.15, p1Level: 3.85, p67Q: 360, p1Q: 410 },
  },
]

export function WaterFlowSimulator({ p67, p1 }: Props) {
  const [p67Level, setP67Level] = useState(p67.level ?? 0)
  const [p67Q, setP67Q] = useState(p67.discharge ?? 0)
  const [p1Level, setP1Level] = useState(p1.level ?? 0)
  const [p1Q, setP1Q] = useState(p1.discharge ?? 0)
  const [activePreset, setActivePreset] = useState<string>('live')

  const applyPreset = (preset: Preset) => {
    if (preset.id === 'live') {
      setP67Level(p67.level ?? 0)
      setP67Q(p67.discharge ?? 0)
      setP1Level(p1.level ?? 0)
      setP1Q(p1.discharge ?? 0)
    } else if (preset.values) {
      setP67Level(preset.values.p67Level)
      setP67Q(preset.values.p67Q)
      setP1Level(preset.values.p1Level)
      setP1Q(preset.values.p1Q)
    }
    setActivePreset(preset.id)
  }

  const userChange = (setter: (v: number) => void, v: number) => {
    setter(v)
    setActivePreset('custom')
  }

  const { p67Alert, p1Alert } = useMemo(() => {
    // In simulator mode use absolute level only (no rise3h heuristic).
    return {
      p67Alert: classifyAlert(p67Level, 0, STATION_THRESHOLDS['P.67']),
      p1Alert: classifyAlert(p1Level, 0, STATION_THRESHOLDS['P.1']),
    }
  }, [p67Level, p1Level])

  const isLive = activePreset === 'live'

  return (
    <div className="space-y-3">
      <WaterFlowAnimation
        p67={{ level: p67Level, discharge: p67Q, alert: p67Alert }}
        p1={{ level: p1Level, discharge: p1Q, alert: p1Alert }}
      />

      <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="inline-flex items-center gap-1.5 text-[13px] font-medium tracking-tight">
            <Sliders size={13} strokeWidth={1.75} />
            แผงจำลองสถานการณ์
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
              {isLive ? 'live data' : 'simulating'}
            </span>
          </h3>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={
                  activePreset === p.id
                    ? 'rounded-md border border-[var(--accent)] bg-[var(--accent)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]'
                    : 'rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StationControls
            code="P.67"
            label="ต้นน้ำ · บ้านแม่แต"
            level={p67Level}
            setLevel={(v) => userChange(setP67Level, v)}
            levelMax={LEVEL_MAX_P67}
            discharge={p67Q}
            setDischarge={(v) => userChange(setP67Q, v)}
            t={STATION_THRESHOLDS['P.67']}
          />
          <StationControls
            code="P.1"
            label="ปลายน้ำ · สะพานนวรัฐ"
            level={p1Level}
            setLevel={(v) => userChange(setP1Level, v)}
            levelMax={LEVEL_MAX_P1}
            discharge={p1Q}
            setDischarge={(v) => userChange(setP1Q, v)}
            t={STATION_THRESHOLDS['P.1']}
          />
        </div>
      </div>
    </div>
  )
}

function StationControls({
  code,
  label,
  level,
  setLevel,
  levelMax,
  discharge,
  setDischarge,
  t,
}: {
  code: string
  label: string
  level: number
  setLevel: (v: number) => void
  levelMax: number
  discharge: number
  setDischarge: (v: number) => void
  t: StationThreshold
}) {
  const ticks = [
    { v: t.warning, color: '#facc15', label: 'W' },
    { v: t.prepare, color: '#fb923c', label: 'P' },
    { v: t.critical, color: '#f87171', label: 'C' },
    { v: t.danger, color: '#ef4444', label: 'D' },
  ]

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[12px] font-semibold">{code}</span>
        <span className="text-[10.5px] text-[var(--fg-muted)]">{label}</span>
      </div>

      {/* Level */}
      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between">
          <label className="text-[11px] text-[var(--fg-muted)]">ระดับน้ำ</label>
          <span className="font-mono text-[12.5px] font-semibold tabular-nums">
            {level.toFixed(2)}
            <span className="ml-0.5 text-[10px] text-[var(--fg-muted)]">m</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={levelMax}
          step={0.01}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--accent)' }}
        />
        <div className="relative mt-0.5 h-3 select-none">
          {ticks.map((m) => (
            <span
              key={m.label}
              className="absolute top-0 -translate-x-1/2 font-mono text-[9px] font-bold"
              style={{
                left: `${(m.v / levelMax) * 100}%`,
                color: m.color,
              }}
              title={`${m.label} · ${m.v.toFixed(1)} m`}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Discharge */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label className="text-[11px] text-[var(--fg-muted)]">
            ปริมาณการไหล <span className="font-mono">(Q)</span>
          </label>
          <span className="font-mono text-[12.5px] font-semibold tabular-nums">
            {discharge.toFixed(0)}
            <span className="ml-0.5 text-[10px] text-[var(--fg-muted)]">m³/s</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={DISCHARGE_MAX}
          step={1}
          value={discharge}
          onChange={(e) => setDischarge(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
