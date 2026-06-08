'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, Phone, MapPin, Users, Clock, Check, X as XIcon, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { requestTypeLabel, priorityLabel } from '@/lib/help-request-labels'
import { ShareReportLink } from './ShareReportLink'
import type { PublicHelpReport, HelpRequestPriority } from '@/types'

const PRIORITY_OPTIONS: { value: HelpRequestPriority; tone: string }[] = [
  { value: 'critical', tone: 'var(--risk-flood)' },
  { value: 'high', tone: 'var(--risk-flood)' },
  { value: 'normal', tone: 'var(--risk-near)' },
  { value: 'low', tone: 'var(--risk-safe)' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีก่อน`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ก่อน`
  return `${Math.floor(h / 24)} วันก่อน`
}

export function HelpReportsInbox({
  pending,
  recent,
  canReview,
}: {
  pending: PublicHelpReport[]
  recent: PublicHelpReport[]
  canReview: boolean
}) {
  const router = useRouter()
  const [showRecent, setShowRecent] = useState(false)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center gap-2">
        <span className="gx-icon-tile size-9 shrink-0" style={{ ['--tile' as string]: 'var(--risk-flood)' }}>
          <Inbox size={16} />
        </span>
        <div className="min-w-0">
          <p className="gx-eyebrow">รับแจ้งเหตุ · ประชาชน</p>
          <h1 className="gx-title text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)]">
            กล่องรอตรวจสอบคำร้อง
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {pending.length > 0 && (
            <span className="rounded-full bg-[var(--risk-flood)] px-2.5 py-1 text-sm font-bold text-white">
              {pending.length} รอตรวจ
            </span>
          )}
          <ShareReportLink />
        </div>
      </div>
      <p className="mb-5 text-sm text-[var(--fg-muted)]">
        คำร้องจากฟอร์มสาธารณะ <a href="/report" className="underline" target="_blank">/report</a> — ตรวจสอบความถูกต้อง กำหนดความเร่งด่วน แล้ว “รับเข้าคิว” เพื่อส่งต่อให้ <a href="/admin/eoc" className="underline">ศูนย์บัญชาการ EOC</a>
      </p>

      {!canReview && (
        <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--fg-muted)]">
          คุณมีสิทธิ์ดูอย่างเดียว — การรับเข้าคิว/ปฏิเสธทำได้โดยเจ้าหน้าที่ Triage
        </p>
      )}

      {/* ── pending ── */}
      {pending.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-8 text-sm text-[var(--fg-muted)]">
          <CheckCircle2 size={18} className="text-[var(--risk-safe)]" />
          ไม่มีคำร้องค้างตรวจสอบ — เคลียร์หมดแล้ว
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <ReportCard key={r.id} report={r} canReview={canReview} onDone={() => router.refresh()} />
          ))}
        </ul>
      )}

      {/* ── recent reviewed ── */}
      {recent.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowRecent((v) => !v)}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <ChevronDown size={15} className={`transition-transform ${showRecent ? 'rotate-180' : ''}`} />
            ประวัติที่ตรวจแล้ว ({recent.length})
          </button>
          {showRecent && (
            <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 text-sm last:border-b-0">
                  {r.status === 'approved' ? (
                    <CheckCircle2 size={16} className="shrink-0 text-[var(--risk-safe)]" />
                  ) : (
                    <XCircle size={16} className="shrink-0 text-[var(--fg-subtle)]" />
                  )}
                  <span className="font-medium text-[var(--fg)]">{requestTypeLabel[r.requestType]}</span>
                  <span className="truncate text-[var(--fg-muted)]">· {r.addressText || r.province || 'ไม่ระบุพื้นที่'}</span>
                  <span className="ml-auto shrink-0 text-xs text-[var(--fg-subtle)]">
                    {r.status === 'approved' ? 'รับเข้าคิว' : 'ปฏิเสธ'} · {timeAgo(r.reviewedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ReportCard({ report: r, canReview, onDone }: { report: PublicHelpReport; canReview: boolean; onDone: () => void }) {
  const [priority, setPriority] = useState<HelpRequestPriority>('normal')
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function act(action: 'approve' | 'reject') {
    setBusy(true)
    await fetch(`/api/public-reports/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'approve' ? { action, priority } : { action, note: note.trim() || null }),
    }).catch(() => {})
    setBusy(false)
    onDone()
  }

  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--risk-flood)]">
            {requestTypeLabel[r.requestType]}
          </span>
          {r.peopleCount != null && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]"><Users size={13} /> {r.peopleCount} คน</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--fg-subtle)]"><Clock size={13} /> {timeAgo(r.createdAt)}</span>
        </div>

        {r.description && <p className="mt-2 text-sm text-[var(--fg)]">{r.description}</p>}

        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--fg-muted)]">
          <a href={`tel:${r.reporterPhone}`} className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)] hover:underline">
            <Phone size={14} /> {r.reporterPhone}{r.reporterName ? ` · ${r.reporterName}` : ''}
          </a>
          {(r.addressText || r.province) && (
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {[r.addressText, r.province].filter(Boolean).join(' · ')}</span>
          )}
          {r.lat != null && r.lng != null && (
            <a
              href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <MapPin size={14} /> เปิดพิกัดในแผนที่
            </a>
          )}
        </div>
      </div>

      {canReview && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-sunken)] p-3">
          {!rejecting ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--fg-subtle)]">ความเร่งด่วน:</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${priority === p.value ? 'text-white' : 'bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
                    style={priority === p.value ? { background: p.tone } : undefined}
                  >
                    {priorityLabel[p.value]}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="gx-btn gx-btn-ghost gx-btn-sm text-[var(--risk-flood)] hover:!border-[var(--risk-flood)]">
                  <XIcon size={14} /> ปฏิเสธ
                </button>
                <button type="button" onClick={() => act('approve')} disabled={busy} className="gx-btn gx-btn-primary gx-btn-sm">
                  <Check size={14} /> {busy ? 'กำลังบันทึก...' : 'รับเข้าคิว'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เหตุผลที่ปฏิเสธ (ไม่บังคับ) — เช่น ข้อมูลซ้ำ / ติดต่อแล้วไม่ใช่เหตุจริง"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRejecting(false)} disabled={busy} className="gx-btn gx-btn-ghost gx-btn-sm">ยกเลิก</button>
                <button type="button" onClick={() => act('reject')} disabled={busy} className="gx-btn gx-btn-sm border-[var(--risk-flood)] bg-[var(--risk-flood)] text-white hover:opacity-90">
                  <XIcon size={14} /> {busy ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
