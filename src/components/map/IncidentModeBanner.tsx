'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Incident } from '@/types'

const POLL_MS = 5 * 60 * 1000

// แถบบ่งชี้ "โหมดวิกฤต" — แสดงเมื่อมีเหตุการณ์ที่กำลังเกิด (status=active) อย่างน้อย 1 รายการ
// fetch ต้องการ session; ผู้ใช้ที่ไม่ได้ login จะได้ 401 → แถบไม่แสดง (เงียบ)
export function IncidentModeBanner() {
  const [active, setActive] = useState<Incident[]>([])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/incidents?status=active')
        if (!res.ok) return
        const json = await res.json()
        if (alive) setActive((json.data as Incident[]) ?? [])
      } catch {
        /* silent */
      }
    }
    void load()
    const id = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  if (active.length === 0) return null

  const label =
    active.length === 1
      ? active[0].name
      : `${active.length} เหตุการณ์กำลังเกิด`

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-3 top-3 z-[500] flex max-w-[280px] items-center gap-2 rounded-lg px-3 py-2"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid oklch(0.62 0.22 22 / 0.7)',
        boxShadow: '0 4px 24px oklch(0 0 0 / 0.45)',
      }}
    >
      <AlertTriangle
        size={14}
        strokeWidth={2.2}
        className="shrink-0 animate-pulse"
        style={{ color: 'oklch(0.62 0.22 22)' }}
      />
      <div className="min-w-0">
        <div
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'oklch(0.62 0.22 22)' }}
        >
          โหมดวิกฤต
        </div>
        <div className="truncate text-[12px] font-medium text-[var(--fg)]">{label}</div>
      </div>
    </div>
  )
}
