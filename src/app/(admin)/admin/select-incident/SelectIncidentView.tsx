'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Sun, ArrowRight, Loader2, MapPin, CalendarClock } from 'lucide-react'
import type { Incident, IncidentStatus } from '@/types'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'

const STATUS_LABEL: Record<IncidentStatus, string> = {
  active: 'กำลังเกิด',
  monitoring: 'เฝ้าระวัง',
  closed: 'ปิดแล้ว',
}
const STATUS_TONE: Record<IncidentStatus, string> = {
  active: 'var(--risk-flood)',
  monitoring: 'var(--risk-near)',
  closed: 'var(--fg-subtle)',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
}

export function SelectIncidentView({ province, isNational }: { province: string | null; isNational: boolean }) {
  const router = useRouter()
  const { selectable, setScope } = useIncidentScope()
  const [busy, setBusy] = useState<string | null>(null)

  async function choose(incidentId: string | null, next: string) {
    if (busy) return
    setBusy(incidentId ?? 'normal')
    await setScope(incidentId)
    router.push(next)
  }

  return (
    <div className="mx-auto max-w-3xl py-4">
      <p className="gx-eyebrow">เริ่มต้นใช้งาน</p>
      <h1 className="gx-title mt-1.5 text-[length:var(--text-2xl)] leading-[var(--text-2xl--line-height)]">
        เลือกบริบทการทำงาน
      </h1>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--fg-muted)]">
        <MapPin size={14} strokeWidth={1.75} className="text-[var(--fg-subtle)]" />
        {isNational ? 'ทุกจังหวัด (ผู้ดูแลระดับชาติ)' : <>จังหวัด <b className="font-medium text-[var(--fg)]">{province ?? 'ไม่ระบุ'}</b></>}
        <span className="text-[var(--border-strong)]">·</span>
        เลือกเหตุการณ์ที่จะจัดการ หรือเข้าโหมดทะเบียนปกติ
      </p>

      {/* เหตุการณ์ */}
      <div className="mt-7">
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          เหตุการณ์ในพื้นที่
        </h2>
        {selectable.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {selectable.map((inc: Incident) => {
              const tone = STATUS_TONE[inc.status]
              const place = [inc.tambon && `ต.${inc.tambon}`, inc.amphoe && `อ.${inc.amphoe}`, inc.province].filter(Boolean).join(' · ')
              const loading = busy === inc.id
              return (
                <button
                  key={inc.id}
                  type="button"
                  disabled={!!busy}
                  onClick={() => choose(inc.id, '/admin/eoc')}
                  className="group flex items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-[color-mix(in_oklch,var(--risk-flood)_45%,var(--border))] disabled:opacity-60"
                >
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in oklch, ${tone} 14%, transparent)`, color: tone }}
                  >
                    <AlertTriangle size={20} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold tracking-tight">{inc.name}</span>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: `color-mix(in oklch, ${tone} 16%, transparent)`, color: tone }}
                      >
                        {STATUS_LABEL[inc.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--fg-subtle)]">
                      {place && <span className="inline-flex items-center gap-1"><MapPin size={11} strokeWidth={1.75} />{place}</span>}
                      <span className="inline-flex items-center gap-1"><CalendarClock size={11} strokeWidth={1.75} />เริ่ม {formatDate(inc.startedAt)}</span>
                    </div>
                  </div>
                  {loading ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-[var(--fg-subtle)]" />
                  ) : (
                    <ArrowRight size={18} strokeWidth={1.75} className="shrink-0 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--risk-flood)]" />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-6 text-center text-[13px] text-[var(--fg-muted)]">
            ยังไม่มีเหตุการณ์เปิดอยู่{isNational ? '' : `ในจังหวัด${province ?? ''}`} — เข้าโหมดทะเบียนปกติด้านล่างได้เลย
          </div>
        )}
      </div>

      {/* โหมดปกติ */}
      <div className="mt-6">
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          ใช้งานทั้งปี
        </h2>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => choose(null, '/admin/overview')}
          className="group flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-[color-mix(in_oklch,var(--accent)_45%,var(--border))] disabled:opacity-60"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_13%,transparent)] text-[var(--accent)]">
            <Sun size={20} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold tracking-tight">ทะเบียนปกติทั้งจังหวัด</div>
            <div className="mt-1 text-[12px] text-[var(--fg-subtle)]">
              ดูแลทะเบียนสุขภาพชุมชน + การเยี่ยมบ้านประจำ — ไม่ผูกกับเหตุการณ์ภัยพิบัติ
            </div>
          </div>
          {busy === 'normal' ? (
            <Loader2 size={18} className="shrink-0 animate-spin text-[var(--fg-subtle)]" />
          ) : (
            <ArrowRight size={18} strokeWidth={1.75} className="shrink-0 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
          )}
        </button>
      </div>
    </div>
  )
}
