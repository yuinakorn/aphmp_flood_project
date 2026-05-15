'use client'

import { useMemo, useState } from 'react'
import type { WaterLevelPoint } from '@/app/api/water-level/route'

type Props = {
  data: WaterLevelPoint[]
  thresholds: { p67: number; p1: number }
}

const W = 880
const H = 280
const PAD = { top: 16, right: 16, bottom: 32, left: 44 }

export function WaterLevelChart({ data, thresholds }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const { px, pyP67, pyP1, yTicks, xTicks, p67Path, p1Path, yMin, yMax } =
    useMemo(() => {
      const innerW = W - PAD.left - PAD.right
      const innerH = H - PAD.top - PAD.bottom

      const allLevels = data
        .flatMap((d) => [d.p67, d.p1])
        .filter((v): v is number => v != null)

      const lo = Math.min(...allLevels, 0)
      const hi = Math.max(...allLevels, 1)
      const padY = Math.max(0.2, (hi - lo) * 0.15)
      const yMin = Math.floor((lo - padY) * 10) / 10
      const yMax = Math.ceil((hi + padY) * 10) / 10

      const px = (i: number) =>
        PAD.left + (data.length <= 1 ? innerW / 2 : (i * innerW) / (data.length - 1))
      const py = (v: number) =>
        PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

      const buildPath = (key: 'p67' | 'p1') => {
        let d = ''
        let pen = false
        data.forEach((pt, i) => {
          const v = pt[key]
          if (v == null) {
            pen = false
            return
          }
          d += `${pen ? 'L' : 'M'}${px(i).toFixed(2)},${py(v).toFixed(2)} `
          pen = true
        })
        return d.trim()
      }

      const pyP67 = (v: number) => py(v)
      const pyP1 = (v: number) => py(v)

      const tickCount = 5
      const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
        const v = yMin + ((yMax - yMin) * i) / tickCount
        return { v, y: py(v) }
      })

      const xStep = Math.max(1, Math.floor(data.length / 8))
      const xTicks = data
        .map((d, i) => ({ d, i }))
        .filter(({ i }) => i % xStep === 0 || i === data.length - 1)
        .map(({ d, i }) => ({ x: px(i), label: `${d.time}` }))

      return {
        px,
        pyP67,
        pyP1,
        yTicks,
        xTicks,
        p67Path: buildPath('p67'),
        p1Path: buildPath('p1'),
        yMin,
        yMax,
      }
    }, [data])

  const hoverPt = hover != null ? data[hover] : null
  const hoverX = hover != null ? px(hover) : 0

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-medium tracking-tight">
          ระดับน้ำรายชั่วโมง (เมตร)
        </h3>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
            <span className="inline-block h-0.5 w-4 bg-sky-400" /> P.67
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
            <span className="inline-block h-0.5 w-4 bg-amber-400" /> P.1
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * W
          if (x < PAD.left || x > W - PAD.right) {
            setHover(null)
            return
          }
          const innerW = W - PAD.left - PAD.right
          const idx = Math.round(((x - PAD.left) / innerW) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, idx)))
        }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
            <text
              x={PAD.left - 6}
              y={t.y + 3}
              textAnchor="end"
              fontSize="9"
              fill="currentColor"
              fillOpacity={0.55}
            >
              {t.v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* threshold lines (only if in visible range) */}
        {thresholds.p67 >= yMin && thresholds.p67 <= yMax && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={pyP67(thresholds.p67)}
            y2={pyP67(thresholds.p67)}
            stroke="#f87171"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
        )}
        {thresholds.p1 >= yMin && thresholds.p1 <= yMax && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={pyP1(thresholds.p1)}
            y2={pyP1(thresholds.p1)}
            stroke="#fb923c"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
        )}

        {xTicks.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            fillOpacity={0.55}
          >
            {t.label}
          </text>
        ))}

        <path d={p67Path} stroke="#38bdf8" strokeWidth={1.5} fill="none" />
        <path d={p1Path} stroke="#fbbf24" strokeWidth={1.5} fill="none" />

        {hover != null && hoverPt && (
          <g>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="currentColor"
              strokeOpacity={0.3}
            />
            {hoverPt.p67 != null && (
              <circle cx={hoverX} cy={pyP67(hoverPt.p67)} r={3} fill="#38bdf8" />
            )}
            {hoverPt.p1 != null && (
              <circle cx={hoverX} cy={pyP1(hoverPt.p1)} r={3} fill="#fbbf24" />
            )}
          </g>
        )}
      </svg>

      <div className="mt-2 h-6 font-mono text-[11px] text-[var(--fg-muted)]">
        {hoverPt ? (
          <span>
            {hoverPt.date} {hoverPt.time} · P.67{' '}
            <span className="text-sky-400">
              {hoverPt.p67?.toFixed(2) ?? '—'}
            </span>{' '}
            m · P.1{' '}
            <span className="text-amber-400">
              {hoverPt.p1?.toFixed(2) ?? '—'}
            </span>{' '}
            m
          </span>
        ) : (
          <span className="text-[var(--fg-subtle)]">
            เลื่อนเมาส์เพื่อดูค่าราย ชม.
          </span>
        )}
      </div>
    </div>
  )
}
