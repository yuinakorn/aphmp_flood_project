'use client'

import { useMemo, useState } from 'react'
import type { WaterLevelPoint } from '@/app/api/water-level/route'

type Props = {
  data: WaterLevelPoint[]
  thresholds: { s1: number; s2: number }
  station1: string
  station2: string
}

const W = 880
const H = 280
const PAD = { top: 16, right: 16, bottom: 32, left: 44 }

export function WaterLevelChart({ data, thresholds, station1, station2 }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const { px, pyS1, pyS2, yTicks, xTicks, s1Path, s2Path } =
    useMemo(() => {
      const innerW = W - PAD.left - PAD.right
      const innerH = H - PAD.top - PAD.bottom

      const allLevels = data
        .flatMap((d) => [d.s1, d.s2])
        .filter((v): v is number => v != null)

      const reach = [...allLevels, thresholds.s1, thresholds.s2]
      const lo = Math.min(...reach)
      const hi = Math.max(...reach)
      const padY = Math.max(0.3, (hi - lo) * 0.12)
      const yMin = Math.floor((lo - padY) * 10) / 10
      const yMax = Math.ceil((hi + padY) * 10) / 10

      const px = (i: number) =>
        PAD.left + (data.length <= 1 ? innerW / 2 : (i * innerW) / (data.length - 1))
      const py = (v: number) =>
        PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

      const buildPath = (key: 's1' | 's2') => {
        let d = ''
        let pen = false
        data.forEach((pt, i) => {
          const v = pt[key]
          if (v == null) { pen = false; return }
          d += `${pen ? 'L' : 'M'}${px(i).toFixed(2)},${py(v).toFixed(2)} `
          pen = true
        })
        return d.trim()
      }

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
        pyS1: py,
        pyS2: py,
        yTicks,
        xTicks,
        s1Path: buildPath('s1'),
        s2Path: buildPath('s2'),
        yMin,
        yMax,
      }
    }, [data, thresholds])

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
            <span className="inline-block h-0.5 w-4 bg-sky-400" /> {station1}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
            <span className="inline-block h-0.5 w-4 bg-amber-400" /> {station2}
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
          if (x < PAD.left || x > W - PAD.right) { setHover(null); return }
          const innerW = W - PAD.left - PAD.right
          const idx = Math.round(((x - PAD.left) / innerW) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, idx)))
        }}
      >
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

        {[
          { v: thresholds.s1, color: '#38bdf8', label: `${station1} วิกฤต ${thresholds.s1.toFixed(1)}m`, py: pyS1 },
          { v: thresholds.s2, color: '#fbbf24', label: `${station2} วิกฤต ${thresholds.s2.toFixed(1)}m`, py: pyS2 },
        ].map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.py(t.v)} y2={t.py(t.v)}
              stroke={t.color} strokeDasharray="5 4" strokeOpacity={0.55} strokeWidth={1} />
            <text x={W - PAD.right - 4} y={t.py(t.v) - 4} textAnchor="end" fontSize="9"
              fontFamily="ui-monospace, monospace" fill={t.color} fillOpacity={0.85}>
              {t.label}
            </text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9"
            fill="currentColor" fillOpacity={0.55}>
            {t.label}
          </text>
        ))}

        <path d={s1Path} stroke="#38bdf8" strokeWidth={1.5} fill="none" />
        <path d={s2Path} stroke="#fbbf24" strokeWidth={1.5} fill="none" />

        {hover != null && hoverPt && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={H - PAD.bottom}
              stroke="currentColor" strokeOpacity={0.3} />
            {hoverPt.s1 != null && (
              <circle cx={hoverX} cy={pyS1(hoverPt.s1)} r={3} fill="#38bdf8" />
            )}
            {hoverPt.s2 != null && (
              <circle cx={hoverX} cy={pyS2(hoverPt.s2)} r={3} fill="#fbbf24" />
            )}
          </g>
        )}
      </svg>

      <div className="mt-2 h-6 font-mono text-[11px] text-[var(--fg-muted)]">
        {hoverPt ? (
          <span>
            {hoverPt.date} {hoverPt.time} · {station1}{' '}
            <span className="text-sky-400">
              {hoverPt.s1?.toFixed(2) ?? '—'}
            </span>{' '}
            m · {station2}{' '}
            <span className="text-amber-400">
              {hoverPt.s2?.toFixed(2) ?? '—'}
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
