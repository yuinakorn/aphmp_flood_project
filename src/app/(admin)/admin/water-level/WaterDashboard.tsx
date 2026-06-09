'use client'

import { useMemo, useState } from 'react'
import { Droplets, TrendingUp, TrendingDown, Minus, Sliders } from 'lucide-react'
import {
  ALERT_STYLES,
  classifyAlert,
  classifyAlertMaesai,
  type AlertLevel,
  type StationThreshold,
  type ProvinceConfig,
} from '@/lib/water-level'
import { WaterFlowAnimation } from './WaterFlowAnimation'

// ── Types ───────────────────────────────────────────────────────────────────

type LiveStation = {
  level: number | null
  discharge: number | null
  rise1h: number | null
  rise3h: number | null
}

type Props = {
  liveS1: LiveStation
  liveS2: LiveStation
  config: ProvinceConfig
  t1: StationThreshold
  t2: StationThreshold
}

type Preset = {
  id: string
  label: string
  values?: { s1Level: number; s2Level: number; s1Q: number; s2Q: number }
}

function buildPresets(t1: StationThreshold, t2: StationThreshold): Preset[] {
  return [
    { id: 'live', label: 'Live' },
    { id: 'dry',     label: 'แล้ง',        values: { s1Level: t1.warning * 0.05, s2Level: t2.warning * 0.1, s1Q: 40,  s2Q: 55  } },
    { id: 'warning', label: 'เฝ้าระวัง',    values: { s1Level: t1.warning + 0.1,  s2Level: t2.warning + 0.1,  s1Q: 120, s2Q: 140 } },
    { id: 'prepare', label: 'เตรียมพร้อม',  values: { s1Level: t1.prepare + 0.1,  s2Level: t2.prepare + 0.1,  s1Q: 200, s2Q: 230 } },
    { id: 'critical',label: 'วิกฤต',        values: { s1Level: t1.critical + 0.1, s2Level: t2.critical + 0.1, s1Q: 280, s2Q: 320 } },
    { id: 'danger',  label: 'อันตราย',      values: { s1Level: t1.danger + 0.15,  s2Level: t2.danger + 0.15,  s1Q: 360, s2Q: 410 } },
  ]
}

type ClassifyFn = (level: number | null, rise1h: number | null, rise3h: number | null, t: StationThreshold) => AlertLevel

// ── StationCard ──────────────────────────────────────────────────────────────

function StationCard({
  code, level, rise1h, rise3h, discharge, t, simulating, classify,
}: {
  code: string
  level: number | null
  rise1h: number | null
  rise3h: number | null
  discharge: number | null
  t: StationThreshold
  simulating: boolean
  classify: ClassifyFn
}) {
  const alert: AlertLevel = classify(level, rise1h, rise3h, t)
  const style = ALERT_STYLES[alert]
  const TrendIcon =
    rise1h == null || rise1h === 0 ? Minus : rise1h > 0 ? TrendingUp : TrendingDown

  return (
    <div className={`rounded-lg border px-4 py-3 ${style.bg} transition-colors`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight truncate flex items-center">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--fg-subtle)] mr-1.5">
              {code}
            </span>
            {t.name}
            {simulating && (
              <span className="ml-1.5 font-sans normal-case text-[10px] text-[var(--fg-subtle)] opacity-70">
                (sim)
              </span>
            )}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-semibold ${style.text}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[28px] font-bold leading-none tracking-tight">
          {level == null ? '—' : level.toFixed(2)}
        </span>
        <span className="text-[11px] text-[var(--fg-muted)]">m</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--border)]/70 bg-[var(--bg-sunken)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)] shadow-2xs">
          <span className="text-[10px] text-[var(--fg-subtle)] font-medium">เทียบ 1 ชม.ก่อน</span>
          <TrendIcon size={11} strokeWidth={2.25} className={rise1h !== null && rise1h > 0 ? "text-[var(--risk-near)]" : rise1h !== null && rise1h < 0 ? "text-[var(--risk-safe)]" : "text-[var(--fg-subtle)]"} />
          <span className={`font-mono font-semibold ${rise1h !== null && rise1h > 0 ? "text-[var(--risk-near)]" : rise1h !== null && rise1h < 0 ? "text-[var(--risk-safe)]" : "text-[var(--fg)]"}`}>
            {rise1h == null ? '—' : `${rise1h > 0 ? '+' : ''}${rise1h.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-[var(--fg-subtle)]">m</span>
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2.5">
        <div className="flex flex-col">
          <dt className="text-[var(--fg-subtle)] text-[11px]">เทียบ 3 ชม.ก่อน</dt>
          <dd className={`mt-0.5 font-mono text-xs font-bold ${rise3h !== null && rise3h > 0 ? "text-[var(--risk-near)]" : rise3h !== null && rise3h < 0 ? "text-[var(--risk-safe)]" : "text-[var(--fg)]"}`}>
            {rise3h == null ? '—' : `${rise3h > 0 ? '+' : ''}${rise3h.toFixed(2)}`} m
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[var(--fg-subtle)] text-[11px]">Discharge</dt>
          <dd className="mt-0.5 font-mono text-xs font-bold text-[var(--fg)]">
            {discharge == null ? '—' : discharge.toFixed(1)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[var(--fg-subtle)] text-[11px]">วิกฤต</dt>
          <dd className="mt-0.5 font-mono text-xs font-bold text-[var(--fg)]">
            {t.critical > 0 ? `${t.critical.toFixed(1)} m` : 'ยังไม่กำหนด'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

// ── Slider controls ──────────────────────────────────────────────────────────

function StationControls({
  code, label, level, setLevel, levelMax, discharge, setDischarge, t,
}: {
  code: string; label: string
  level: number; setLevel: (v: number) => void; levelMax: number
  discharge: number; setDischarge: (v: number) => void
  t: StationThreshold
}) {
  const ticks = [
    { v: t.warning,  color: '#facc15', label: 'W' },
    { v: t.prepare,  color: '#fb923c', label: 'P' },
    { v: t.critical, color: '#f87171', label: 'C' },
    { v: t.danger,   color: '#ef4444', label: 'D' },
  ]
  const DISCHARGE_MAX = 500

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
          type="range" min={0} max={levelMax} step={0.01} value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="w-full" style={{ accentColor: 'var(--accent)' }}
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
          type="range" min={0} max={DISCHARGE_MAX} step={1} value={discharge}
          onChange={(e) => setDischarge(Number(e.target.value))}
          className="w-full" style={{ accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export function WaterDashboard({ liveS1, liveS2, config, t1, t2 }: Props) {
  const PRESETS = useMemo(() => buildPresets(t1, t2), [t1, t2])
  const LEVEL_MAX_S1 = t1.danger + 0.5
  const LEVEL_MAX_S2 = t2.danger + 0.5

  const [s1Level, setS1Level] = useState(liveS1.level ?? 0)
  const [s1Q,     setS1Q]     = useState(liveS1.discharge ?? 0)
  const [s2Level, setS2Level] = useState(liveS2.level ?? 0)
  const [s2Q,     setS2Q]     = useState(liveS2.discharge ?? 0)
  const [activePreset, setActivePreset] = useState<string>('live')

  const isLive = activePreset === 'live'

  // Pick classifier: rise-speed-first for flash-flood rivers (Mae Sai)
  const classify: ClassifyFn = config.alertMode === 'rise_speed'
    ? classifyAlertMaesai
    : (level, _rise1h, rise3h, t) => classifyAlert(level, rise3h, t)

  // Cards show live data in live mode, simulator values otherwise
  const cardS1 = isLive
    ? liveS1
    : { level: s1Level, discharge: s1Q, rise1h: null, rise3h: null }
  const cardS2 = isLive
    ? liveS2
    : { level: s2Level, discharge: s2Q, rise1h: null, rise3h: null }

  const { s1Alert, s2Alert } = useMemo(() => ({
    s1Alert: classify(s1Level, null, 0, t1),
    s2Alert: classify(s2Level, null, 0, t2),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [s1Level, s2Level, t1, t2, config.alertMode])

  function applyPreset(preset: Preset) {
    if (preset.id === 'live') {
      setS1Level(liveS1.level ?? 0)
      setS1Q(liveS1.discharge ?? 0)
      setS2Level(liveS2.level ?? 0)
      setS2Q(liveS2.discharge ?? 0)
    } else if (preset.values) {
      setS1Level(preset.values.s1Level)
      setS1Q(preset.values.s1Q)
      setS2Level(preset.values.s2Level)
      setS2Q(preset.values.s2Q)
    }
    setActivePreset(preset.id)
  }

  function userChange(setter: (v: number) => void, v: number) {
    setter(v)
    setActivePreset('custom')
  }

  const s1ShortName = t1.name.replace(' (ต้นน้ำ)', '').replace(' (upstream)', '')
  const s2ShortName = t2.name.replace(' (ตัวเมือง)', '').replace(' (downstream)', '')

  return (
    <div className="space-y-4">
      {/* ── Rise-speed methodology note (Mae Sai only) ── */}
      {config.alertMode === 'rise_speed' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 px-3.5 py-2.5 text-xs text-fuchsia-800 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
          <span className="mt-px shrink-0 font-bold text-fuchsia-600 dark:text-fuchsia-400">⚡</span>
          <span>
            <span className="font-semibold text-fuchsia-900 dark:text-fuchsia-200">ระบบใช้อัตราการขึ้นของน้ำ (rise speed) เป็นตัวชี้วัดหลัก</span>
            {' '}— แม่น้ำสายเป็นแม่น้ำสายสั้นจากภูเขา เสี่ยงน้ำป่าไหลหลากฉับพลัน
            สัญญาณเตือนจะเปิดใช้เมื่ออัตราขึ้น ≥ 0.10 m/h (เฝ้าระวัง) / 0.25 m/h (เตรียมพร้อม) /
            0.50 m/h (วิกฤต) / 1.00 m/h (อันตราย) แม้ระดับน้ำยังไม่ถึง threshold สัมบูรณ์
          </span>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <StationCard
          code={config.s1}
          level={cardS1.level}
          rise1h={cardS1.rise1h}
          rise3h={cardS1.rise3h}
          discharge={cardS1.discharge}
          t={t1}
          simulating={!isLive}
          classify={classify}
        />
        <StationCard
          code={config.s2}
          level={cardS2.level}
          rise1h={cardS2.rise1h}
          rise3h={cardS2.rise3h}
          discharge={cardS2.discharge}
          t={t2}
          simulating={!isLive}
          classify={classify}
        />
      </div>

      {/* ── Flow animation ── */}
      <WaterFlowAnimation
        s1={{ level: s1Level, discharge: s1Q, alert: s1Alert }}
        s2={{ level: s2Level, discharge: s2Q, alert: s2Alert }}
        t1={t1}
        t2={t2}
        config={config}
      />

      {/* ── Simulator controls ── */}
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
            label={`ต้นน้ำ · ${s1ShortName}`}
            level={s1Level}
            setLevel={(v) => userChange(setS1Level, v)}
            levelMax={LEVEL_MAX_S1}
            discharge={s1Q}
            setDischarge={(v) => userChange(setS1Q, v)}
            t={t1}
          />
          <StationControls
            code={config.s2}
            label={`ปลายน้ำ · ${s2ShortName}`}
            level={s2Level}
            setLevel={(v) => userChange(setS2Level, v)}
            levelMax={LEVEL_MAX_S2}
            discharge={s2Q}
            setDischarge={(v) => userChange(setS2Q, v)}
            t={t2}
          />
        </div>
      </div>
    </div>
  )
}
