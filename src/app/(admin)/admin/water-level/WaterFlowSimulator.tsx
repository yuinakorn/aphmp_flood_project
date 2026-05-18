'use client'

import { useMemo, useState } from 'react'
import { Sliders } from 'lucide-react'
import {
  STATION_THRESHOLDS,
  classifyAlert,
  type StationThreshold,
  type ProvinceConfig,
} from '@/lib/water-level'
import { WaterFlowAnimation } from './WaterFlowAnimation'

type StationInit = {
  level: number | null
  discharge: number | null
  rise3h: number | null
}

type Props = {
  s1: StationInit
  s2: StationInit
  config: ProvinceConfig
}

type Preset = {
  id: string
  label: string
  values?: { s1Level: number; s2Level: number; s1Q: number; s2Q: number }
}

function buildPresets(t1: StationThreshold, t2: StationThreshold): Preset[] {
  return [
    { id: 'live', label: 'Live' },
    { id: 'dry', label: 'แล้ง', values: { s1Level: t1.warning * 0.05, s2Level: t2.warning * 0.1, s1Q: 40, s2Q: 55 } },
    { id: 'warning', label: 'เฝ้าระวัง', values: { s1Level: t1.warning + 0.1, s2Level: t2.warning + 0.1, s1Q: 120, s2Q: 140 } },
    { id: 'prepare', label: 'เตรียมพร้อม', values: { s1Level: t1.prepare + 0.1, s2Level: t2.prepare + 0.1, s1Q: 200, s2Q: 230 } },
    { id: 'critical', label: 'วิกฤต', values: { s1Level: t1.critical + 0.1, s2Level: t2.critical + 0.1, s1Q: 280, s2Q: 320 } },
    { id: 'danger', label: 'อันตราย', values: { s1Level: t1.danger + 0.15, s2Level: t2.danger + 0.15, s1Q: 360, s2Q: 410 } },
  ]
}

export function WaterFlowSimulator({ s1, s2, config }: Props) {
  const t1 = STATION_THRESHOLDS[config.s1]
  const t2 = STATION_THRESHOLDS[config.s2]

  const PRESETS = buildPresets(t1, t2)
  const LEVEL_MAX_S1 = t1.danger + 0.5
  const LEVEL_MAX_S2 = t2.danger + 0.5
  const DISCHARGE_MAX = 500

  const [s1Level, setS1Level] = useState(s1.level ?? 0)
  const [s1Q, setS1Q] = useState(s1.discharge ?? 0)
  const [s2Level, setS2Level] = useState(s2.level ?? 0)
  const [s2Q, setS2Q] = useState(s2.discharge ?? 0)
  const [activePreset, setActivePreset] = useState<string>('live')

  const applyPreset = (preset: Preset) => {
    if (preset.id === 'live') {
      setS1Level(s1.level ?? 0)
      setS1Q(s1.discharge ?? 0)
      setS2Level(s2.level ?? 0)
      setS2Q(s2.discharge ?? 0)
    } else if (preset.values) {
      setS1Level(preset.values.s1Level)
      setS1Q(preset.values.s1Q)
      setS2Level(preset.values.s2Level)
      setS2Q(preset.values.s2Q)
    }
    setActivePreset(preset.id)
  }

  const userChange = (setter: (v: number) => void, v: number) => {
    setter(v)
    setActivePreset('custom')
  }

  const { s1Alert, s2Alert } = useMemo(() => ({
    s1Alert: classifyAlert(s1Level, 0, t1),
    s2Alert: classifyAlert(s2Level, 0, t2),
  }), [s1Level, s2Level, t1, t2])

  const isLive = activePreset === 'live'

  return (
    <div className="space-y-3">
      <WaterFlowAnimation
        s1={{ level: s1Level, discharge: s1Q, alert: s1Alert }}
        s2={{ level: s2Level, discharge: s2Q, alert: s2Alert }}
        t1={t1}
        t2={t2}
        config={config}
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
            code={config.s1}
            label={`ต้นน้ำ · ${t1.name.replace(' (ต้นน้ำ)', '')}`}
            level={s1Level}
            setLevel={(v) => userChange(setS1Level, v)}
            levelMax={LEVEL_MAX_S1}
            discharge={s1Q}
            setDischarge={(v) => userChange(setS1Q, v)}
            dischargeMax={DISCHARGE_MAX}
            t={t1}
          />
          <StationControls
            code={config.s2}
            label={`ปลายน้ำ · ${t2.name.replace(' (ตัวเมือง)', '')}`}
            level={s2Level}
            setLevel={(v) => userChange(setS2Level, v)}
            levelMax={LEVEL_MAX_S2}
            discharge={s2Q}
            setDischarge={(v) => userChange(setS2Q, v)}
            dischargeMax={DISCHARGE_MAX}
            t={t2}
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
  dischargeMax,
  t,
}: {
  code: string
  label: string
  level: number
  setLevel: (v: number) => void
  levelMax: number
  discharge: number
  setDischarge: (v: number) => void
  dischargeMax: number
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
              style={{ left: `${(m.v / levelMax) * 100}%`, color: m.color }}
              title={`${m.label} · ${m.v.toFixed(1)} m`}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

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
          max={dischargeMax}
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
