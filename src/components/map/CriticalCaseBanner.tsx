'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'

interface Props {
  count: number
  onView: () => void
}

// แถบเตือนเชิงปฏิบัติการ — ผู้ป่วยกลุ่มวิกฤต (priority A) ที่อยู่ในเขตน้ำท่วม
// เห็นแล้วกดดูรายชื่อเพื่อเร่งประเมิน/อพยพได้ทันที (โผล่เฉพาะตอนมีเคส)
export function CriticalCaseBanner({ count, onView }: Props) {
  if (count <= 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-[401] flex justify-center">
      <div className="pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-lg border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_12%,var(--bg-elevated))] px-3.5 py-2.5 shadow-lg backdrop-blur">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--risk-flood)] text-white">
          <AlertTriangle className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-semibold text-[var(--fg)]">
            ผู้ป่วยกลุ่มวิกฤต (A) ในเขตน้ำท่วม{' '}
            <span className="font-mono text-[var(--risk-flood)]">{count}</span> ราย
          </p>
          <p className="text-[11.5px] text-[var(--fg-muted)]">ต้องเร่งประเมิน/ประสานอพยพโดยด่วน</p>
        </div>
        <button
          type="button"
          onClick={onView}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--risk-flood)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          ดูรายชื่อ <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
