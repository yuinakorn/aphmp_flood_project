'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Tent, Plus, X, Search, UserPlus, Hospital,
  LogOut, AlertTriangle, ShieldAlert, Loader2,
} from 'lucide-react'
import type {
  AdmissionPerson, AdmissionStatus, RescueTeam, ShelterZone,
} from '@/types'
import { EditShelterButton } from './EditShelterButton'

interface ShelterMeta {
  id: string; name: string; type: string
  capacity: number | null; bedriddenCapacity: number | null
  oxygenSupport: boolean; wheelchairSupport: boolean; electricitySupport: boolean
  contact: string | null
  lat: number; lng: number
}

interface AdmissionRow {
  id: string
  status: AdmissionStatus
  zoneId: string | null
  zoneName: string | null
  intakePoint: string | null
  broughtByText: string | null
  broughtByTeamId: string | null
  exitReason: string | null
  exitDestination: string | null
  notes: string | null
  admittedAt: string
  dischargedAt: string | null
  person: AdmissionPerson | null
}

interface Props {
  shelter: ShelterMeta
  zones: ShelterZone[]
  teams: RescueTeam[]
  canEdit: boolean
}

const statusBadgeCls = (s: AdmissionStatus) =>
  s === 'admitted' ? 'gx-badge gx-badge-safe'
  : s === 'transferred' ? 'gx-badge gx-badge-near'
  : s === 'discharged' ? 'gx-badge'
  : 'gx-badge'
const statusLabel = (s: AdmissionStatus) =>
  s === 'admitted' ? 'พักอยู่' : s === 'transferred' ? 'ส่งต่อ รพ.' : s === 'discharged' ? 'ย้ายออก' : 'ยกเลิก'

export function ShelterDetail({ shelter, zones, teams, canEdit }: Props) {
  const [admissions, setAdmissions] = useState<AdmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeZoneId, setActiveZoneId] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'current' | 'all'>('current')
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<AdmissionRow | null>(null)

  async function loadAdmissions() {
    setLoading(true)
    const sp = new URLSearchParams()
    sp.set('status', statusFilter)
    if (activeZoneId !== 'all') sp.set('zoneId', activeZoneId)
    const res = await fetch(`/api/shelters/${shelter.id}/admissions?${sp}`).then((r) => r.json()).catch(() => ({ data: [] }))
    setAdmissions(res.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAdmissions() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [activeZoneId, statusFilter, shelter.id])

  const counts = useMemo(() => {
    const current = admissions.filter((a) => a.status === 'admitted').length
    const transferred = admissions.filter((a) => a.status === 'transferred').length
    const discharged = admissions.filter((a) => a.status === 'discharged').length
    return { total: admissions.length, current, transferred, discharged }
  }, [admissions])

  async function patchStatus(id: string, patch: Partial<AdmissionRow>) {
    await fetch(`/api/shelters/${shelter.id}/admissions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    loadAdmissions()
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/admin/shelters" className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft size={13} /> ย้อนกลับ
      </Link>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="gx-title flex items-center gap-2">
            <Tent size={22} strokeWidth={1.75} className="text-[var(--infra-shelter)]" />
            {shelter.name}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--fg-muted)]">
            <span>{shelter.type === 'assembly' ? 'จุดรวมพล' : 'ศูนย์อพยพ'}</span>
            {shelter.contact && <span>· {shelter.contact}</span>}
            {shelter.oxygenSupport && <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10px]">ออกซิเจน</span>}
            {shelter.wheelchairSupport && <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10px]">whc</span>}
            {shelter.electricitySupport && <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10px]">ไฟฟ้า</span>}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <EditShelterButton initial={shelter} />
            <button type="button" onClick={() => setIntakeOpen(true)} className="gx-btn gx-btn-primary">
              <Plus size={16} /> รับเข้าใหม่
            </button>
          </div>
        )}
      </div>

      {/* Status ribbon */}
      <div className="mt-3 flex flex-wrap items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {[
          { label: 'สะสมทั้งหมด', value: counts.total, tone: 'var(--fg)' },
          { label: 'พักอยู่ตอนนี้', value: counts.current, tone: 'var(--signal-data)' },
          { label: 'ส่งต่อ รพ.', value: counts.transferred, tone: 'var(--risk-near)' },
          { label: 'ย้ายออก', value: counts.discharged, tone: 'var(--fg-muted)' },
          { label: 'ความจุ', value: shelter.capacity ?? '—', tone: 'var(--fg)' },
          { label: 'โซน', value: zones.length, tone: 'var(--fg)' },
        ].map((s, i) => (
          <div key={s.label} className={`flex flex-col px-5 py-3 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">{s.label}</span>
            <span className="font-mono text-[26px] font-semibold leading-tight" style={{ color: s.tone }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters: zone segmented + status toggle */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-[var(--bg-sunken)] p-1 text-sm">
          <SegBtn active={activeZoneId === 'all'} onClick={() => setActiveZoneId('all')}>ทั้งหมด</SegBtn>
          {zones.map((z) => (
            <SegBtn key={z.id} active={activeZoneId === z.id} onClick={() => setActiveZoneId(z.id)}>{z.name}</SegBtn>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 text-xs">
          {(['current', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setStatusFilter(v)}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${statusFilter === v ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              {v === 'current' ? 'พักอยู่' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
      </div>

      {/* Worklist */}
      <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {loading && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]"><Loader2 className="mx-auto animate-spin" size={18} /></li>}
        {!loading && admissions.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-[var(--fg-subtle)]">
            ยังไม่มีผู้พักพิงในมุมมองนี้ — กด "รับเข้าใหม่" เพื่อบันทึก
          </li>
        )}
        {admissions.map((a) => {
          const p = a.person
          const hasAllergy = p?.foodAllergy || p?.drugAllergy
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: a.status === 'admitted' ? 'var(--risk-safe)' : a.status === 'transferred' ? 'var(--risk-near)' : 'var(--fg-subtle)' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--fg)]">{p?.name ?? '— ไม่ระบุชื่อ —'}</span>
                    {p?.isVulnerable && <span className="rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--risk-flood)]">เปราะบาง</span>}
                    {p?.age != null && <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age} ปี</span>}
                    {p?.sex && <span className="text-xs text-[var(--fg-subtle)]">· {p.sex}</span>}
                    {p?.nationality && p.nationality !== 'ไทย' && <span className="text-xs text-[var(--fg-subtle)]">· {p.nationality}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[var(--fg-muted)]">
                    {p?.nationalIdMasked && <span className="font-mono text-[var(--fg-subtle)]">{p.nationalIdMasked}</span>}
                    {p?.conditions && <span className="truncate">{p.conditions}</span>}
                    {a.zoneName && <span className="text-[var(--fg-subtle)]">· {a.zoneName}</span>}
                  </div>
                  {hasAllergy && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p?.drugAllergy && p.drugAllergy !== '-' && (
                        <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--risk-flood)]">
                          <ShieldAlert size={10} /> แพ้ยา: {p.drugAllergy}
                        </span>
                      )}
                      {p?.foodAllergy && p.foodAllergy !== '-' && (
                        <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_oklch,var(--risk-near)_12%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--risk-near)]">
                          <AlertTriangle size={10} /> แพ้อาหาร: {p.foodAllergy}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={statusBadgeCls(a.status)}><span className="gx-badge-dot" />{statusLabel(a.status)}</span>
                {a.status === 'transferred' && a.exitDestination && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--risk-near)]">
                    <Hospital size={11} /> {a.exitDestination}
                  </span>
                )}
                <span className="font-mono text-[10.5px] text-[var(--fg-subtle)]">
                  เข้า {fmt(a.admittedAt)}{a.dischargedAt && ` · ออก ${fmt(a.dischargedAt)}`}
                </span>
                {a.broughtByText && <span className="text-[10.5px] text-[var(--fg-subtle)]">นำส่ง: {a.broughtByText}</span>}
              </div>

              {canEdit && a.status === 'admitted' && (
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => setTransferTarget(a)} className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-near)] hover:!text-[var(--risk-near)]">
                    <Hospital size={14} /> ส่ง รพ.
                  </button>
                  <button type="button" onClick={() => patchStatus(a.id, { status: 'discharged', exitReason: 'moved_home' })} className="gx-btn gx-btn-ghost gx-btn-sm">
                    <LogOut size={14} /> ย้ายออก
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {intakeOpen && (
        <IntakeModal
          shelterId={shelter.id}
          zones={zones}
          teams={teams}
          onClose={() => setIntakeOpen(false)}
          onSaved={() => { setIntakeOpen(false); loadAdmissions() }}
        />
      )}

      {transferTarget && (
        <TransferModal
          admission={transferTarget}
          onClose={() => setTransferTarget(null)}
          onSaved={() => { setTransferTarget(null); loadAdmissions() }}
        />
      )}
    </div>
  )
}

interface FacilityOpt { id: string; name: string; type: string }

function TransferModal({ admission, onClose, onSaved }: { admission: AdmissionRow; onClose: () => void; onSaved: () => void }) {
  const [facilities, setFacilities] = useState<FacilityOpt[]>([])
  const [facilityId, setFacilityId] = useState('')
  const [facilityText, setFacilityText] = useState('')
  const [priority, setPriority] = useState('normal')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/infra?types=hospital,clinic')
      .then((r) => r.json())
      .then((j) => setFacilities((j.data ?? []).filter((f: FacilityOpt) => f.type === 'hospital' || f.type === 'clinic')))
      .catch(() => {})
  }, [])

  async function submit() {
    if (!facilityId && !facilityText.trim()) { setError('เลือกหรือพิมพ์โรงพยาบาลปลายทาง'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        admissionId: admission.id,
        toFacilityId: facilityId || undefined,
        toFacilityText: facilityId ? undefined : facilityText.trim() || undefined,
        priority,
        reason: reason.trim() || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? 'ส่งต่อไม่สำเร็จ'); return }
    onSaved()
  }

  const fieldCls = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Hospital size={18} className="text-[var(--risk-near)]" />
            <h2 className="text-base font-semibold">ส่งต่อโรงพยาบาล</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-sm text-[var(--fg-muted)]">
            ผู้ป่วย: <strong className="text-[var(--fg)]">{admission.person?.name ?? 'ไม่ระบุชื่อ'}</strong>
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">โรงพยาบาลปลายทาง</label>
            <select className={fieldCls} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              <option value="">— เลือกจากระบบ —</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}{f.type === 'clinic' ? ' (รพ.สต./คลินิก)' : ''}</option>)}
            </select>
            {!facilityId && (
              <input
                className={`${fieldCls} mt-2`}
                placeholder="หรือพิมพ์ชื่อ รพ. นอกระบบ"
                value={facilityText}
                onChange={(e) => setFacilityText(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">ความเร่งด่วน</label>
            <select className={fieldCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">ไม่เร่งด่วน</option>
              <option value="normal">ปกติ</option>
              <option value="high">เร่งด่วน</option>
              <option value="critical">วิกฤต</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">เหตุผล / อาการ</label>
            <textarea
              className="min-h-[64px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="เช่น หายใจลำบาก ต้องการออกซิเจน"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3">
          {error ? <span className="text-xs text-[var(--risk-flood)]">{error}</span> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="gx-btn gx-btn-ghost gx-btn-sm">ยกเลิก</button>
            <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Hospital size={14} />} ยืนยันส่งต่อ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function fmt(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${active ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
    >
      {children}
    </button>
  )
}

// ─── Intake Modal ───
interface IntakeModalProps {
  shelterId: string
  zones: ShelterZone[]
  teams: RescueTeam[]
  onClose: () => void
  onSaved: () => void
}

function IntakeModal({ shelterId, zones, teams, onClose, onSaved }: IntakeModalProps) {
  const [tab, setTab] = useState<'search' | 'walkin'>('search')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<AdmissionPerson[]>([])
  const [picked, setPicked] = useState<AdmissionPerson | null>(null)

  // walk-in fields
  const [prefix, setPrefix] = useState('นาย')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [nationality, setNationality] = useState('ไทย')
  const [sex, setSex] = useState('ชาย')
  const [age, setAge] = useState<string>('')
  const [phone, setPhone] = useState('')
  const [hno, setHno] = useState('')
  const [villno, setVillno] = useState('')
  const [tambon, setTambon] = useState('')
  const [conditions, setConditions] = useState('')
  const [foodAllergy, setFoodAllergy] = useState('')
  const [drugAllergy, setDrugAllergy] = useState('')

  // common
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id ?? '')
  const [broughtByTeamId, setBroughtByTeamId] = useState<string>('')
  const [broughtByText, setBroughtByText] = useState('')
  const [intakePoint, setIntakePoint] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== 'search' || query.trim().length < 3) { setResults([]); setPicked(null); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/household-members/search?q=${encodeURIComponent(query.trim())}`).then((r) => r.json()).catch(() => ({ data: [] }))
      const list = res.data ?? []
      setResults(list)
      // เจอคนเดียว (เช่น ค้นด้วยเลขบัตร 13 หลัก) → เลือกให้อัตโนมัติ
      setPicked(list.length === 1 ? list[0] : null)
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, tab])

  async function submit() {
    setSaving(true); setError(null)
    const body: Record<string, unknown> = {
      zoneId: zoneId || undefined,
      intakePoint: intakePoint || undefined,
      broughtByTeamId: broughtByTeamId || undefined,
      broughtByText: broughtByText || undefined,
      notes: notes || undefined,
    }
    if (picked?.id) {
      body.memberId = picked.id
    } else {
      if (!firstName.trim()) { setError('กรอกชื่ออย่างน้อย'); setSaving(false); return }
      body.person = {
        prefix, firstName, lastName,
        nationalId: nationalId || undefined,
        birthDate: birthDate || undefined,
        nationality, sex,
        age: age ? Number(age) : undefined,
        phone: phone || undefined,
        hno: hno || undefined, villno: villno || undefined, tambon: tambon || undefined,
        conditions: conditions || undefined,
        foodAllergy: foodAllergy || undefined,
        drugAllergy: drugAllergy || undefined,
      }
    }
    const res = await fetch(`/api/shelters/${shelterId}/admissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'บันทึกไม่สำเร็จ')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <UserPlus size={18} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold">รับเข้าใหม่</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
        </div>

        {/* Tab: search existing vs walk-in */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-sunken)]">
          <button type="button" onClick={() => { setTab('search'); setPicked(null) }} className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-medium ${tab === 'search' ? 'border-[var(--accent)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)]'}`}>
            ค้นจากทะเบียน
          </button>
          <button type="button" onClick={() => { setTab('walkin'); setPicked(null) }} className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-medium ${tab === 'walkin' ? 'border-[var(--accent)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)]'}`}>
            Walk-in (คนใหม่)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {tab === 'search' && (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="พิมพ์เลขบัตร 13 หลัก หรือชื่อ" className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]" />
              </div>
              {searching && <p className="text-center text-xs text-[var(--fg-subtle)]">กำลังค้น...</p>}
              {!searching && query.trim().length >= 3 && results.length === 0 && (
                <p className="text-center text-xs text-[var(--fg-subtle)]">ไม่พบในทะเบียน — สลับไปแท็บ Walk-in เพื่อเพิ่มใหม่</p>
              )}
              <ul className="space-y-1.5">
                {results.map((p) => (
                  <li key={p.id ?? p.name}>
                    <button type="button" onClick={() => setPicked(p)} className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${picked?.id === p.id ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'border-[var(--border)] hover:border-[var(--accent)]'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          {p.isVulnerable && <span className="rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--risk-flood)]">เปราะบาง</span>}
                          {p.age != null && <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age} ปี</span>}
                        </div>
                        <p className="font-mono text-xs text-[var(--fg-subtle)]">{p.nationalIdMasked ?? '—'}</p>
                        {p.conditions && <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{p.conditions}</p>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'walkin' && (
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
                {['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ชื่อ *" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="นามสกุล" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 13))} placeholder="เลขบัตร 13 หลัก" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 font-mono" />
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="อายุ" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 font-mono" />
              <select value={sex} onChange={(e) => setSex(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
                <option>ชาย</option><option>หญิง</option>
              </select>
              <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
                {['ไทย', 'พม่า', 'ลาว', 'กัมพูชา', 'ไร้สถานะ', 'อื่นๆ'].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={hno} onChange={(e) => setHno(e.target.value)} placeholder="บ้านเลขที่" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={villno} onChange={(e) => setVillno(e.target.value)} placeholder="หมู่ที่" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={tambon} onChange={(e) => setTambon(e.target.value)} placeholder="ตำบล" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="โรคประจำตัว" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={drugAllergy} onChange={(e) => setDrugAllergy(e.target.value)} placeholder="แพ้ยา" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={foodAllergy} onChange={(e) => setFoodAllergy(e.target.value)} placeholder="แพ้อาหาร" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
            </div>
          )}

          {/* Intake metadata (always shown) */}
          <div className="space-y-2 border-t border-[var(--border)] pt-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">รายละเอียดการรับเข้า</p>
            <div className="grid grid-cols-2 gap-2.5">
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
                <option value="">— ไม่ระบุโซน —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <input value={intakePoint} onChange={(e) => setIntakePoint(e.target.value)} placeholder="จุดรับเข้า (ถ้ามี)" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <select value={broughtByTeamId} onChange={(e) => { setBroughtByTeamId(e.target.value); if (e.target.value) setBroughtByText('') }} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
                <option value="">— เลือกทีมนำส่ง —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input value={broughtByText} onChange={(e) => { setBroughtByText(e.target.value); if (e.target.value) setBroughtByTeamId('') }} placeholder="หรือพิมพ์ชื่อหน่วย" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2" />
            </div>
          </div>

          {picked && (
            <div className="rounded-lg border border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-3 text-xs">
              จะรับเข้า: <strong>{picked.name}</strong> {picked.nationalIdMasked && <span className="font-mono text-[var(--fg-muted)]">({picked.nationalIdMasked})</span>}
              {picked.isVulnerable && <span className="ml-2 rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--risk-flood)]">เปราะบาง</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3">
          {error ? (
            <span className="text-xs text-[var(--risk-flood)]">{error}</span>
          ) : tab === 'search' && !picked ? (
            <span className="text-xs text-[var(--fg-subtle)]">เลือกรายชื่อจากผลการค้นหาก่อน</span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="gx-btn gx-btn-ghost gx-btn-sm">ยกเลิก</button>
            <button type="button" onClick={submit} disabled={saving || (tab === 'search' && !picked)} className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              บันทึกรับเข้า
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
