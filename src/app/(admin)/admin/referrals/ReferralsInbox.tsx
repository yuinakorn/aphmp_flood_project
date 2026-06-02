'use client'

import { useEffect, useMemo, useState } from 'react'
import { Hospital, Tent, ArrowRight, Clock, RefreshCw } from 'lucide-react'
import {
  REFERRAL_STATUS_LABEL, REFERRAL_PRIORITY_LABEL,
  type HospitalReferral, type ReferralStatus, type ReferralPriority,
} from '@/types'

const PRIORITY_TONE: Record<ReferralPriority, string> = {
  critical: 'var(--risk-flood)',
  high: 'var(--risk-near)',
  normal: 'var(--fg-muted)',
  low: 'var(--fg-subtle)',
}

const STATUS_TONE: Record<ReferralStatus, string> = {
  pending: 'var(--risk-near)',
  accepted: 'var(--signal-data)',
  en_route: 'var(--signal-data)',
  arrived: 'var(--signal-data)',
  admitted: 'var(--risk-safe)',
  rejected: 'var(--risk-flood)',
  cancelled: 'var(--fg-subtle)',
}

// ปุ่มเลื่อนสถานะถัดไป (ปลายทาง/ผู้ประสาน)
const NEXT_ACTIONS: { from: ReferralStatus; to: ReferralStatus; label: string }[] = [
  { from: 'pending', to: 'accepted', label: 'ตอบรับ' },
  { from: 'accepted', to: 'arrived', label: 'ผู้ป่วยถึงแล้ว' },
  { from: 'en_route', to: 'arrived', label: 'ผู้ป่วยถึงแล้ว' },
  { from: 'arrived', to: 'admitted', label: 'รับเข้ารักษา' },
]

const ACTIVE_STATUSES: ReferralStatus[] = ['pending', 'accepted', 'en_route', 'arrived']

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

export function ReferralsInbox({ initial }: { initial: HospitalReferral[] }) {
  const [referrals, setReferrals] = useState<HospitalReferral[]>(initial)
  const [tab, setTab] = useState<'active' | 'all'>('active')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/referrals', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] }))
    setReferrals(res.data ?? [])
  }

  // refresh เมื่อสลับแท็บ (โหลดทั้งหมดอยู่แล้ว — กรอง client)
  useEffect(() => { void load() }, [])

  async function setStatus(id: string, status: ReferralStatus) {
    setBusyId(id)
    await fetch(`/api/referrals/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
    await load()
    setBusyId(null)
  }

  const shown = useMemo(
    () => (tab === 'active' ? referrals.filter((r) => ACTIVE_STATUSES.includes(r.status)) : referrals),
    [referrals, tab],
  )

  // จัดกลุ่มตามโรงพยาบาลปลายทาง
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; items: HospitalReferral[] }>()
    for (const r of shown) {
      const key = r.toFacilityId ?? r.toFacilityText ?? '(ไม่ระบุ)'
      const name = r.toFacilityName ?? r.toFacilityText ?? '(ไม่ระบุปลายทาง)'
      if (!m.has(key)) m.set(key, { name, items: [] })
      m.get(key)!.items.push(r)
    }
    return [...m.values()].sort((a, b) => b.items.length - a.items.length)
  }, [shown])

  const activeCount = referrals.filter((r) => ACTIVE_STATUSES.includes(r.status)).length

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="gx-title">ส่งต่อโรงพยาบาล</h1>
          <p className="text-xs text-[var(--fg-subtle)]">เคสที่ถูกส่งจากศูนย์พักพิงมายังสถานพยาบาล</p>
        </div>
        <button type="button" onClick={() => void load()} className="gx-btn gx-btn-ghost gx-btn-sm">
          <RefreshCw size={13} /> รีเฟรช
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`gx-btn gx-btn-sm ${tab === 'active' ? 'gx-btn-primary' : 'gx-btn-ghost'}`}
        >
          กำลังดำเนินการ {activeCount > 0 && <span className="ml-1 font-mono">{activeCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`gx-btn gx-btn-sm ${tab === 'all' ? 'gx-btn-primary' : 'gx-btn-ghost'}`}
        >
          ทั้งหมด
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="gx-card mt-4 py-12 text-center text-sm text-[var(--fg-subtle)]">
          {tab === 'active' ? 'ไม่มีเคสที่กำลังดำเนินการ' : 'ยังไม่มีการส่งต่อ'}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => (
            <section key={g.name} className="gx-card overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
                <Hospital size={15} className="text-[var(--risk-near)]" />
                <span className="text-sm font-semibold text-[var(--fg)]">{g.name}</span>
                <span className="ml-auto rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] text-[var(--fg-subtle)]">
                  {g.items.length} เคส
                </span>
              </div>

              <ul className="divide-y divide-[var(--border)]">
                {g.items.map((r) => {
                  const next = NEXT_ACTIONS.find((a) => a.from === r.status)
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: PRIORITY_TONE[r.priority] }}
                        title={REFERRAL_PRIORITY_LABEL[r.priority]}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-[var(--fg)]">{r.personName ?? 'ไม่ระบุชื่อ'}</span>
                          {r.priority !== 'normal' && r.priority !== 'low' && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `color-mix(in oklch, ${PRIORITY_TONE[r.priority]} 14%, transparent)`, color: PRIORITY_TONE[r.priority] }}>
                              {REFERRAL_PRIORITY_LABEL[r.priority]}
                            </span>
                          )}
                          <span className="gx-badge" style={{ color: STATUS_TONE[r.status], borderColor: `color-mix(in oklch, ${STATUS_TONE[r.status]} 35%, transparent)` }}>
                            <span className="gx-badge-dot" style={{ background: STATUS_TONE[r.status] }} />
                            {REFERRAL_STATUS_LABEL[r.status]}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--fg-subtle)]">
                          <span className="inline-flex items-center gap-1"><Tent size={11} /> {r.fromShelterName ?? '—'}</span>
                          <ArrowRight size={11} />
                          <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmt(r.referredAt)}</span>
                          {r.reason && <span className="text-[var(--fg-muted)]">· {r.reason}</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        {next && (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => setStatus(r.id, next.to)}
                            className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50"
                          >
                            {next.label}
                          </button>
                        )}
                        {ACTIVE_STATUSES.includes(r.status) && (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => setStatus(r.id, 'rejected')}
                            className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)] disabled:opacity-50"
                          >
                            ปฏิเสธ
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
