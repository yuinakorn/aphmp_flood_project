'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ALERT_STYLES,
  classifyAlert,
  classifyAlertMaesai,
  type AlertLevel,
  type StationThreshold,
  type ProvinceConfig,
} from '@/lib/water-level'
import {
  computeForecast,
  sampleForecast,
  flowVelocity,
  ratingQ,
  ratingH,
  ratingOutOfRange,
  type PulseShape,
  type Scenario,
} from '@/lib/hydraulics'
import type { WaterLevelPoint } from '@/app/api/water-level/route'
import { FlowSimulation } from './FlowSimulation'
import { SimTimeline } from './SimTimeline'
import { ForecastStrip } from './ForecastStrip'
import {
  ScenarioPanel,
  type ManualField,
  type ManualValues,
  type SimMode,
} from './ScenarioPanel'

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
  series: WaterLevelPoint[]
}

const HORIZON_HOURS = 12
const DT_HOURS = 0.25
const SIM_HOURS_PER_SEC = 0.8 // 1 ชม.จำลอง ≈ 1.25 วินาทีจริง

// preset = เหตุการณ์ต้นน้ำที่พาระดับไปถึงเกณฑ์นั้น ๆ (ไม่ teleport ค่าเหมือนเดิม —
// ระบบจะ route ไปปลายน้ำด้วยฟิสิกส์เอง)
type ScenarioPreset = {
  id: string
  label: string
  target: (t: StationThreshold) => number
  guard: (t: StationThreshold) => boolean
  shape: PulseShape
  durationHours: number
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: 'dry',      label: 'แล้ง',       target: (t) => t.warning * 0.05,  guard: (t) => t.warning > 0,  shape: 'ramp',  durationHours: 4 },
  { id: 'warning',  label: 'เฝ้าระวัง',   target: (t) => t.warning + 0.1,   guard: (t) => t.warning > 0,  shape: 'ramp',  durationHours: 3 },
  { id: 'prepare',  label: 'เตรียมพร้อม', target: (t) => t.prepare + 0.1,   guard: (t) => t.prepare > 0,  shape: 'ramp',  durationHours: 3 },
  { id: 'critical', label: 'วิกฤต',       target: (t) => t.critical + 0.1,  guard: (t) => t.critical > 0, shape: 'ramp',  durationHours: 3 },
  { id: 'danger',   label: 'อันตราย',     target: (t) => t.danger + 0.15,   guard: (t) => t.danger > 0,   shape: 'spike', durationHours: 2 },
]

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

      <TooltipProvider delay={150}>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2.5">
          <div className="flex flex-col">
            <dt className="text-[var(--fg-subtle)] text-[11px] flex items-center gap-1">
              <span>เทียบ 3 ชม.ก่อน</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button type="button" className="inline-flex cursor-help text-[var(--fg-subtle)] hover:text-[var(--fg)] focus:outline-none" aria-label="ข้อมูลเพิ่มเติม">
                      <Info size={11} strokeWidth={2.2} />
                    </button>
                  }
                />
                <TooltipContent className="max-w-[200px] text-xs leading-normal p-2.5" side="top">
                  ระดับน้ำที่เปลี่ยนแปลง (เพิ่มขึ้น/ลดลง) เมื่อเทียบกับ 3 ชั่วโมงก่อนหน้า
                </TooltipContent>
              </Tooltip>
            </dt>
            <dd className={`mt-0.5 font-mono text-xs font-bold ${rise3h !== null && rise3h > 0 ? "text-[var(--risk-near)]" : rise3h !== null && rise3h < 0 ? "text-[var(--risk-safe)]" : "text-[var(--fg)]"}`}>
              {rise3h == null ? '—' : `${rise3h > 0 ? '+' : ''}${rise3h.toFixed(2)}`} m
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[var(--fg-subtle)] text-[11px] flex items-center gap-1">
              <span>Discharge (m³/s)</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button type="button" className="inline-flex cursor-help text-[var(--fg-subtle)] hover:text-[var(--fg)] focus:outline-none" aria-label="ข้อมูลเพิ่มเติม">
                      <Info size={11} strokeWidth={2.2} />
                    </button>
                  }
                />
                <TooltipContent className="max-w-[200px] text-xs leading-normal p-2.5" side="top">
                  อัตราการไหลของน้ำผ่านจุดวัดน้ำ มีหน่วยเป็นลูกบาศก์เมตรต่อวินาที (m³/s)
                </TooltipContent>
              </Tooltip>
            </dt>
            <dd className="mt-0.5 font-mono text-xs font-bold text-[var(--fg)]">
              {discharge == null ? '—' : discharge.toFixed(1)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[var(--fg-subtle)] text-[11px] flex items-center gap-1">
              <span>วิกฤต</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button type="button" className="inline-flex cursor-help text-[var(--fg-subtle)] hover:text-[var(--fg)] focus:outline-none" aria-label="ข้อมูลเพิ่มเติม">
                      <Info size={11} strokeWidth={2.2} />
                    </button>
                  }
                />
                <TooltipContent className="max-w-[200px] text-xs leading-normal p-2.5" side="top">
                  ระดับน้ำที่เป็นจุดเฝ้าระวังสูงสุด หากสูงกว่านี้เสี่ยงน้ำล้นตลิ่งเข้าท่วมพื้นที่
                </TooltipContent>
              </Tooltip>
            </dt>
            <dd className="mt-0.5 font-mono text-xs font-bold text-[var(--fg)]">
              {t.critical > 0 ? `${t.critical.toFixed(1)} m` : 'ยังไม่กำหนด'}
            </dd>
          </div>
        </dl>
      </TooltipProvider>
    </div>
  )
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export function WaterDashboard({ liveS1, liveS2, config, t1, t2, series }: Props) {
  const [mode, setMode] = useState<SimMode>('live')
  const [activePreset, setActivePreset] = useState('live')
  const [scenario, setScenario] = useState<Scenario>({
    shape: 'ramp', riseMeters: 1.0, durationHours: 3, startHour: 0,
  })
  const [manual, setManual] = useState<ManualValues>({
    s1Level: liveS1.level ?? 0,
    s1Q: liveS1.discharge ?? 0,
    s2Level: liveS2.level ?? 0,
    s2Q: liveS2.discharge ?? 0,
  })
  const [simTime, setSimTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const reducedMotion = useRef(false)

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // ── Physics: rating curves + lag + routing (คำนวณใหม่เฉพาะตอน input เปลี่ยน) ──
  const history = useMemo(
    () => series.map((r) => ({ h1: r.s1, q1: r.s1Discharge, h2: r.s2, q2: r.s2Discharge })),
    [series],
  )

  const forecast = useMemo(
    () =>
      computeForecast({
        history,
        scenario: mode === 'scenario' ? scenario : null,
        manual: mode === 'manual' ? { s1Level: manual.s1Level } : null,
        geometry: config.channel,
        thresholds2: t2,
        fallbackTravelHours: config.fallbackTravelHours,
        horizonHours: HORIZON_HOURS,
        dtHours: DT_HOURS,
      }),
    [history, mode, scenario, manual.s1Level, config, t2],
  )

  // ── Animation loop (rAF, pause เมื่อ tab hidden) ──
  useEffect(() => {
    if (!playing || mode !== 'scenario') return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setSimTime((t) => {
        const nt = t + dt * SIM_HOURS_PER_SEC
        if (nt >= HORIZON_HOURS) {
          setPlaying(false)
          return HORIZON_HOURS
        }
        return nt
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onVis = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [playing, mode])

  // ── ค่าต่อเฟรม: lookup จาก forecast ณ simTime (ถูก — ไม่คำนวณฟิสิกส์ซ้ำ) ──
  const histH1 = useMemo(() => series.map((r) => r.s1), [series])
  const histH2 = useMemo(() => series.map((r) => r.s2), [series])

  const frame = useMemo(() => {
    const sampleHistory = (arr: (number | null)[], hoursBack: number): number | null => {
      const idx = arr.length - 1 - hoursBack
      const lo = Math.floor(idx)
      const hi = Math.ceil(idx)
      if (lo < 0 || hi >= arr.length) return null
      const a = arr[lo]
      const b = arr[hi]
      if (a == null || b == null) return null
      return a + (b - a) * (idx - lo)
    }
    // ระดับน้ำจำลอง ณ เวลา t (t<0 = ย้อนเข้า observed history)
    const simLevel = (which: 1 | 2, t: number): number | null => {
      if (t >= 0) {
        return sampleForecast(which === 1 ? forecast.s1Level : forecast.s2Level, DT_HOURS, t)
      }
      return sampleHistory(which === 1 ? histH1 : histH2, -t)
    }

    if (mode === 'live') {
      return {
        s1: { level: liveS1.level, discharge: liveS1.discharge, rise1h: liveS1.rise1h, rise3h: liveS1.rise3h },
        s2: { level: liveS2.level, discharge: liveS2.discharge, rise1h: liveS2.rise1h, rise3h: liveS2.rise3h },
      }
    }
    if (mode === 'manual') {
      return {
        s1: { level: manual.s1Level, discharge: manual.s1Q, rise1h: null, rise3h: null },
        s2: { level: manual.s2Level, discharge: manual.s2Q, rise1h: null, rise3h: null },
      }
    }
    // scenario: rise สังเคราะห์จาก simulated series → classifier จริง
    // (สำคัญกับแม่สายที่ใช้ rise-speed เป็นตัวชี้วัดหลัก)
    const rise = (which: 1 | 2, back: number) => {
      const cur = simLevel(which, simTime)
      const prev = simLevel(which, simTime - back)
      return cur != null && prev != null ? cur - prev : null
    }
    return {
      s1: {
        level: simLevel(1, simTime),
        discharge: sampleForecast(forecast.s1Q, DT_HOURS, simTime),
        rise1h: rise(1, 1),
        rise3h: rise(1, 3),
      },
      s2: {
        level: simLevel(2, simTime),
        discharge: sampleForecast(forecast.s2Q, DT_HOURS, simTime),
        rise1h: rise(2, 1),
        rise3h: rise(2, 3),
      },
    }
  }, [mode, simTime, forecast, manual, liveS1, liveS2, histH1, histH2])

  // ── Alert classification ──
  const classify: ClassifyFn = config.alertMode === 'rise_speed'
    ? classifyAlertMaesai
    : (level, _rise1h, rise3h, t) => classifyAlert(level, rise3h, t)

  const s1Alert = classify(frame.s1.level, frame.s1.rise1h, frame.s1.rise3h, t1)
  const s2Alert = classify(frame.s2.level, frame.s2.rise1h, frame.s2.rise3h, t2)

  // ── ความเร็วน้ำ ณ เฟรมปัจจุบัน (Manning จาก Q จริง/จำลอง) ──
  const frameVelocity = useMemo(() => {
    const q = frame.s1.discharge
    if (q != null && q > 1) return flowVelocity(q, config.channel)
    return forecast.velocityMs
  }, [frame.s1.discharge, config, forecast.velocityMs])

  // ── ก้อนคลื่นเดินทาง (เฉพาะ scenario ขาขึ้น) ──
  const packet = useMemo(() => {
    if (mode !== 'scenario' || scenario.riseMeters <= 0) return null
    const prog = (simTime - scenario.startHour) / forecast.travelHours
    if (prog <= 0 || prog > 1.08) return null
    return { progress: Math.min(1, prog), amplitudeM: scenario.riseMeters }
  }, [mode, scenario, simTime, forecast.travelHours])

  // ── ForecastStrip data ──
  const observedS2 = useMemo(() => {
    const len = series.length
    const start = Math.max(0, len - 13)
    const out: { t: number; v: number | null }[] = []
    for (let i = start; i < len; i++) out.push({ t: i - (len - 1), v: series[i].s2 })
    return out
  }, [series])

  const predictedS2 = useMemo(
    () => forecast.times.map((t, i) => ({ t, v: forecast.s2Level[i] })),
    [forecast],
  )

  const outOfRange = !!(
    forecast.rating2 &&
    forecast.peak &&
    ratingOutOfRange(forecast.rating2, forecast.peak.level)
  )

  const forecastModeLabel =
    mode === 'live'
      ? '(สมมติต้นน้ำคงระดับปัจจุบัน)'
      : mode === 'scenario'
        ? '(จากเหตุการณ์จำลอง)'
        : '(จากระดับต้นน้ำที่ตั้ง)'

  // ── Preset / mode handlers ──
  const presets = useMemo(
    () => [
      { id: 'live', label: 'Live' },
      ...SCENARIO_PRESETS.filter((p) => p.guard(t1)).map(({ id, label }) => ({ id, label })),
    ],
    [t1],
  )

  function applyPreset(id: string) {
    if (id === 'live') {
      setMode('live')
      setActivePreset('live')
      setPlaying(false)
      setSimTime(0)
      return
    }
    const p = SCENARIO_PRESETS.find((x) => x.id === id)
    if (!p) return
    const baseline = forecast.baseline1 ?? liveS1.level ?? 0
    setScenario({
      shape: p.shape,
      riseMeters: Math.round((p.target(t1) - baseline) * 10) / 10,
      durationHours: p.durationHours,
      startHour: 0,
    })
    setMode('scenario')
    setActivePreset(id)
    setSimTime(0)
    setPlaying(!reducedMotion.current)
  }

  function changeScenario(s: Scenario) {
    setScenario(s)
    setActivePreset('custom')
    if (mode !== 'scenario') setMode('scenario')
  }

  function enterManualMode() {
    setMode('manual')
    setActivePreset('custom')
    setPlaying(false)
    setSimTime(0)
  }

  // slider ผูก Q↔h ด้วย rating curve ของสถานีนั้นเมื่อ fit ได้
  function changeManual(field: ManualField, value: number) {
    setManual((m) => {
      const next = { ...m, [field]: value }
      const r1 = forecast.rating1
      const r2 = forecast.rating2
      if (field === 's1Level' && r1) next.s1Q = Math.min(500, Math.round(ratingQ(r1, value) * 10) / 10)
      if (field === 's1Q' && r1) next.s1Level = Math.round(ratingH(r1, value) * 100) / 100
      if (field === 's2Level' && r2) next.s2Q = Math.min(500, Math.round(ratingQ(r2, value) * 10) / 10)
      if (field === 's2Q' && r2) next.s2Level = Math.round(ratingH(r2, value) * 100) / 100
      return next
    })
  }

  const showTimeline = mode === 'scenario' && forecast.tier !== 'none'

  return (
    <div className="space-y-3">
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
          level={frame.s1.level}
          rise1h={frame.s1.rise1h}
          rise3h={frame.s1.rise3h}
          discharge={frame.s1.discharge}
          t={t1}
          simulating={mode !== 'live'}
          classify={classify}
        />
        <StationCard
          code={config.s2}
          level={frame.s2.level}
          rise1h={frame.s2.rise1h}
          rise3h={frame.s2.rise3h}
          discharge={frame.s2.discharge}
          t={t2}
          simulating={mode !== 'live'}
          classify={classify}
        />
      </div>

      {/* ── Flow simulation (physics-driven) ── */}
      <FlowSimulation
        s1={{ level: frame.s1.level, discharge: frame.s1.discharge, alert: s1Alert }}
        s2={{ level: frame.s2.level, discharge: frame.s2.discharge, alert: s2Alert }}
        t1={t1}
        t2={t2}
        config={config}
        velocityMs={frameVelocity}
        travelHours={forecast.travelHours}
        travelSource={forecast.travelSource}
        packet={packet}
      />

      {/* ── Timeline (เฉพาะโหมดจำลองเหตุการณ์) ── */}
      {showTimeline && (
        <SimTimeline
          simTime={simTime}
          horizonHours={HORIZON_HOURS}
          playing={playing}
          onScrub={(t) => {
            setSimTime(t)
            setPlaying(false)
          }}
          onTogglePlay={() => setPlaying((p) => !p)}
          onReset={() => {
            setSimTime(0)
            setPlaying(false)
          }}
          etas={forecast.thresholdEtas}
          stationCode={config.s2}
        />
      )}

      {/* ── แผงจำลองสถานการณ์ (ติดกับกราฟิก — ปรับแล้วเห็นผลไม่ต้องเลื่อนจอ) ── */}
      <ScenarioPanel
        mode={mode}
        activePreset={activePreset}
        presets={presets}
        onPreset={applyPreset}
        onManualMode={enterManualMode}
        scenario={scenario}
        onScenarioChange={changeScenario}
        manual={manual}
        onManual={changeManual}
        t1={t1}
        t2={t2}
        config={config}
        rating1={forecast.rating1}
        rating2={forecast.rating2}
      />

      {/* ── พยากรณ์ปลายน้ำจาก routing ── */}
      <ForecastStrip
        observed={observedS2}
        predicted={predictedS2}
        tier={forecast.tier}
        t2={t2}
        stationCode={config.s2}
        simTime={mode === 'scenario' ? simTime : null}
        outOfRange={outOfRange}
        modeLabel={forecastModeLabel}
        rating2={forecast.rating2}
        lag={forecast.lag}
        travelHours={forecast.travelHours}
        travelSource={forecast.travelSource}
      />
    </div>
  )
}
