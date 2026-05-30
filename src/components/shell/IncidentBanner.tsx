'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'
import type { IncidentStatus } from '@/types'

const STATUS_LABEL: Record<IncidentStatus, string> = {
  active: 'กำลังเกิด',
  monitoring: 'เฝ้าระวัง',
  closed: 'ปิดแล้ว',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
}

export function IncidentBanner() {
  const { active, setScope, isSwitching } = useIncidentScope()
  if (!active) return null

  const tone =
    active.status === 'active'
      ? 'bg-red-600 text-white border-red-700'
      : active.status === 'monitoring'
      ? 'bg-amber-500 text-white border-amber-600'
      : 'bg-slate-600 text-white border-slate-700'

  return (
    <div className={`sticky top-16 z-30 flex items-center gap-3 border-b px-4 py-2 text-[12.5px] ${tone}`}>
      <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">โหมดวิกฤต · {active.name}</span>
        <span className="ml-2 opacity-90">
          {STATUS_LABEL[active.status]} · เริ่ม {formatDate(active.startedAt)}
          {active.amphoe ? ` · อ.${active.amphoe}` : ''}
          {active.tambon ? ` ต.${active.tambon}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setScope(null)}
        disabled={isSwitching}
        className="inline-flex items-center gap-1 rounded border border-white/40 px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-white/15 disabled:opacity-50"
      >
        <X className="size-3" />
        ออกจากโหมดวิกฤต
      </button>
    </div>
  )
}
