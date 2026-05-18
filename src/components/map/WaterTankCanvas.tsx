'use client'

import { useRef, useEffect } from 'react'
import type { AlertLevel } from '@/lib/water-level'

const PALETTE: Record<AlertLevel, { back: string; middle: string; front: string }> = {
  normal:     { back: 'rgba(2, 132, 199, 0.4)',   middle: 'rgba(14, 165, 233, 0.6)',  front: 'rgba(56, 189, 248, 0.85)' },
  warning:    { back: 'rgba(161, 98, 7, 0.4)',    middle: 'rgba(202, 138, 4, 0.6)',   front: 'rgba(234, 179, 8, 0.85)'  },
  rapid_rise: { back: 'rgba(162, 28, 175, 0.4)',  middle: 'rgba(192, 38, 211, 0.6)',  front: 'rgba(232, 121, 249, 0.85)' },
  prepare:    { back: 'rgba(194, 65, 12, 0.4)',   middle: 'rgba(234, 88, 12, 0.6)',   front: 'rgba(251, 146, 60, 0.85)' },
  critical:   { back: 'rgba(185, 28, 28, 0.4)',   middle: 'rgba(220, 38, 38, 0.6)',   front: 'rgba(248, 113, 113, 0.85)' },
  danger:     { back: 'rgba(127, 29, 29, 0.45)',  middle: 'rgba(185, 28, 28, 0.65)',  front: 'rgba(239, 68, 68, 0.9)'   },
}

type Props = {
  pct: number
  alert: AlertLevel
  width?: number
  height?: number
}

export function WaterTankCanvas({ pct, alert, width = 52, height = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const stateRef = useRef({ currentPct: 0, offset: 0, targetPct: pct, alert })

  useEffect(() => { stateRef.current.targetPct = pct }, [pct])
  useEffect(() => { stateRef.current.alert = alert }, [alert])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    function drawWave(
      yPos: number, amplitude: number, frequency: number, offset: number, color: string,
    ) {
      ctx!.fillStyle = color
      ctx!.beginPath()
      ctx!.moveTo(0, height)
      ctx!.lineTo(0, yPos)
      for (let x = 0; x <= width; x++) {
        const y = yPos + Math.sin(x * frequency + offset) * amplitude
        ctx!.lineTo(x, y)
      }
      ctx!.lineTo(width, height)
      ctx!.closePath()
      ctx!.fill()
    }

    function animate() {
      const s = stateRef.current
      s.currentPct += (s.targetPct - s.currentPct) * 0.05
      s.offset += 0.04

      const colors = PALETTE[s.alert]
      ctx!.clearRect(0, 0, width, height)

      const waterTop = height * (1 - s.currentPct / 100)
      drawWave(waterTop, 4,   0.025, s.offset,        colors.back)
      drawWave(waterTop, 3,   0.035, s.offset * 1.4,  colors.middle)
      drawWave(waterTop, 5,   0.018, s.offset * 0.75, colors.front)

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, borderRadius: 6, flexShrink: 0 }}
      className="border border-white/10 bg-slate-900/50"
    />
  )
}
