'use client'

import { Sliders, CloudRain, Zap, TrendingUp } from 'lucide-react'
import type { StationThreshold, ProvinceConfig } from '@/lib/water-level'
import type { PulseShape, RatingCurve, Scenario } from '@/lib/hydraulics'
import { InfoHint, HintSection } from './InfoHint'

export type SimMode = 'live' | 'scenario' | 'manual'
export type ManualField = 's1Level' | 's1Q' | 's2Level' | 's2Q'
export type ManualValues = Record<ManualField, number>

type PresetDef = { id: string; label: string }

type Props = {
  mode: SimMode
  activePreset: string
  presets: PresetDef[]
  onPreset: (id: string) => void
  onManualMode: () => void
  scenario: Scenario
  onScenarioChange: (s: Scenario) => void
  manual: ManualValues
  onManual: (field: ManualField, value: number) => void
  t1: StationThreshold
  t2: StationThreshold
  config: ProvinceConfig
  rating1: RatingCurve | null
  rating2: RatingCurve | null
}

const SHAPES: { id: PulseShape; label: string; icon: typeof Zap; hint: string }[] = [
  { id: 'spike', label: 'พุ่งสูงฉับพลัน', icon: Zap, hint: 'น้ำป่า — ขึ้นเร็ว ลงเร็ว' },
  { id: 'ramp', label: 'ทยอยขึ้น', icon: TrendingUp, hint: 'ขึ้นช้า คงระดับ แล้วค่อยลด' },
  { id: 'sustained', label: 'ฝนต่อเนื่อง', icon: CloudRain, hint: 'ขึ้นแล้วคงระดับตลอดช่วง' },
]

// ── Slider ต่อสถานี (โหมดปรับเอง) ───────────────────────────────────────────

function StationControls({
  code, label, level, onLevel, levelMax, discharge, onDischarge, t, rating,
}: {
  code: string; label: string
  level: number; onLevel: (v: number) => void; levelMax: number
  discharge: number; onDischarge: (v: number) => void
  t: StationThreshold
  rating: RatingCurve | null
}) {
  const ticks = [
    { v: t.warning,  color: '#facc15', label: 'W' },
    { v: t.prepare,  color: '#fb923c', label: 'P' },
    { v: t.critical, color: '#f87171', label: 'C' },
    { v: t.danger,   color: '#ef4444', label: 'D' },
  ]
  const DISCHARGE_MAX = 500

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[12px] font-semibold">{code}</span>
        <span className="text-[10.5px] text-[var(--fg-muted)]">{label}</span>
        <span className="ml-auto font-mono text-[9px] text-[var(--fg-subtle)]">
          {rating
            ? `Q↔h ผูกด้วย rating curve (R² ${rating.r2.toFixed(2)})`
            : 'ไม่มีข้อมูล Q พอ fit — ปรับอิสระ'}
        </span>
      </div>

      <div className="mb-2">
        <div className="mb-0.5 flex items-baseline justify-between">
          <label className="text-[11px] text-[var(--fg-muted)]">ระดับน้ำ</label>
          <span className="font-mono text-[12.5px] font-semibold tabular-nums">
            {level.toFixed(2)}
            <span className="ml-0.5 text-[10px] text-[var(--fg-muted)]">m</span>
          </span>
        </div>
        <input
          type="range" min={0} max={levelMax} step={0.01} value={level}
          onChange={(e) => onLevel(Number(e.target.value))}
          className="w-full" style={{ accentColor: 'var(--accent)' }}
        />
        <div className="relative mt-0.5 h-3 select-none">
          {ticks.filter((m) => m.v > 0).map((m) => (
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
          onChange={(e) => onDischarge(Number(e.target.value))}
          className="w-full" style={{ accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

// ── แผงจำลองสถานการณ์ ───────────────────────────────────────────────────────

export function ScenarioPanel({
  mode, activePreset, presets, onPreset, onManualMode,
  scenario, onScenarioChange, manual, onManual,
  t1, t2, config, rating1, rating2,
}: Props) {
  const LEVEL_MAX_S1 = t1.danger > 0 ? t1.danger + 0.5 : 6
  const LEVEL_MAX_S2 = t2.danger > 0 ? t2.danger + 0.5 : 6

  const s1ShortName = t1.name.replace(' (ต้นน้ำ)', '').replace(' (upstream)', '')
  const s2ShortName = t2.name.replace(' (ตัวเมือง)', '').replace(' (downstream)', '')

  const statusLabel =
    mode === 'live' ? 'live data' : mode === 'scenario' ? 'simulating · physics routing' : 'manual'

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-medium tracking-tight">
          <Sliders size={13} strokeWidth={1.75} />
          แผงจำลองสถานการณ์
          <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            {statusLabel}
          </span>
          <InfoHint>
            <HintSection title="มีไว้ทำไม">
              ซ้อมสถานการณ์ &ldquo;ถ้าน้ำต้นน้ำมาแบบนี้ ปลายน้ำจะเป็นยังไง เหลือเวลาเท่าไหร่&rdquo;
              โดยไม่ต้องรอเหตุการณ์จริง — ใช้วางแผนเตือนภัย/อพยพล่วงหน้า
            </HintSection>
            <HintSection title="หลักการ">
              ตั้งเหตุการณ์ที่<span className="font-semibold">ต้นน้ำอย่างเดียว</span> ปลายน้ำไม่ได้ตั้งเอง
              — ระบบคำนวณให้จากฟิสิกส์การไหลของน้ำจริง ปุ่ม preset (แล้ง→อันตราย)
              คือเหตุการณ์สำเร็จรูปที่พาน้ำต้นน้ำไปถึงเกณฑ์นั้น ๆ
            </HintSection>
            <HintSection title="วิธีคำนวณ">
              สร้างกราฟน้ำต้นน้ำตามรูปทรง/ขนาด/เวลา → แปลงระดับน้ำเป็นอัตราการไหล Q
              ด้วย rating curve ที่ fit จากข้อมูลจริง 72 ชม. → ส่งต่อให้ Muskingum routing
              พยากรณ์ปลายน้ำ ส่วนโหมด &ldquo;ปรับเอง&rdquo; ลากระดับน้ำแล้ว Q
              จะขยับตาม rating curve ของสถานีนั้นโดยอัตโนมัติ
            </HintSection>
          </InfoHint>
        </h3>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={
                activePreset === p.id && mode !== 'manual'
                  ? 'rounded-md border border-[var(--accent)] bg-[var(--accent)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]'
                  : 'rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]'
              }
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onManualMode}
            className={
              mode === 'manual'
                ? 'rounded-md border border-[var(--accent)] bg-[var(--accent)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]'
                : 'rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]'
            }
          >
            ปรับเอง
          </button>
        </div>
      </div>

      {mode === 'scenario' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2">
          <span className="text-[11px] text-[var(--fg-muted)]">
            เหตุการณ์ต้นน้ำ <span className="font-mono">({config.s1})</span>
          </span>
          <div className="flex flex-wrap gap-1">
            {SHAPES.map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.hint}
                  onClick={() => onScenarioChange({ ...scenario, shape: s.id })}
                  className={
                    scenario.shape === s.id
                      ? 'inline-flex items-center gap-1 rounded-md border border-[var(--accent)] bg-[var(--accent)]/15 px-2 py-1 text-[10.5px] font-medium text-[var(--accent)]'
                      : 'inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10.5px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]'
                  }
                >
                  <Icon size={11} strokeWidth={2} />
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="flex min-w-52 flex-1 items-center gap-2" title="ระดับน้ำต้นน้ำจะเปลี่ยนไปกี่เมตรจากระดับปัจจุบัน (ติดลบ = จำลองน้ำลด)">
            <label className="text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
              น้ำขึ้น
            </label>
            <input
              type="range" min={-1} max={4} step={0.1} value={scenario.riseMeters}
              onChange={(e) => onScenarioChange({ ...scenario, riseMeters: Number(e.target.value) })}
              className="min-w-24 flex-1" style={{ accentColor: 'var(--accent)' }}
              aria-label="ระดับน้ำต้นน้ำเปลี่ยนกี่เมตร"
            />
            <span className="w-14 shrink-0 font-mono text-[12px] font-semibold tabular-nums">
              {scenario.riseMeters > 0 ? '+' : ''}{scenario.riseMeters.toFixed(1)}
              <span className="ml-0.5 text-[10px] font-normal text-[var(--fg-muted)]">m</span>
            </span>
          </div>

          <div className="flex min-w-52 flex-1 items-center gap-2" title="น้ำใช้เวลากี่ชั่วโมงกว่าจะขึ้นถึงจุดสูงสุด — ยิ่งสั้นยิ่งเหมือนน้ำป่าฉับพลัน">
            <label className="text-[11px] text-[var(--fg-muted)] whitespace-nowrap">
              ภายใน
            </label>
            <input
              type="range" min={0.5} max={6} step={0.5} value={scenario.durationHours}
              onChange={(e) => onScenarioChange({ ...scenario, durationHours: Number(e.target.value) })}
              className="min-w-24 flex-1" style={{ accentColor: 'var(--accent)' }}
              aria-label="เวลาที่ใช้ขึ้นถึงจุดสูงสุด"
            />
            <span className="w-14 shrink-0 font-mono text-[12px] font-semibold tabular-nums">
              {scenario.durationHours.toFixed(1)}
              <span className="ml-0.5 text-[10px] font-normal text-[var(--fg-muted)]">ชม.</span>
            </span>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StationControls
            code={config.s1}
            label={`ต้นน้ำ · ${s1ShortName}`}
            level={manual.s1Level}
            onLevel={(v) => onManual('s1Level', v)}
            levelMax={LEVEL_MAX_S1}
            discharge={manual.s1Q}
            onDischarge={(v) => onManual('s1Q', v)}
            t={t1}
            rating={rating1}
          />
          <StationControls
            code={config.s2}
            label={`ปลายน้ำ · ${s2ShortName}`}
            level={manual.s2Level}
            onLevel={(v) => onManual('s2Level', v)}
            levelMax={LEVEL_MAX_S2}
            discharge={manual.s2Q}
            onDischarge={(v) => onManual('s2Q', v)}
            t={t2}
            rating={rating2}
          />
        </div>
      )}
    </div>
  )
}
