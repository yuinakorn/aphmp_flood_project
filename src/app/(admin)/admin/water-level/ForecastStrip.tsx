'use client'

import { useMemo } from 'react'
import type { StationThreshold } from '@/lib/water-level'
import type { ForecastTier, LagEstimate, RatingCurve, TravelSource } from '@/lib/hydraulics'
import { InfoHint, HintSection, HintFormula } from './InfoHint'

type SeriesPoint = { t: number; v: number | null }

type Props = {
  /** ระดับน้ำปลายน้ำ observed (t ≤ 0 ชม.) */
  observed: SeriesPoint[]
  /** ระดับน้ำปลายน้ำพยากรณ์จาก routing (t ≥ 0 ชม.) */
  predicted: SeriesPoint[]
  tier: ForecastTier
  t2: StationThreshold
  stationCode: string
  simTime: number | null   // ตำแหน่ง cursor (null = ไม่แสดง)
  /** พยากรณ์เกินช่วงข้อมูลที่ rating curve fit ได้ — ความไม่แน่นอนสูงขึ้น */
  outOfRange: boolean
  modeLabel: string
  /** พารามิเตอร์จริงที่ใช้คำนวณ — แสดงในสูตรของ ⓘ */
  rating2: RatingCurve | null
  lag: LagEstimate | null
  travelHours: number
  travelSource: TravelSource
}

const TRAVEL_SOURCE_SHORT: Record<TravelSource, string> = {
  correlation: 'จาก cross-correlation ของข้อมูลจริง 72 ชม.',
  manning: 'จากสมการ Manning',
  fallback: 'ค่าตั้งต้นของลุ่มน้ำ',
}

const W = 880
const H = 170
const PAD = { top: 14, right: 16, bottom: 26, left: 44 }

const TIER_LABEL: Record<Exclude<ForecastTier, 'none'>, string> = {
  discharge: 'Muskingum routing (Q-domain)',
  level: 'lag-and-attenuate (level-domain)',
}

/** กราฟพยากรณ์ปลายน้ำ: observed ทึบ + predicted เส้นประ + เส้นเกณฑ์ + cursor */
export function ForecastStrip({
  observed, predicted, tier, t2, stationCode, simTime, outOfRange, modeLabel,
  rating2, lag, travelHours, travelSource,
}: Props) {
  const geom = useMemo(() => {
    if (tier === 'none') return null
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom

    const all = [...observed, ...predicted]
      .map((p) => p.v)
      .filter((v): v is number => v != null)
    if (all.length === 0) return null

    const thr = [t2.critical, t2.danger].filter((v) => v > 0)
    const lo = Math.min(...all)
    const hi = Math.max(...all, ...thr)
    const padY = Math.max(0.2, (hi - lo) * 0.15)
    const yMin = lo - padY
    const yMax = hi + padY

    const tMin = observed.length > 0 ? observed[0].t : 0
    const tMax = predicted.length > 0 ? predicted[predicted.length - 1].t : 1

    const px = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin)) * innerW
    const py = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

    const buildPath = (pts: SeriesPoint[]) => {
      let d = ''
      let pen = false
      for (const p of pts) {
        if (p.v == null) { pen = false; continue }
        d += `${pen ? 'L' : 'M'}${px(p.t).toFixed(1)},${py(p.v).toFixed(1)} `
        pen = true
      }
      return d.trim()
    }

    const yTicks = Array.from({ length: 4 }, (_, i) => {
      const v = yMin + ((yMax - yMin) * (i + 0.5)) / 4
      return { v, y: py(v) }
    })
    const xTicks: { t: number; x: number }[] = []
    for (let t = Math.ceil(tMin / 3) * 3; t <= tMax; t += 3) {
      xTicks.push({ t, x: px(t) })
    }

    return {
      px, py, yTicks, xTicks,
      obsPath: buildPath(observed),
      predPath: buildPath(predicted),
    }
  }, [observed, predicted, tier, t2])

  if (tier === 'none' || geom == null) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-xs text-[var(--fg-subtle)]">
        ข้อมูลย้อนหลังยังไม่พอสำหรับพยากรณ์ปลายน้ำ (ต้องมีข้อมูลย้อนหลังอย่างน้อย 24 ชม.)
        — แสดงเฉพาะค่าที่ปรับเองบนแผนภาพด้านบน
      </div>
    )
  }

  const { px, py, yTicks, xTicks, obsPath, predPath } = geom

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-medium tracking-tight">
          พยากรณ์ระดับน้ำปลายน้ำ{' '}
          <span className="font-mono text-[var(--fg-muted)]">{stationCode}</span>
          <span className="text-[10.5px] font-normal text-[var(--fg-subtle)]">
            {modeLabel}
          </span>
          <InfoHint wide>
            <HintSection title="มีไว้ทำไม">
              คาดการณ์ระดับน้ำปลายน้ำล่วงหน้า 12 ชม. เทียบเส้นเกณฑ์วิกฤต/อันตราย
              — เส้นทึบคือข้อมูลจริงย้อนหลัง เส้นประคือพยากรณ์
            </HintSection>

            {tier === 'discharge' ? (
              <>
                <p className="font-semibold">สูตรที่ใช้ — Muskingum routing (Q-domain)</p>
                <HintFormula>
                  O<sub>t</sub> = C₀·I<sub>t</sub> + C₁·I<sub>t−1</sub> + C₂·O<sub>t−1</sub>
                </HintFormula>
                <HintFormula>
                  C₀ = (Δt−2KX)/D &nbsp; C₁ = (Δt+2KX)/D
                  <br />
                  C₂ = (2K(1−X)−Δt)/D &nbsp; D = 2K(1−X)+Δt
                </HintFormula>
                <p>
                  K = <span className="font-mono">{travelHours.toFixed(2)} ชม.</span>{' '}
                  ({TRAVEL_SOURCE_SHORT[travelSource]}) · X = <span className="font-mono">0.2</span> ·
                  Δt = <span className="font-mono">0.25 ชม.</span> · แบ่งช่วงย่อย n = ⌈2KX/Δt⌉ กัน C₀ &lt; 0
                  · ปรับน้ำท่าด้านข้าง Q₂ = α·O + ค่าปรับฐาน (α = Q̄₂/Q̄₁ จากข้อมูลจริง)
                </p>
                <p className="font-semibold">แปลงระดับน้ำ ↔ อัตราการไหล (rating curve)</p>
                <HintFormula>
                  Q = a·(h−h₀)<sup>b</sup> &nbsp;⇔&nbsp; h = h₀ + (Q/a)<sup>1/b</sup>
                </HintFormula>
                {rating2 && (
                  <p>
                    ค่า fit จากข้อมูลจริง 72 ชม. ของ {stationCode}:{' '}
                    <span className="font-mono">
                      a = {rating2.a.toFixed(2)}, h₀ = {rating2.h0.toFixed(2)} m, b = {rating2.b.toFixed(2)}
                    </span>{' '}
                    (R² = <span className="font-mono">{rating2.r2.toFixed(3)}</span>, n = {rating2.n};
                    log-linear least squares + grid search h₀)
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold">สูตรที่ใช้ — lag-and-attenuate (level-domain)</p>
                <HintFormula>
                  ĥ₂(t) = h₂,₀ + β·[ h₁(t−τ) − h₁,₀ ]
                </HintFormula>
                <p>
                  τ (เวลาเดินทาง) = <span className="font-mono">{travelHours.toFixed(2)} ชม.</span>{' '}
                  — {TRAVEL_SOURCE_SHORT[travelSource]}
                  {lag && (
                    <>
                      {' '}(จุดที่ correlation ของ Δh สูงสุด, r ={' '}
                      <span className="font-mono">{lag.correlation.toFixed(2)}</span>,
                      refine แบบ parabolic)
                    </>
                  )}
                </p>
                <p>
                  β (อัตราส่วนลดทอน) ={' '}
                  <span className="font-mono">{(lag?.attenuation ?? 0.7).toFixed(2)}</span>{' '}
                  {lag
                    ? '— slope จาก regression ของ Δh₂ บน Δh₁ ที่ lag τ'
                    : '— ค่าตั้งต้นอนุรักษ์นิยม (ข้อมูลช่วงนี้นิ่งเกินกว่าจะประมาณจาก regression)'}
                </p>
                <p className="font-semibold">เวลาเดินทางจากสมการ Manning (เมื่อใช้)</p>
                <HintFormula>
                  Q = (1/n)·A·R<sup>2/3</sup>·S<sup>1/2</sup> &nbsp;→&nbsp; V = Q/A,&nbsp; c = (5/3)·V,&nbsp; τ = L/c
                </HintFormula>
                <p>
                  แก้ความลึกปกติจาก Q ด้วย bisection บนหน้าตัดสี่เหลี่ยมคางหมูของลำน้ำ
                  (ใช้แทน Muskingum เมื่อสถานีไม่มีข้อมูล Q พอ fit rating curve)
                </p>
              </>
            )}

            <HintSection title="ข้อจำกัด">
              เป็นการประมาณจากน้ำต้นน้ำเท่านั้น ไม่รวมฝนที่ตกเพิ่มระหว่างทางหรือน้ำจากลำน้ำสาขา
              ค่าที่เกินช่วงข้อมูลจริงจะติดป้าย &ldquo;นอกช่วงข้อมูลจริง&rdquo;
            </HintSection>
          </InfoHint>
        </h3>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          {TIER_LABEL[tier]}
          {outOfRange && (
            <span className="ml-1.5 normal-case tracking-normal text-amber-600 dark:text-amber-400">
              ~ นอกช่วงข้อมูลจริง
            </span>
          )}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y}
              stroke="currentColor" strokeOpacity={0.08} />
            <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize="9"
              fill="currentColor" fillOpacity={0.55}>
              {t.v.toFixed(1)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - PAD.bottom + 13} textAnchor="middle" fontSize="9"
            fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            {t.t === 0 ? 'ตอนนี้' : `${t.t > 0 ? '+' : ''}${t.t}`}
          </text>
        ))}

        {/* เส้นเกณฑ์ */}
        {[
          { v: t2.critical, color: '#f87171', label: 'วิกฤต' },
          { v: t2.danger, color: '#ef4444', label: 'อันตราย' },
        ].filter((t) => t.v > 0).map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={py(t.v)} y2={py(t.v)}
              stroke={t.color} strokeDasharray="5 4" strokeOpacity={0.5} />
            <text x={W - PAD.right - 4} y={py(t.v) - 4} textAnchor="end" fontSize="8.5"
              fontFamily="ui-monospace, monospace" fill={t.color} fillOpacity={0.85}>
              {t.label} {t.v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* เส้นแบ่ง "ตอนนี้" */}
        <line x1={px(0)} x2={px(0)} y1={PAD.top} y2={H - PAD.bottom}
          stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />

        {/* observed ทึบ + predicted เส้นประ */}
        <path d={obsPath} stroke="#fbbf24" strokeWidth={1.6} fill="none" />
        <path d={predPath} stroke="var(--accent)" strokeWidth={1.8}
          strokeDasharray="6 4" fill="none" />

        {/* cursor ตาม simTime */}
        {simTime != null && (
          <line x1={px(simTime)} x2={px(simTime)} y1={PAD.top} y2={H - PAD.bottom}
            stroke="var(--accent)" strokeOpacity={0.6} strokeWidth={1.2} />
        )}
      </svg>

      <div className="mt-1.5 flex items-center gap-4 text-[10.5px] text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-amber-400" /> ข้อมูลจริง 12 ชม.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--accent)]" /> พยากรณ์จาก routing
        </span>
      </div>
    </div>
  )
}
