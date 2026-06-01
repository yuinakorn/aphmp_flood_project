'use client'

import { AlertTriangle, Check, ChevronDown, Loader2, Sun } from 'lucide-react'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { IncidentStatus } from '@/types'

const STATUS_LABEL: Record<IncidentStatus, string> = {
  active: 'กำลังเกิด',
  monitoring: 'เฝ้าระวัง',
  closed: 'ปิดแล้ว',
}
const STATUS_TONE: Record<IncidentStatus, string> = {
  active: 'bg-red-500/20 text-red-300',
  monitoring: 'bg-amber-500/20 text-amber-300',
  closed: 'bg-slate-500/20 text-slate-300',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
}

export function IncidentSwitcher() {
  const { active, selectable, isSwitching, setScope } = useIncidentScope()
  const hasActive = active !== null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={
              hasActive
                ? 'flex cursor-pointer items-center gap-2 rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-[12px] font-medium text-red-100 outline-none transition-colors hover:bg-red-500/25'
                : 'flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[12px] text-slate-300 outline-none transition-colors hover:bg-slate-700'
            }
          />
        }
      >
        {hasActive ? (
          active.status === 'active' ? (
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-200" />
            </span>
          ) : (
            <AlertTriangle className="size-3.5" strokeWidth={2} />
          )
        ) : (
          <Sun className="size-3.5 text-slate-400" strokeWidth={1.75} />
        )}
        <span className="hidden max-w-[220px] truncate sm:inline">
          {hasActive ? (
            <>{active.status === 'active' && <span className="font-semibold">วิกฤต · </span>}{active.name}</>
          ) : (
            'โหมดปกติ'
          )}
        </span>
        {isSwitching ? (
          <Loader2 className="size-3 animate-spin opacity-60" />
        ) : (
          <ChevronDown className="size-3 opacity-60" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 border border-[var(--border)] bg-[var(--bg-elevated)] p-1 text-[var(--fg)] shadow-md"
      >
        <div className="px-2.5 py-2 text-[11px] text-[var(--fg-subtle)]">
          เลือกเหตุการณ์ที่กำลังจัดการ
        </div>

        <DropdownMenuItem
          onClick={() => setScope(null)}
          className="flex items-start justify-between gap-2 px-2.5 py-2.5 cursor-pointer"
        >
          <div className="flex items-start gap-2">
            <Sun className="mt-0.5 size-4 shrink-0 opacity-70" />
            <div>
              <div className="text-[12.5px] font-medium">โหมดปกติ</div>
              <div className="text-[11px] text-[var(--fg-subtle)]">
                ทะเบียนสุขภาพ + visit ประจำ (ไม่ผูกเหตุการณ์)
              </div>
            </div>
          </div>
          {!hasActive && <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />}
        </DropdownMenuItem>

        {selectable.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1 border-t border-[var(--border)]" />
            <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
              เหตุการณ์
            </div>
            {selectable.map((inc) => {
              const isActive = active?.id === inc.id
              return (
                <DropdownMenuItem
                  key={inc.id}
                  onClick={() => setScope(inc.id)}
                  className="flex items-start justify-between gap-2 px-2.5 py-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium">{inc.name}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_TONE[inc.status]}`}
                      >
                        {STATUS_LABEL[inc.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
                      เริ่ม {formatDate(inc.startedAt)}
                      {inc.amphoe ? ` · อ.${inc.amphoe}` : ''}
                      {inc.tambon ? ` ต.${inc.tambon}` : ''}
                    </div>
                  </div>
                  {isActive && <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />}
                </DropdownMenuItem>
              )
            })}
          </>
        )}

        {selectable.length === 0 && (
          <p className="border-t border-[var(--border)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
            ยังไม่มีเหตุการณ์เปิดอยู่ในระบบ
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
