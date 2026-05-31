'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  HeartPulse,
  Anchor,
  Stethoscope,
  Home,
  Activity,
  Plus,
  X,
  Loader2,
  Trash2,
  ChevronDown,
  FileText,
} from 'lucide-react'
import {
  CASUALTY_TYPE_LABEL,
  CASUALTY_CAUSE_LABEL,
  SURVEILLANCE_DISEASE_LABEL,
} from '@/types'
import type {
  CasualtyType,
  CasualtyCause,
  IncidentCasualty,
  IncidentCounters,
  SurveillanceDiseaseCode,
  SurveillanceEntry,
} from '@/types'

interface Props {
  incidentId: string
  counters: IncidentCounters
  casualties: IncidentCasualty[]
  surveillanceEntries: SurveillanceEntry[]
  canCommand: boolean
}

type FormKey = 'casualty' | 'surveillance' | null

const inputCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const labelCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]'

export function OpsPanel({ incidentId, counters, casualties, surveillanceEntries, canCommand }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState<FormKey>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCasualtyList, setShowCasualtyList] = useState(false)
  const [showSurvList, setShowSurvList] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const c = counters

  async function submit(path: string, payload: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `บันทึกไม่สำเร็จ (${res.status})`)
      }
      setOpen(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  async function del(path: string, entryId: string) {
    if (!window.confirm('ลบรายการนี้?')) return
    setDeletingId(entryId)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/${path}/${entryId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `ลบไม่สำเร็จ (${res.status})`)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setDeletingId(null)
    }
  }

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '—'
  const area = (tambon?: string | null, amphoe?: string | null) =>
    [tambon && `ต.${tambon}`, amphoe && `อ.${amphoe}`].filter(Boolean).join(' ') || '—'

  return (
    <div className="space-y-4">
      {/* เปิดใบสรุปสถานการณ์ */}
      <Link
        href="/admin/eoc/sitrep"
        className="flex items-center gap-2.5 rounded-xl border border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] px-4 py-3 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[color-mix(in_oklch,var(--accent)_12%,transparent)]"
      >
        <FileText size={17} className="text-[var(--accent)]" />
        <span>เปิดใบสรุปสถานการณ์ (Sit Rep)</span>
        <span className="ml-auto text-xs text-[var(--fg-subtle)]">รวม auto + กรอกเอง · พิมพ์ได้</span>
      </Link>

      {/* ── Casualties ── */}
      <Group icon={<HeartPulse size={15} />} title="ผู้บาดเจ็บ / เสียชีวิต" tone="var(--risk-flood)">
        <Stat label="บาดเจ็บ" value={c.casualties.injured} />
        <Stat label="เสียชีวิต" value={c.casualties.dead} tone={c.casualties.dead > 0 ? 'var(--risk-flood)' : undefined} />
        <Stat label="สูญหาย" value={c.casualties.missing} tone={c.casualties.missing > 0 ? 'var(--risk-flood)' : undefined} />
        <Stat label="เจ็บป่วย" value={c.casualties.ill} />
      </Group>

      {casualties.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <button
            type="button"
            onClick={() => setShowCasualtyList((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5 text-left"
          >
            <ChevronDown size={15} className={`text-[var(--fg-subtle)] transition-transform ${showCasualtyList ? '' : '-rotate-90'}`} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
              ประวัติผู้ประสบเหตุ
            </span>
            <span className="ml-auto font-mono text-xs text-[var(--fg-subtle)]">{casualties.length} รายการ</span>
          </button>
          {showCasualtyList && (
            <ul className="divide-y divide-[var(--border)]">
              {casualties.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                    style={{
                      color: e.casualtyType === 'dead' || e.casualtyType === 'missing' ? 'var(--risk-flood)' : 'var(--risk-near)',
                      background: 'var(--bg-sunken)',
                    }}
                  >
                    {CASUALTY_TYPE_LABEL[e.casualtyType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-medium text-[var(--fg)]">{e.personName || 'ไม่ระบุชื่อ'}</span>
                      {e.age != null && <span className="font-mono text-xs text-[var(--fg-subtle)]">{e.age}</span>}
                      {e.cause && <span className="truncate text-xs text-[var(--fg-subtle)]">· {CASUALTY_CAUSE_LABEL[e.cause]}</span>}
                    </div>
                    <p className="truncate text-xs text-[var(--fg-subtle)]">{area(e.tambon, e.amphoe)} · {fmtDate(e.observedAt)}</p>
                  </div>
                  {canCommand && (
                    <button
                      type="button"
                      onClick={() => del('casualties', e.id)}
                      disabled={deletingId === e.id}
                      className="shrink-0 rounded p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--risk-flood)] disabled:opacity-50"
                      title="ลบ"
                    >
                      {deletingId === e.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Operations (derived) ── */}
      <Group icon={<Anchor size={15} />} title="ทีม & การส่งกำลัง" tone="var(--signal-data)">
        <Stat label="ทีมทั้งหมด" value={c.teams.total} />
        <Stat label="ออกปฏิบัติการ" value={c.teams.active} tone="var(--risk-safe)" />
        <Stat label="สแตนด์บาย" value={c.teams.standby} />
        <Stat label="มอบหมายค้าง" value={c.dispatches.open} tone={c.dispatches.open > 0 ? 'var(--risk-near)' : undefined} />
      </Group>

      <Group icon={<Stethoscope size={15} />} title="บริการ & คำร้อง" tone="var(--accent)">
        <Stat label="เยี่ยม/บริการ" value={c.services.visits} />
        <Stat label="เสร็จสิ้น" value={c.services.completed} tone="var(--risk-safe)" />
        <Stat label="คำร้องเปิด" value={c.requests.open} tone={c.requests.open > 0 ? 'var(--risk-flood)' : undefined} />
        <Stat label="คำร้องวิกฤต" value={c.requests.critical} tone={c.requests.critical > 0 ? 'var(--risk-flood)' : undefined} />
      </Group>

      <Group icon={<Home size={15} />} title="ศูนย์พักพิง" tone="var(--risk-near)">
        <Stat label="ศูนย์ที่ใช้" value={c.shelters.sheltersUsed} />
        <Stat label="พักอยู่ปัจจุบัน" value={c.shelters.current} tone="var(--risk-safe)" />
        <Stat label="สะสมทั้งหมด" value={c.shelters.cumulative} />
        <Stat label="ส่งต่อ รพ." value={c.shelters.toHospital} tone={c.shelters.toHospital > 0 ? 'var(--risk-flood)' : undefined} />
      </Group>

      {/* ── Surveillance ── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
          <Activity size={15} style={{ color: 'var(--signal-data)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
            โรคเฝ้าระวัง
          </span>
          <span className="ml-auto font-mono text-sm font-semibold text-[var(--fg)]">
            {c.surveillance.totalCases} ราย
          </span>
        </div>
        {c.surveillance.byDisease.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีบันทึกโรคเฝ้าระวัง</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {c.surveillance.byDisease.map((d) => (
              <li key={d.code} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-[var(--fg)]">{d.label}</span>
                <span className="font-mono font-semibold text-[var(--fg)]">{d.cases}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {surveillanceEntries.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <button
            type="button"
            onClick={() => setShowSurvList((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5 text-left"
          >
            <ChevronDown size={15} className={`text-[var(--fg-subtle)] transition-transform ${showSurvList ? '' : '-rotate-90'}`} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
              บันทึกโรคเฝ้าระวังรายรายการ
            </span>
            <span className="ml-auto font-mono text-xs text-[var(--fg-subtle)]">{surveillanceEntries.length} รายการ</span>
          </button>
          {showSurvList && (
            <ul className="divide-y divide-[var(--border)]">
              {surveillanceEntries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-medium text-[var(--fg)]">
                        {e.diseaseCode === 'other' && e.diseaseLabel ? e.diseaseLabel : SURVEILLANCE_DISEASE_LABEL[e.diseaseCode]}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[var(--fg)]">{e.caseCount} ราย</span>
                    </div>
                    <p className="truncate text-xs text-[var(--fg-subtle)]">{area(e.tambon, e.amphoe)} · {fmtDate(e.reportDate)}</p>
                  </div>
                  {canCommand && (
                    <button
                      type="button"
                      onClick={() => del('surveillance', e.id)}
                      disabled={deletingId === e.id}
                      className="shrink-0 rounded p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--risk-flood)] disabled:opacity-50"
                      title="ลบ"
                    >
                      {deletingId === e.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Entry actions ── */}
      {canCommand && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setOpen(open === 'casualty' ? null : 'casualty'); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:border-[var(--risk-flood)]"
          >
            <Plus size={14} /> บันทึกผู้บาดเจ็บ/เสียชีวิต
          </button>
          <button
            type="button"
            onClick={() => { setOpen(open === 'surveillance' ? null : 'surveillance'); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:border-[var(--signal-data)]"
          >
            <Plus size={14} /> บันทึกโรคเฝ้าระวัง
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_8%,transparent)] px-3 py-2 text-sm text-[var(--risk-flood)]">
          {error}
        </p>
      )}

      {open === 'casualty' && (
        <CasualtyForm saving={saving} onClose={() => setOpen(null)} onSubmit={(p) => submit('casualties', p)} />
      )}
      {open === 'surveillance' && (
        <SurveillanceForm saving={saving} onClose={() => setOpen(null)} onSubmit={(p) => submit('surveillance', p)} />
      )}
    </div>
  )
}

function Group({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode
  title: string
  tone: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
        <span style={{ color: tone }}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">{title}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">{children}</div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col border-b border-l border-[var(--border)] px-4 py-3 first:border-l-0 [&:nth-child(-n+4)]:border-b-0 sm:border-b-0">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--fg-subtle)]">{label}</span>
      <span className="font-mono text-[22px] font-semibold leading-tight" style={{ color: tone ?? 'var(--fg)' }}>
        {value}
      </span>
    </div>
  )
}

function FormShell({
  title,
  saving,
  onClose,
  onSave,
  children,
}: {
  title: string
  saving: boolean
  onClose: () => void
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave() }}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--fg)]">{title}</h3>
        <button type="button" onClick={onClose} className="rounded p-1 text-[var(--fg-subtle)] hover:text-[var(--fg)]">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />} บันทึก
        </button>
      </div>
    </form>
  )
}

function CasualtyForm({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}) {
  const [casualtyType, setCasualtyType] = useState<CasualtyType>('injured')
  const [personName, setPersonName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [cause, setCause] = useState<CasualtyCause | ''>('')
  const [tambon, setTambon] = useState('')
  const [amphoe, setAmphoe] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <FormShell
      title="บันทึกผู้บาดเจ็บ/เสียชีวิต"
      saving={saving}
      onClose={onClose}
      onSave={() =>
        onSubmit({
          casualtyType,
          personName: personName || undefined,
          age: age ? Number(age) : undefined,
          sex: sex || undefined,
          cause: cause || undefined,
          tambon: tambon || undefined,
          amphoe: amphoe || undefined,
          notes: notes || undefined,
        })
      }
    >
      <div>
        <label className={labelCls}>ประเภท *</label>
        <select className={inputCls} value={casualtyType} onChange={(e) => setCasualtyType(e.target.value as CasualtyType)}>
          {(Object.keys(CASUALTY_TYPE_LABEL) as CasualtyType[]).map((t) => (
            <option key={t} value={t}>{CASUALTY_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>สาเหตุ</label>
        <select className={inputCls} value={cause} onChange={(e) => setCause(e.target.value as CasualtyCause | '')}>
          <option value="">— ไม่ระบุ —</option>
          {(Object.keys(CASUALTY_CAUSE_LABEL) as CasualtyCause[]).map((t) => (
            <option key={t} value={t}>{CASUALTY_CAUSE_LABEL[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>ชื่อ-สกุล</label>
        <input className={inputCls} value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="ถ้าทราบ" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>อายุ</label>
          <input className={inputCls} type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>เพศ</label>
          <select className={inputCls} value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">—</option>
            <option value="ชาย">ชาย</option>
            <option value="หญิง">หญิง</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>ตำบล</label>
        <input className={inputCls} value={tambon} onChange={(e) => setTambon(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>อำเภอ</label>
        <input className={inputCls} value={amphoe} onChange={(e) => setAmphoe(e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>หมายเหตุ</label>
        <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </FormShell>
  )
}

function SurveillanceForm({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [diseaseCode, setDiseaseCode] = useState<SurveillanceDiseaseCode>('foot_immersion')
  const [diseaseLabel, setDiseaseLabel] = useState('')
  const [caseCount, setCaseCount] = useState('')
  const [reportDate, setReportDate] = useState(today)
  const [tambon, setTambon] = useState('')
  const [amphoe, setAmphoe] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <FormShell
      title="บันทึกโรคเฝ้าระวัง"
      saving={saving}
      onClose={onClose}
      onSave={() =>
        onSubmit({
          diseaseCode,
          diseaseLabel: diseaseCode === 'other' ? (diseaseLabel || undefined) : undefined,
          caseCount: caseCount ? Number(caseCount) : 0,
          reportDate,
          tambon: tambon || undefined,
          amphoe: amphoe || undefined,
          notes: notes || undefined,
        })
      }
    >
      <div>
        <label className={labelCls}>กลุ่มอาการ *</label>
        <select className={inputCls} value={diseaseCode} onChange={(e) => setDiseaseCode(e.target.value as SurveillanceDiseaseCode)}>
          {(Object.keys(SURVEILLANCE_DISEASE_LABEL) as SurveillanceDiseaseCode[]).map((t) => (
            <option key={t} value={t}>{SURVEILLANCE_DISEASE_LABEL[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>จำนวนราย *</label>
        <input className={inputCls} type="number" min={0} value={caseCount} onChange={(e) => setCaseCount(e.target.value)} required />
      </div>
      {diseaseCode === 'other' && (
        <div className="col-span-2">
          <label className={labelCls}>ระบุชื่อกลุ่มอาการ</label>
          <input className={inputCls} value={diseaseLabel} onChange={(e) => setDiseaseLabel(e.target.value)} />
        </div>
      )}
      <div>
        <label className={labelCls}>วันที่รายงาน *</label>
        <input className={inputCls} type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
      </div>
      <div />
      <div>
        <label className={labelCls}>ตำบล</label>
        <input className={inputCls} value={tambon} onChange={(e) => setTambon(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>อำเภอ</label>
        <input className={inputCls} value={amphoe} onChange={(e) => setAmphoe(e.target.value)} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>หมายเหตุ</label>
        <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </FormShell>
  )
}
