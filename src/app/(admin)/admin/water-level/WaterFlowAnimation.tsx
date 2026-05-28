'use client'

import { type AlertLevel, type StationThreshold, type ProvinceConfig } from '@/lib/water-level'

type StationInfo = {
  level: number | null
  discharge: number | null
  alert: AlertLevel
}

type Props = {
  s1: StationInfo
  s2: StationInfo
  t1: StationThreshold
  t2: StationThreshold
  config: ProvinceConfig
}

const SEVERITY: Record<AlertLevel, number> = {
  normal: 0,
  warning: 1,
  rapid_rise: 2,
  prepare: 3,
  critical: 4,
  danger: 5,
}

const PALETTE: Record<
  AlertLevel,
  { water: string; surface: string; glow: string; label: string }
> = {
  normal:     { water: '#0284c7', surface: '#7dd3fc', glow: '#38bdf8', label: 'ปกติ' },
  warning:    { water: '#a16207', surface: '#fde047', glow: '#facc15', label: 'เฝ้าระวัง' },
  rapid_rise: { water: '#a21caf', surface: '#f0abfc', glow: '#e879f9', label: 'น้ำขึ้นเร็ว' },
  prepare:    { water: '#c2410c', surface: '#fdba74', glow: '#fb923c', label: 'เตรียมพร้อม' },
  critical:   { water: '#b91c1c', surface: '#fca5a5', glow: '#f87171', label: 'วิกฤต' },
  danger:     { water: '#7f1d1d', surface: '#fecaca', glow: '#ef4444', label: 'อันตรายสูง' },
}

// ── Geometry ────────────────────────────────────────────────────────────────
// Water surface = flat 0° horizontal line.
// Bed slopes downward to the right (downstream is the deeper / lower side).
// Station markers float at the surface like buoys; ground below the bed uses
// a soft gradient (no harsh lines or pillars).

const W = 940
const H = 260
const PAD_X = 84

const SURFACE_Y = 140
const BED_LEFT_BASE = 160
const BED_RIGHT_BASE = 215
const DEPTH_RANGE = 22       // bed sinks further as gauge rises
const GROUND_BOTTOM_Y = H - 30
const THRESHOLD_SCALE = 22   // px per meter for the danger-headroom indicators
const THRESHOLD_WIDTH = 130  // length of each threshold dashed line (inward)

function depthFraction(level: number | null, danger: number) {
  if (level == null) return 0
  if (level <= 0) return 0
  // ยังไม่กำหนดเกณฑ์ (danger <= 0) — แสดงเป็นระดับต่ำ ไม่ใช่เต็มจอ (level/0 = Infinity)
  if (danger <= 0) return 0.12
  return Math.max(0, Math.min(1, level / danger))
}

function buildWavePath(width: number, amp: number, period: number) {
  const cycles = Math.ceil(width / period) + 2
  let d = `M 0 0`
  for (let i = 0; i < cycles; i++) {
    d += ` q ${period / 4} ${-amp}, ${period / 2} 0 t ${period / 2} 0`
  }
  return d
}

export function WaterFlowAnimation({ s1, s2, t1, t2, config }: Props) {
  const dominant: AlertLevel =
    SEVERITY[s1.alert] >= SEVERITY[s2.alert] ? s1.alert : s2.alert
  const palette = PALETTE[dominant]

  const f1 = depthFraction(s1.level, t1.danger)
  const f2 = depthFraction(s2.level, t2.danger)

  const bedLeftY = BED_LEFT_BASE + f1 * DEPTH_RANGE
  const bedRightY = BED_RIGHT_BASE + f2 * DEPTH_RANGE

  const channelLeft = PAD_X
  const channelRight = W - PAD_X
  const channelW = channelRight - channelLeft

  const avgQ = ((s1.discharge ?? 0) + (s2.discharge ?? 0)) / 2
  const flowDur = Math.max(2.5, Math.min(8, 10 - avgQ / 8))

  const waterPath = `M ${channelLeft} ${SURFACE_Y} L ${channelRight} ${SURFACE_Y} L ${channelRight} ${bedRightY} L ${channelLeft} ${bedLeftY} Z`
  const groundPath = `M ${channelLeft} ${bedLeftY} L ${channelRight} ${bedRightY} L ${channelRight} ${GROUND_BOTTOM_Y} L ${channelLeft} ${GROUND_BOTTOM_Y} Z`

  const wavePeriod = 60
  const waveAmp = 3.2
  const wavePath = buildWavePath(channelW * 2 + wavePeriod, waveAmp, wavePeriod)

  const particleRows = 3
  const perRow = 9
  const particles = Array.from(
    { length: particleRows * perRow },
    (_, idx) => ({
      idx,
      row: idx % particleRows,
      i: Math.floor(idx / particleRows),
    }),
  )

  const dangerPulse = dominant === 'danger' || dominant === 'critical'

  const thresholdY = (current: number | null, threshold: number) => {
    const cur = current ?? 0
    const gap = threshold - cur
    if (gap <= 0) return SURFACE_Y
    return SURFACE_Y - gap * THRESHOLD_SCALE
  }

  const s1CriticalY = thresholdY(s1.level, t1.critical)
  const s1DangerY = thresholdY(s1.level, t1.danger)
  const s2CriticalY = thresholdY(s2.level, t2.critical)
  const s2DangerY = thresholdY(s2.level, t2.danger)

  const headroom1 = s1.level == null ? null : Math.max(0, t1.danger - s1.level)
  const headroom2 = s2.level == null ? null : Math.max(0, t2.danger - s2.level)

  const s1ShortName = t1.name.replace(' (ต้นน้ำ)', '').replace(' (upstream)', '')
  const s2ShortName = t2.name.replace(' (ตัวเมือง)', '').replace(' (downstream)', '')

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-medium tracking-tight">
          สถานะการไหลของน้ำ{' '}
          <span className="font-mono text-[var(--fg-muted)]">
            {config.s1} → {config.s2}
          </span>
        </h3>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em]"
          style={{ color: palette.glow, borderColor: `${palette.glow}55` }}
        >
          <span
            className={`size-1.5 rounded-full ${dangerPulse ? 'animate-pulse' : ''}`}
            style={{ background: palette.glow }}
          />
          {palette.label}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="wfv-water-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={palette.water} stopOpacity="0.7" />
            <stop offset="100%" stopColor={palette.water} stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="wfv-ground-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#7c5230" stopOpacity="1" />
            <stop offset="40%"  stopColor="#6b4423" stopOpacity="1" />
            <stop offset="100%" stopColor="#3d2210" stopOpacity="0.85" />
          </linearGradient>
          <pattern id="wfv-soil-dots" x="0" y="0" width="18" height="10" patternUnits="userSpaceOnUse">
            <circle cx="3"  cy="3"  r="0.9" fill="#a0714f" fillOpacity="0.45" />
            <circle cx="11" cy="7"  r="0.7" fill="#5c3318" fillOpacity="0.4"  />
            <circle cx="15" cy="2"  r="1.1" fill="#c49a72" fillOpacity="0.3"  />
            <circle cx="6"  cy="8"  r="0.6" fill="#9b6b42" fillOpacity="0.35" />
            <line x1="0" y1="5"   x2="4"  y2="5"  stroke="#5c3318" strokeOpacity="0.18" strokeWidth="0.6" />
            <line x1="9" y1="3.5" x2="16" y2="3.5" stroke="#5c3318" strokeOpacity="0.15" strokeWidth="0.6" />
          </pattern>
          <clipPath id="wfv-ground-clip">
            <path d={groundPath} />
          </clipPath>
          <clipPath id="wfv-water-clip">
            <path d={waterPath} />
          </clipPath>
        </defs>

        {/* ─── Header labels ─── */}
        <g>
          <text x={channelLeft} y="22" textAnchor="start" fontSize="11" fontWeight="700"
            fontFamily="ui-monospace, monospace" fill="var(--fg)">
            {config.s1}
          </text>
          <text x={channelLeft + 30} y="22" fontSize="10" fill="var(--fg-muted)">
            ต้นน้ำ · {s1ShortName}
          </text>
          <text x={channelLeft} y="42" fontSize="14" fontWeight="700"
            fontFamily="ui-monospace, monospace" fill={palette.glow}>
            {s1.level == null ? '—' : `${s1.level.toFixed(2)} m`}
          </text>
          <text x={channelLeft + 72} y="42" fontSize="10"
            fontFamily="ui-monospace, monospace" fill="var(--fg-muted)">
            Q {s1.discharge == null ? '—' : s1.discharge.toFixed(1)} m³/s
          </text>

          <text x={channelRight} y="22" textAnchor="end" fontSize="11" fontWeight="700"
            fontFamily="ui-monospace, monospace" fill="var(--fg)">
            {config.s2}
          </text>
          <text x={channelRight - 30} y="22" textAnchor="end" fontSize="10" fill="var(--fg-muted)">
            ปลายน้ำ · {s2ShortName}
          </text>
          <text x={channelRight} y="42" textAnchor="end" fontSize="14" fontWeight="700"
            fontFamily="ui-monospace, monospace" fill={palette.glow}>
            {s2.level == null ? '—' : `${s2.level.toFixed(2)} m`}
          </text>
          <text x={channelRight - 72} y="42" textAnchor="end" fontSize="10"
            fontFamily="ui-monospace, monospace" fill="var(--fg-muted)">
            Q {s2.discharge == null ? '—' : s2.discharge.toFixed(1)} m³/s
          </text>
        </g>

        {/* ─── Threshold markers (critical / danger per station) ─── */}
        <g>
          {/* ─ S1 (upstream) — markers float above the surface on the left side ─ */}
          {t1.danger > 0 ? (
            <>
              <rect x={channelLeft} y={s1DangerY} width={THRESHOLD_WIDTH}
                height={Math.max(0, s1CriticalY - s1DangerY)} fill="#ef4444" fillOpacity="0.1" />
              <line x1={channelLeft} x2={channelLeft} y1={SURFACE_Y - 8} y2={s1DangerY}
                stroke="#f87171" strokeOpacity="0.35" strokeDasharray="2 3" strokeWidth="1" />
              <line x1={channelLeft} x2={channelLeft + THRESHOLD_WIDTH} y1={s1CriticalY} y2={s1CriticalY}
                stroke="#f87171" strokeWidth="1.2" strokeDasharray="5 3" strokeOpacity="0.85" />
              <text x={channelLeft - 6} y={s1CriticalY + 11} textAnchor="end" fontSize="9.5"
                fontFamily="ui-monospace, monospace" fill="#f87171">
                {t1.critical.toFixed(1)} วิกฤต
              </text>
              <line x1={channelLeft} x2={channelLeft + THRESHOLD_WIDTH} y1={s1DangerY} y2={s1DangerY}
                stroke="#ef4444" strokeWidth="1.4" strokeDasharray="5 3" strokeOpacity="0.95" />
              <text x={channelLeft - 6} y={s1DangerY - 4} textAnchor="end" fontSize="9.5"
                fontFamily="ui-monospace, monospace" fontWeight="700" fill="#ef4444">
                {t1.danger.toFixed(1)} อันตราย
              </text>
              {headroom1 != null && (
                <text x={channelLeft + THRESHOLD_WIDTH + 6} y={(s1DangerY + s1CriticalY) / 2 + 3}
                  textAnchor="start" fontSize="9" fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
                  เหลือ {headroom1.toFixed(2)} m
                </text>
              )}
            </>
          ) : (
            <text x={channelLeft - 6} y={SURFACE_Y - 6} textAnchor="end" fontSize="9"
              fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
              ยังไม่กำหนดเกณฑ์
            </text>
          )}

          {/* ─ S2 (downstream) — markers mirrored on the right side ─ */}
          {t2.danger > 0 ? (
            <>
              <rect x={channelRight - THRESHOLD_WIDTH} y={s2DangerY} width={THRESHOLD_WIDTH}
                height={Math.max(0, s2CriticalY - s2DangerY)} fill="#ef4444" fillOpacity="0.1" />
              <line x1={channelRight} x2={channelRight} y1={SURFACE_Y - 8} y2={s2DangerY}
                stroke="#f87171" strokeOpacity="0.35" strokeDasharray="2 3" strokeWidth="1" />
              <line x1={channelRight - THRESHOLD_WIDTH} x2={channelRight} y1={s2CriticalY} y2={s2CriticalY}
                stroke="#f87171" strokeWidth="1.2" strokeDasharray="5 3" strokeOpacity="0.85" />
              <text x={channelRight + 6} y={s2CriticalY + 11} textAnchor="start" fontSize="9.5"
                fontFamily="ui-monospace, monospace" fill="#f87171">
                {t2.critical.toFixed(1)} วิกฤต
              </text>
              <line x1={channelRight - THRESHOLD_WIDTH} x2={channelRight} y1={s2DangerY} y2={s2DangerY}
                stroke="#ef4444" strokeWidth="1.4" strokeDasharray="5 3" strokeOpacity="0.95" />
              <text x={channelRight + 6} y={s2DangerY - 4} textAnchor="start" fontSize="9.5"
                fontFamily="ui-monospace, monospace" fontWeight="700" fill="#ef4444">
                {t2.danger.toFixed(1)} อันตราย
              </text>
              {headroom2 != null && (
                <text x={channelRight - THRESHOLD_WIDTH - 6} y={(s2DangerY + s2CriticalY) / 2 + 3}
                  textAnchor="end" fontSize="9" fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
                  เหลือ {headroom2.toFixed(2)} m
                </text>
              )}
            </>
          ) : (
            <text x={channelRight + 6} y={SURFACE_Y - 6} textAnchor="start" fontSize="9"
              fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
              ยังไม่กำหนดเกณฑ์
            </text>
          )}
        </g>

        {/* ─── Ground (soil gradient + texture) ─── */}
        <path d={groundPath} fill="url(#wfv-ground-grad)" />
        <path d={groundPath} fill="url(#wfv-soil-dots)" />

        {/* ─── Bed line (subtle, downstream slope) ─── */}
        <line x1={channelLeft} y1={bedLeftY} x2={channelRight} y2={bedRightY}
          stroke="#4a2c10" strokeWidth="1.6" strokeOpacity="0.8" />

        {/* ─── Bed-post ticks at even intervals ─── */}
        {Array.from({ length: 9 }).map((_, i) => {
          const t = i / 8
          const x = channelLeft + channelW * t
          const yBed = bedLeftY + (bedRightY - bedLeftY) * t
          return (
            <line key={i} x1={x} x2={x} y1={yBed + 1} y2={yBed + 5}
              stroke="#3d2210" strokeOpacity="0.6" />
          )
        })}

        {/* ─── Water body ─── */}
        <path d={waterPath} fill="url(#wfv-water-grad)" />

        {/* ─── Surface line (flat, 0°) ─── */}
        <line x1={channelLeft} y1={SURFACE_Y} x2={channelRight} y2={SURFACE_Y}
          stroke={palette.surface} strokeWidth="1.6" strokeOpacity="0.95" />

        {/* ─── Animated wavelets + particles (clipped to water) ─── */}
        <g clipPath="url(#wfv-water-clip)">
          <g transform={`translate(${channelLeft} ${SURFACE_Y + 10})`}>
            <path d={wavePath} fill="none" stroke={palette.surface} strokeOpacity="0.55" strokeWidth="1.2">
              <animateTransform attributeName="transform" type="translate"
                from="0 0" to={`-${wavePeriod * 2} 0`} dur={`${flowDur}s`} repeatCount="indefinite" />
            </path>
          </g>
          <g transform={`translate(${channelLeft} ${SURFACE_Y + 22})`}>
            <path d={wavePath} fill="none" stroke={palette.surface} strokeOpacity="0.28" strokeWidth="1">
              <animateTransform attributeName="transform" type="translate"
                from="0 0" to={`-${wavePeriod * 2} 0`} dur={`${flowDur * 1.45}s`} repeatCount="indefinite" />
            </path>
          </g>

          {particles.map((p) => {
            const lowestSafe = Math.min(bedLeftY, bedRightY) - 4
            const yPos = SURFACE_Y + 14 + (p.row / (particleRows - 1)) * (lowestSafe - SURFACE_Y - 18)
            const dur = flowDur * (0.85 + p.row * 0.18)
            const delay = (p.i / perRow) * dur
            return (
              <line key={p.idx} x1={channelLeft - 40} x2={channelLeft - 22} y1={yPos} y2={yPos}
                stroke={palette.surface} strokeOpacity={0.5 - p.row * 0.12} strokeWidth="1.6" strokeLinecap="round">
                <animate attributeName="x1" from={channelLeft - 40} to={channelRight + 10}
                  dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite" />
                <animate attributeName="x2" from={channelLeft - 22} to={channelRight + 28}
                  dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite" />
              </line>
            )
          })}
        </g>

        {/* ─── Station markers on the flat surface ─── */}
        <g>
          {/* S1 (upstream) */}
          <line x1={channelLeft} x2={channelLeft} y1={52} y2={SURFACE_Y - 8}
            stroke="var(--fg-subtle)" strokeDasharray="2 2" strokeOpacity="0.5" />
          <line x1={channelLeft - 10} x2={channelLeft + 10} y1={bedLeftY} y2={bedLeftY}
            stroke="var(--fg-subtle)" strokeWidth="1.4" strokeOpacity="0.75" />
          <circle cx={channelLeft} cy={SURFACE_Y} r="6" fill={palette.glow} stroke="var(--bg)" strokeWidth="1.5">
            <animate attributeName="r" values="6;9;6" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite" />
          </circle>

          {/* S2 (downstream) */}
          <line x1={channelRight} x2={channelRight} y1={52} y2={SURFACE_Y - 8}
            stroke="var(--fg-subtle)" strokeDasharray="2 2" strokeOpacity="0.5" />
          <line x1={channelRight - 10} x2={channelRight + 10} y1={bedRightY} y2={bedRightY}
            stroke="var(--fg-subtle)" strokeWidth="1.4" strokeOpacity="0.75" />
          <circle cx={channelRight} cy={SURFACE_Y} r="6" fill={palette.glow} stroke="var(--bg)" strokeWidth="1.5">
            <animate attributeName="r" values="6;9;6" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="1;0.5;1" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* ─── Footer ─── */}
        <text x={W / 2} y={H - 12} textAnchor="middle" fontSize="9.5" fill="var(--fg-subtle)">
          {config.distanceLabel} · เวลาเดินทาง {config.travelLabel}
        </text>
      </svg>
    </div>
  )
}
