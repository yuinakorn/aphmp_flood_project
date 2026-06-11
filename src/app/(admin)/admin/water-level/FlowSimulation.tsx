'use client'

import { type AlertLevel, type StationThreshold, type ProvinceConfig } from '@/lib/water-level'
import type { TravelSource } from '@/lib/hydraulics'
import { InfoHint, HintSection } from './InfoHint'

type StationFrame = {
  level: number | null
  discharge: number | null
  alert: AlertLevel
}

type Props = {
  s1: StationFrame
  s2: StationFrame
  t1: StationThreshold
  t2: StationThreshold
  config: ProvinceConfig
  /** ความเร็วน้ำ (m/s) จาก Manning ที่ Q ปัจจุบัน — ขับความเร็ว particle */
  velocityMs: number | null
  /** เวลาเดินทางคลื่นน้ำ S1→S2 (ชม.) + ที่มาของตัวเลข */
  travelHours: number
  travelSource: TravelSource
  /** ก้อนคลื่นที่กำลังเดินทาง (โหมด scenario): progress 0..1 ตามสัดส่วนเวลาเดินทางจริง */
  packet: { progress: number; amplitudeM: number } | null
}

const SEVERITY: Record<AlertLevel, number> = {
  normal: 0,
  warning: 1,
  rapid_rise: 2,
  prepare: 3,
  critical: 4,
  danger: 5,
}

export const PALETTE: Record<
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
// ฝั่งซ้าย = ต้นน้ำ (S1), ฝั่งขวา = ปลายน้ำ (S2)
// แต่ละฝั่งมี "สเกลเกจท้องถิ่น" ของตัวเอง (ระดับวัดจากศูนย์เสาวัดสถานีนั้น —
// เทียบความสูงข้ามสถานีตรง ๆ ไม่ได้) ผิวน้ำสองฝั่งจึงขยับอิสระ
// เชื่อมกลางลำด้วย smooth curve + ก้อนคลื่น (wave packet) เดินทางตามเวลาจริง

const W = 940
const H = 330
const PAD_X = 84
const TOP = 78            // เพดานสเกลเกจ
const BED_LEFT_Y = 272
const BED_RIGHT_Y = 286
const GROUND_BOTTOM_Y = H - 24
const SURFACE_SAMPLES = 72

const smoothstep = (u: number) => {
  const t = Math.max(0, Math.min(1, u))
  return t * t * (3 - 2 * t)
}

/** ช่วงสเกลเกจ (เมตร) ของแต่ละฝั่ง — danger + headroom, fallback เมื่อยังไม่กำหนดเกณฑ์ */
function gaugeRange(t: StationThreshold, level: number | null): number {
  if (t.danger > 0) return t.danger + 1.0
  return Math.max((level ?? 1) * 1.6, 4)
}

const TRAVEL_SOURCE_LABEL: Record<TravelSource, string> = {
  correlation: 'ประมาณจาก cross-correlation ข้อมูลจริง 72 ชม.',
  manning: 'สมการ Manning (หน้าตัดช่องน้ำโดยประมาณ)',
  fallback: 'ค่าตั้งต้นของลุ่มน้ำ',
}

export function FlowSimulation({
  s1, s2, t1, t2, config, velocityMs, travelHours, travelSource, packet,
}: Props) {
  const dominant: AlertLevel =
    SEVERITY[s1.alert] >= SEVERITY[s2.alert] ? s1.alert : s2.alert
  const palette = PALETTE[dominant]
  const dangerPulse = dominant === 'danger' || dominant === 'critical'

  const channelLeft = PAD_X
  const channelRight = W - PAD_X
  const channelW = channelRight - channelLeft

  // ── สเกลเกจท้องถิ่นต่อฝั่ง ──
  const range1 = gaugeRange(t1, s1.level)
  const range2 = gaugeRange(t2, s2.level)
  const ppm1 = (BED_LEFT_Y - TOP) / range1   // px ต่อเมตร ฝั่งซ้าย
  const ppm2 = (BED_RIGHT_Y - TOP) / range2  // px ต่อเมตร ฝั่งขวา

  const yOnGauge1 = (m: number) =>
    Math.max(TOP - 6, BED_LEFT_Y - m * ppm1)
  const yOnGauge2 = (m: number) =>
    Math.max(TOP - 6, BED_RIGHT_Y - m * ppm2)

  // ระดับติดลบ (น้ำต่ำกว่าศูนย์เสาวัด เช่น P.67 หน้าแล้ง) — แสดงเป็นฟิล์มน้ำบาง
  const surf1 = Math.min(BED_LEFT_Y - 5, yOnGauge1(Math.max(s1.level ?? 0, 0.06)))
  const surf2 = Math.min(BED_RIGHT_Y - 5, yOnGauge2(Math.max(s2.level ?? 0, 0.06)))

  // ── ผิวน้ำ: interpolate สองฝั่ง + ก้อนคลื่น gaussian ──
  const ampPx = packet
    ? Math.max(5, Math.min(30, packet.amplitudeM * ((ppm1 + ppm2) / 2) * 0.55))
    : 0
  const sigma = 0.06
  const surfacePts: { x: number; y: number }[] = []
  for (let i = 0; i <= SURFACE_SAMPLES; i++) {
    const u = i / SURFACE_SAMPLES
    const base = surf1 + (surf2 - surf1) * smoothstep(u)
    const bump = packet
      ? ampPx * Math.exp(-((u - packet.progress) ** 2) / (2 * sigma * sigma))
      : 0
    surfacePts.push({ x: channelLeft + u * channelW, y: base - bump })
  }
  const surfaceLine = surfacePts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
  const waterPath =
    `${surfaceLine} L ${channelRight} ${BED_RIGHT_Y} L ${channelLeft} ${BED_LEFT_Y} Z`
  const groundPath =
    `M ${channelLeft} ${BED_LEFT_Y} L ${channelRight} ${BED_RIGHT_Y} L ${channelRight} ${GROUND_BOTTOM_Y} L ${channelLeft} ${GROUND_BOTTOM_Y} Z`

  const packetX = packet ? channelLeft + packet.progress * channelW : 0
  const packetY = packet
    ? surf1 + (surf2 - surf1) * smoothstep(packet.progress) - ampPx
    : 0

  // ── ความเร็ว particle จากความเร็วน้ำจริง (decorative mapping) ──
  const v = velocityMs ?? 0.8
  const flowDur = Math.max(2.2, Math.min(10, 10 - v * 3))

  const particleRows = 3
  const perRow = 9
  const particles = Array.from({ length: particleRows * perRow }, (_, idx) => ({
    idx,
    row: idx % particleRows,
    i: Math.floor(idx / particleRows),
  }))
  const partTopY = Math.max(surf1, surf2) + 10
  const partBottomY = Math.min(BED_LEFT_Y, BED_RIGHT_Y) - 6

  // ── threshold markers ──
  const headroom1 =
    s1.level == null || t1.danger <= 0 ? null : Math.max(0, t1.danger - s1.level)
  const headroom2 =
    s2.level == null || t2.danger <= 0 ? null : Math.max(0, t2.danger - s2.level)

  const minorTicks = (t: StationThreshold) => [
    { v: t.warning, color: '#facc15', label: 'W' },
    { v: t.prepare, color: '#fb923c', label: 'P' },
  ]

  // ขีดสเกลเมตรบนเสาเกจ (ทุก 1 m หรือถี่กว่านั้นถ้าช่วงแคบ)
  const gaugeStep = (range: number) => (range > 6 ? 2 : 1)
  const gaugeTicks = (range: number) => {
    const step = gaugeStep(range)
    const ticks: number[] = []
    for (let m = 0; m <= range; m += step) ticks.push(m)
    return ticks
  }

  const s1ShortName = t1.name.replace(' (ต้นน้ำ)', '').replace(' (upstream)', '')
  const s2ShortName = t2.name.replace(' (ตัวเมือง)', '').replace(' (downstream)', '')

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-medium tracking-tight">
          สถานะการไหลของน้ำ{' '}
          <span className="font-mono text-[var(--fg-muted)]">
            {config.s1} → {config.s2}
          </span>
          <InfoHint>
            <HintSection title="มีไว้ทำไม">
              เห็นน้ำต้นน้ำกับปลายน้ำคู่กันในภาพเดียว พร้อมเส้นเกณฑ์เตือนและระยะที่เหลือก่อนถึงขั้นอันตราย
            </HintSection>
            <HintSection title="หลักการ">
              ระดับน้ำแต่ละสถานีวัดจากศูนย์เสาวัดของตัวเอง สเกลซ้าย/ขวาจึงแยกอิสระ
              (เทียบความสูงข้ามสถานีตรง ๆ ไม่ได้) ก้อนคลื่นที่วิ่งบนผิวน้ำคือมวลน้ำจากเหตุการณ์จำลอง
              เคลื่อนที่ตามเวลาเดินทางจริง
            </HintSection>
            <HintSection title="วิธีคำนวณ">
              ความเร็วน้ำจากสมการ Manning (แก้ความลึกจากอัตราการไหล Q บนหน้าตัดลำน้ำ) ·
              เวลาเดินทางใช้ค่าที่วัดจากข้อมูลจริง 72 ชม. (cross-correlation) ก่อน
              ถ้าหาไม่ได้จึงใช้ Manning หรือค่าตั้งต้นของลุ่มน้ำ
            </HintSection>
          </InfoHint>
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
          <linearGradient id="fsim-water-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={palette.water} stopOpacity="0.7" />
            <stop offset="100%" stopColor={palette.water} stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="fsim-ground-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#7c5230" stopOpacity="1" />
            <stop offset="40%"  stopColor="#6b4423" stopOpacity="1" />
            <stop offset="100%" stopColor="#3d2210" stopOpacity="0.85" />
          </linearGradient>
          <pattern id="fsim-soil-dots" x="0" y="0" width="18" height="10" patternUnits="userSpaceOnUse">
            <circle cx="3"  cy="3"  r="0.9" fill="#a0714f" fillOpacity="0.45" />
            <circle cx="11" cy="7"  r="0.7" fill="#5c3318" fillOpacity="0.4"  />
            <circle cx="15" cy="2"  r="1.1" fill="#c49a72" fillOpacity="0.3"  />
            <circle cx="6"  cy="8"  r="0.6" fill="#9b6b42" fillOpacity="0.35" />
            <line x1="0" y1="5"   x2="4"  y2="5"  stroke="#5c3318" strokeOpacity="0.18" strokeWidth="0.6" />
            <line x1="9" y1="3.5" x2="16" y2="3.5" stroke="#5c3318" strokeOpacity="0.15" strokeWidth="0.6" />
          </pattern>
          <clipPath id="fsim-water-clip">
            <path d={waterPath} />
          </clipPath>
        </defs>

        {/* ─── Header labels ─── */}
        <g>
          <text x={channelLeft} y="22" textAnchor="start" fontSize="11" fontWeight="700"
            fontFamily="ui-monospace, monospace" fill="var(--fg)">
            {config.s1}
          </text>
          <text x={channelLeft + 34} y="22" fontSize="10" fill="var(--fg-muted)">
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
          <text x={channelRight - 34} y="22" textAnchor="end" fontSize="10" fill="var(--fg-muted)">
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

        {/* ─── เสาเกจท้องถิ่น (ซ้าย S1 / ขวา S2) ─── */}
        <g>
          {/* S1 */}
          <line x1={channelLeft} x2={channelLeft} y1={TOP - 4} y2={BED_LEFT_Y}
            stroke="var(--fg-subtle)" strokeOpacity="0.55" strokeWidth="1.2" />
          {gaugeTicks(range1).map((m) => (
            <g key={`g1-${m}`}>
              <line x1={channelLeft - 5} x2={channelLeft} y1={yOnGauge1(m)} y2={yOnGauge1(m)}
                stroke="var(--fg-subtle)" strokeOpacity="0.55" />
              <text x={channelLeft - 9} y={yOnGauge1(m) + 3} textAnchor="end" fontSize="8.5"
                fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
                {m}
              </text>
            </g>
          ))}
          {/* S2 */}
          <line x1={channelRight} x2={channelRight} y1={TOP - 4} y2={BED_RIGHT_Y}
            stroke="var(--fg-subtle)" strokeOpacity="0.55" strokeWidth="1.2" />
          {gaugeTicks(range2).map((m) => (
            <g key={`g2-${m}`}>
              <line x1={channelRight} x2={channelRight + 5} y1={yOnGauge2(m)} y2={yOnGauge2(m)}
                stroke="var(--fg-subtle)" strokeOpacity="0.55" />
              <text x={channelRight + 9} y={yOnGauge2(m) + 3} textAnchor="start" fontSize="8.5"
                fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
                {m}
              </text>
            </g>
          ))}
        </g>

        {/* ─── Threshold markers ─── */}
        <g>
          {/* S1 (ซ้าย) */}
          {t1.danger > 0 ? (
            <>
              {minorTicks(t1).filter((m) => m.v > 0).map((m) => (
                <g key={`m1-${m.label}`}>
                  <line x1={channelLeft} x2={channelLeft + 18} y1={yOnGauge1(m.v)} y2={yOnGauge1(m.v)}
                    stroke={m.color} strokeWidth="1.1" strokeOpacity="0.7" />
                  <text x={channelLeft + 21} y={yOnGauge1(m.v) + 3} fontSize="8.5"
                    fontFamily="ui-monospace, monospace" fill={m.color} fillOpacity="0.85">
                    {m.label}
                  </text>
                </g>
              ))}
              {t1.critical > 0 && (
                <>
                  <line x1={channelLeft} x2={channelLeft + 120} y1={yOnGauge1(t1.critical)} y2={yOnGauge1(t1.critical)}
                    stroke="#f87171" strokeWidth="1.2" strokeDasharray="5 3" strokeOpacity="0.85" />
                  <text x={channelLeft + 124} y={yOnGauge1(t1.critical) + 3} fontSize="9"
                    fontFamily="ui-monospace, monospace" fill="#f87171">
                    {t1.critical.toFixed(1)} วิกฤต
                  </text>
                </>
              )}
              <line x1={channelLeft} x2={channelLeft + 120} y1={yOnGauge1(t1.danger)} y2={yOnGauge1(t1.danger)}
                stroke="#ef4444" strokeWidth="1.4" strokeDasharray="5 3" strokeOpacity="0.95" />
              <text x={channelLeft + 124} y={yOnGauge1(t1.danger) + 3} fontSize="9"
                fontFamily="ui-monospace, monospace" fontWeight="700" fill="#ef4444">
                {t1.danger.toFixed(1)} อันตราย
              </text>
              {headroom1 != null && (
                <text x={channelLeft + 18} y={Math.max(TOP + 4, yOnGauge1(t1.danger)) - 7}
                  fontSize="9" fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
                  เหลือ {headroom1.toFixed(2)} m
                </text>
              )}
            </>
          ) : (
            <text x={channelLeft + 8} y={TOP + 8} fontSize="9"
              fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
              ยังไม่กำหนดเกณฑ์
            </text>
          )}

          {/* S2 (ขวา) — กระจกเงา */}
          {t2.danger > 0 ? (
            <>
              {minorTicks(t2).filter((m) => m.v > 0).map((m) => (
                <g key={`m2-${m.label}`}>
                  <line x1={channelRight - 18} x2={channelRight} y1={yOnGauge2(m.v)} y2={yOnGauge2(m.v)}
                    stroke={m.color} strokeWidth="1.1" strokeOpacity="0.7" />
                  <text x={channelRight - 21} y={yOnGauge2(m.v) + 3} textAnchor="end" fontSize="8.5"
                    fontFamily="ui-monospace, monospace" fill={m.color} fillOpacity="0.85">
                    {m.label}
                  </text>
                </g>
              ))}
              {t2.critical > 0 && (
                <>
                  <line x1={channelRight - 120} x2={channelRight} y1={yOnGauge2(t2.critical)} y2={yOnGauge2(t2.critical)}
                    stroke="#f87171" strokeWidth="1.2" strokeDasharray="5 3" strokeOpacity="0.85" />
                  <text x={channelRight - 124} y={yOnGauge2(t2.critical) + 3} textAnchor="end" fontSize="9"
                    fontFamily="ui-monospace, monospace" fill="#f87171">
                    {t2.critical.toFixed(1)} วิกฤต
                  </text>
                </>
              )}
              <line x1={channelRight - 120} x2={channelRight} y1={yOnGauge2(t2.danger)} y2={yOnGauge2(t2.danger)}
                stroke="#ef4444" strokeWidth="1.4" strokeDasharray="5 3" strokeOpacity="0.95" />
              <text x={channelRight - 124} y={yOnGauge2(t2.danger) + 3} textAnchor="end" fontSize="9"
                fontFamily="ui-monospace, monospace" fontWeight="700" fill="#ef4444">
                {t2.danger.toFixed(1)} อันตราย
              </text>
              {headroom2 != null && (
                <text x={channelRight - 18} y={Math.max(TOP + 4, yOnGauge2(t2.danger)) - 7}
                  textAnchor="end" fontSize="9" fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
                  เหลือ {headroom2.toFixed(2)} m
                </text>
              )}
            </>
          ) : (
            <text x={channelRight - 8} y={TOP + 8} textAnchor="end" fontSize="9"
              fontFamily="ui-monospace, monospace" fill="var(--fg-subtle)">
              ยังไม่กำหนดเกณฑ์
            </text>
          )}
        </g>

        {/* ─── Ground ─── */}
        <path d={groundPath} fill="url(#fsim-ground-grad)" />
        <path d={groundPath} fill="url(#fsim-soil-dots)" />
        <line x1={channelLeft} y1={BED_LEFT_Y} x2={channelRight} y2={BED_RIGHT_Y}
          stroke="#4a2c10" strokeWidth="1.6" strokeOpacity="0.8" />

        {/* ─── Water body + ผิวน้ำ ─── */}
        <path d={waterPath} fill="url(#fsim-water-grad)" />
        <path d={surfaceLine} fill="none" stroke={palette.surface}
          strokeWidth="1.8" strokeOpacity="0.95" />

        {/* ─── ก้อนคลื่นที่กำลังเดินทาง ─── */}
        {packet && (
          <g>
            <ellipse cx={packetX} cy={packetY + 4} rx="26" ry="9"
              fill={palette.glow} fillOpacity="0.28">
              <animate attributeName="fill-opacity" values="0.28;0.5;0.28" dur="1.6s" repeatCount="indefinite" />
            </ellipse>
            <text x={packetX} y={packetY - 10} textAnchor="middle" fontSize="9"
              fontFamily="ui-monospace, monospace" fill={palette.glow}>
              +{packet.amplitudeM.toFixed(1)} m
            </text>
          </g>
        )}

        {/* ─── Animated particles (clipped to water) ─── */}
        <g clipPath="url(#fsim-water-clip)">
          {particles.map((p) => {
            const yPos = partTopY + (p.row / (particleRows - 1)) * Math.max(8, partBottomY - partTopY)
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

        {/* ─── หมุดสถานีบนผิวน้ำ ─── */}
        <g>
          <line x1={channelLeft} x2={channelLeft} y1={52} y2={TOP - 8}
            stroke="var(--fg-subtle)" strokeDasharray="2 2" strokeOpacity="0.5" />
          <circle cx={channelLeft} cy={surf1} r="6" fill={palette.glow} stroke="var(--bg)" strokeWidth="1.5">
            <animate attributeName="r" values="6;9;6" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite" />
          </circle>

          <line x1={channelRight} x2={channelRight} y1={52} y2={TOP - 8}
            stroke="var(--fg-subtle)" strokeDasharray="2 2" strokeOpacity="0.5" />
          <circle cx={channelRight} cy={surf2} r="6" fill={palette.glow} stroke="var(--bg)" strokeWidth="1.5">
            <animate attributeName="r" values="6;9;6" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="1;0.5;1" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* ─── Footer ─── */}
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="9.5" fill="var(--fg-subtle)">
          {config.distanceLabel}
          {' · '}ความเร็วน้ำ {velocityMs == null ? '—' : `~${velocityMs.toFixed(1)} m/s`}
          {' · '}คลื่นน้ำเดินทาง ~{travelHours.toFixed(1)} ชม.
        </text>
      </svg>

      <p className="mt-1.5 text-[10.5px] text-[var(--fg-subtle)]">
        เวลาเดินทาง: {TRAVEL_SOURCE_LABEL[travelSource]} · ระดับน้ำแต่ละสถานีวัดจากศูนย์เสาวัดของตัวเอง
        (สเกลซ้าย/ขวาอิสระ — เทียบความสูงข้ามสถานีตรง ๆ ไม่ได้)
      </p>
    </div>
  )
}
