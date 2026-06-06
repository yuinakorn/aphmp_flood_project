'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Tent, Plus, X, Search, UserPlus, Hospital,
  LogOut, AlertTriangle, ShieldAlert, Loader2, FileDown, Pencil, Trash2,
  User, Phone, HeartPulse, ChevronRight,
} from 'lucide-react'
import type {
  AdmissionPerson, AdmissionStatus, AdmissionExitReason, RescueTeam, ShelterZone, ReferralStatus,
} from '@/types'
import { REFERRAL_STATUS_LABEL, DISCHARGE_REASONS, EXIT_REASON_LABEL, LIFE_SUPPORT_LABEL, VULNERABLE_TYPE_LABEL } from '@/types'
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
  referralStatus: ReferralStatus | null
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

// สีสถานะการส่งต่อปลายทาง — รับ/ยัง
const referralTone = (s: ReferralStatus): string =>
  s === 'admitted' ? 'var(--risk-safe)'
  : s === 'rejected' || s === 'cancelled' ? 'var(--risk-flood)'
  : s === 'pending' ? 'var(--risk-near)'
  : 'var(--signal-data)' // accepted | en_route | arrived

export function ShelterDetail({ shelter, zones, teams, canEdit }: Props) {
  const [admissions, setAdmissions] = useState<AdmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeZoneId, setActiveZoneId] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'current' | 'all'>('current')
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<AdmissionRow | null>(null)
  const [editTarget, setEditTarget] = useState<AdmissionRow | null>(null)
  const [detailTarget, setDetailTarget] = useState<AdmissionRow | null>(null)
  const [dischargeTarget, setDischargeTarget] = useState<AdmissionRow | null>(null)

  // ── ตัวกรองหลายมิติ (client-side) ──
  const [search, setSearch] = useState('')
  const [fSex, setFSex] = useState<'all' | 'ชาย' | 'หญิง'>('all')
  const [fAge, setFAge] = useState<'all' | 'child' | 'adult' | 'elderly'>('all')
  const [fType, setFType] = useState<'all' | string>('all') // ประเภทเปราะบาง (bedridden/elderly/…) — ครอบเปราะบาง/ทั่วไปในตัว
  const [fNat, setFNat] = useState<'all' | 'thai' | 'foreign'>('all')
  const [fHealth, setFHealth] = useState<'all' | 'chronic' | 'allergy'>('all')
  const [fLife, setFLife] = useState<'all' | 'any' | string>('all') // 'any' = มีพยุงชีพอะไรก็ได้ / หรือ code เฉพาะ
  const [fExit, setFExit] = useState<'all' | AdmissionExitReason>('all')
  const filtersActive = search.trim() !== '' || fSex !== 'all' || fAge !== 'all' || fType !== 'all' || fNat !== 'all' || fHealth !== 'all' || fLife !== 'all' || fExit !== 'all'
  function clearFilters() {
    setSearch(''); setFSex('all'); setFAge('all'); setFType('all'); setFNat('all'); setFHealth('all'); setFLife('all'); setFExit('all')
  }

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return admissions.filter((a) => {
      const p = a.person
      if (q) {
        const hay = [p?.name, p?.nationalIdMasked, p?.conditions, p?.phone].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fSex !== 'all' && p?.sex !== fSex) return false
      if (fAge !== 'all') {
        const age = p?.age ?? -1
        if (fAge === 'child' && !(age >= 0 && age <= 12)) return false
        if (fAge === 'adult' && !(age >= 13 && age <= 59)) return false
        if (fAge === 'elderly' && !(age >= 60)) return false
      }
      if (fType !== 'all' && p?.vulnerableType !== fType) return false
      if (fNat === 'thai' && p?.nationality !== 'ไทย') return false
      if (fNat === 'foreign' && (!p?.nationality || p.nationality === 'ไทย')) return false
      if (fHealth === 'chronic' && !(p?.conditions && p.conditions !== '-')) return false
      if (fHealth === 'allergy' && !((p?.drugAllergy && p.drugAllergy !== '-') || (p?.foodAllergy && p.foodAllergy !== '-'))) return false
      if (fLife === 'any' && !(p?.lifeSupport && p.lifeSupport.length > 0)) return false
      if (fLife !== 'all' && fLife !== 'any' && !p?.lifeSupport?.includes(fLife)) return false
      if (fExit !== 'all' && a.exitReason !== fExit) return false
      return true
    })
  }, [admissions, search, fSex, fAge, fType, fNat, fHealth, fLife, fExit])

  async function patchStatus(id: string, patch: Partial<AdmissionRow>) {
    await fetch(`/api/shelters/${shelter.id}/admissions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    loadAdmissions()
  }

  async function deleteAdmission(id: string, name: string) {
    if (!confirm(`ลบรายการ "${name}" ออกจากระบบถาวร?\n\nใช้เฉพาะกรณีกรอกข้อมูลผิดพลาด`)) return
    await fetch(`/api/shelters/${shelter.id}/admissions/${id}`, { method: 'DELETE' })
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
        <div className="flex gap-2">
          <a
            href={`/api/eoc/roster/export?shelterId=${shelter.id}&status=${statusFilter}`}
            download
            className="gx-btn gx-btn-ghost"
          >
            <FileDown size={15} strokeWidth={1.75} /> ส่งออก .xlsx
          </a>
          {canEdit && <EditShelterButton initial={shelter} />}
          {canEdit && (
            <button type="button" onClick={() => setIntakeOpen(true)} className="gx-btn gx-btn-primary">
              <Plus size={16} /> รับเข้าใหม่
            </button>
          )}
        </div>
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

      {/* ตัวกรองหลายมิติตามข้อมูลผู้พักพิง */}
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นชื่อ / เลขบัตร / โรค / เบอร์"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <FilterSelect label="เพศ" value={fSex} onChange={(v) => setFSex(v as typeof fSex)} options={[['all', 'เพศ: ทั้งหมด'], ['ชาย', 'ชาย'], ['หญิง', 'หญิง']]} />
          <FilterSelect label="อายุ" value={fAge} onChange={(v) => setFAge(v as typeof fAge)} options={[['all', 'อายุ: ทั้งหมด'], ['child', 'เด็ก (0–12)'], ['adult', 'ผู้ใหญ่ (13–59)'], ['elderly', 'ผู้สูงอายุ (60+)']]} />
          <FilterSelect label="ประเภทเปราะบาง" value={fType} onChange={setFType} options={[['all', 'ประเภท: ทั้งหมด'], ...Object.entries(VULNERABLE_TYPE_LABEL).map(([code, label]) => [code, label] as [string, string])]} />
          <FilterSelect label="สัญชาติ" value={fNat} onChange={(v) => setFNat(v as typeof fNat)} options={[['all', 'สัญชาติ: ทั้งหมด'], ['thai', 'ไทย'], ['foreign', 'ต่างด้าว']]} />
          <FilterSelect label="สุขภาพ" value={fHealth} onChange={(v) => setFHealth(v as typeof fHealth)} options={[['all', 'สุขภาพ: ทั้งหมด'], ['chronic', 'มีโรคประจำตัว'], ['allergy', 'มีประวัติแพ้ยา/อาหาร']]} />
          <FilterSelect label="อุปกรณ์พยุงชีพ" value={fLife} onChange={setFLife} options={[['all', 'พยุงชีพ: ทั้งหมด'], ['any', 'มีอุปกรณ์พยุงชีพ'], ...Object.entries(LIFE_SUPPORT_LABEL).map(([code, label]) => [code, label] as [string, string])]} />
          {statusFilter === 'all' && (
            <FilterSelect label="ย้ายออก" value={fExit} onChange={(v) => setFExit(v as typeof fExit)} options={[['all', 'เหตุย้ายออก: ทั้งหมด'], ...DISCHARGE_REASONS.map((r) => [r.code, r.label] as [string, string])]} />
          )}
        </div>
        {(filtersActive || filtered.length !== admissions.length) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <span>พบ <span className="font-semibold text-[var(--fg)]">{filtered.length}</span> / {admissions.length} ราย</span>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[var(--accent)] hover:bg-[var(--bg-sunken)]">
                <X size={12} /> ล้างตัวกรอง
              </button>
            )}
          </div>
        )}
      </div>

      {/* Worklist */}
      <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {loading && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]"><Loader2 className="mx-auto animate-spin" size={18} /></li>}
        {!loading && admissions.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-[var(--fg-subtle)]">
            ยังไม่มีผู้พักพิงในมุมมองนี้ — กด "รับเข้าใหม่" เพื่อบันทึก
          </li>
        )}
        {!loading && admissions.length > 0 && filtered.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-[var(--fg-subtle)]">
            ไม่พบผู้พักพิงที่ตรงกับตัวกรอง — ลองล้างตัวกรอง
          </li>
        )}
        {filtered.map((a) => {
          const p = a.person
          const hasAllergy = p?.foodAllergy || p?.drugAllergy
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0 cursor-pointer hover:bg-[var(--bg-sunken)]"
              onClick={() => setDetailTarget(a)}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: a.status === 'admitted' ? 'var(--risk-safe)' : a.status === 'transferred' ? 'var(--risk-near)' : 'var(--fg-subtle)' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--fg)]">
                      {p?.name ?? '— ไม่ระบุชื่อ —'}
                    </span>
                    {p?.isVulnerable && <span className="rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--risk-flood)]">{(p.vulnerableType && VULNERABLE_TYPE_LABEL[p.vulnerableType as keyof typeof VULNERABLE_TYPE_LABEL]) || p.vulnerableLabel || 'เปราะบาง'}</span>}
                    {p?.age != null && <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age} ปี</span>}
                    {p?.sex && <span className="text-xs text-[var(--fg-subtle)]">· {p.sex}</span>}
                    {p?.nationality && p.nationality !== 'ไทย' && <span className="text-xs text-[var(--fg-subtle)]">· {p.nationality}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[var(--fg-muted)]">
                    {p?.nationalIdMasked && <span className="font-mono text-[var(--fg-subtle)]">{p.nationalIdMasked}</span>}
                    {p?.conditions && <span className="truncate">{p.conditions}</span>}
                    {a.zoneName && <span className="text-[var(--fg-subtle)]">· {a.zoneName}</span>}
                  </div>
                  {(hasAllergy || (p?.lifeSupport && p.lifeSupport.length > 0)) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p?.lifeSupport?.map((ls) => (
                        <span key={ls} className="inline-flex items-center gap-1 rounded bg-[color-mix(in_oklch,var(--risk-flood)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--risk-flood)]">
                          <HeartPulse size={10} /> {LIFE_SUPPORT_LABEL[ls] ?? ls}
                        </span>
                      ))}
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
                {a.status === 'discharged' && a.exitReason && (
                  <span className="text-[11px] text-[var(--fg-muted)]">
                    {EXIT_REASON_LABEL[a.exitReason as AdmissionExitReason] ?? a.exitReason}
                    {a.exitDestination ? ` · ${a.exitDestination}` : ''}
                  </span>
                )}
                {a.status === 'transferred' && a.exitDestination && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--risk-near)]">
                    <Hospital size={11} /> {a.exitDestination}
                  </span>
                )}
                {a.status === 'transferred' && a.referralStatus && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `color-mix(in oklch, ${referralTone(a.referralStatus)} 14%, transparent)`,
                      color: referralTone(a.referralStatus),
                    }}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: referralTone(a.referralStatus) }} />
                    {REFERRAL_STATUS_LABEL[a.referralStatus]}
                  </span>
                )}
                <span className="font-mono text-[10.5px] text-[var(--fg-subtle)]">
                  เข้า {fmt(a.admittedAt)}{a.dischargedAt && ` · ออก ${fmt(a.dischargedAt)}`}
                </span>
                {a.broughtByText && <span className="text-[10.5px] text-[var(--fg-subtle)]">นำส่ง: {a.broughtByText}</span>}
              </div>

              {canEdit && (
                <div className="hidden shrink-0 gap-1.5 sm:flex" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => setEditTarget(a)} title="แก้ไข" className="gx-btn gx-btn-ghost gx-btn-sm">
                    <Pencil size={14} /> แก้ไข
                  </button>
                  {a.status === 'admitted' && (
                    <>
                      <button type="button" onClick={() => setTransferTarget(a)} title="ส่ง รพ." className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-near)] hover:!text-[var(--risk-near)]">
                        <Hospital size={14} /> ส่ง รพ.
                      </button>
                      <button type="button" onClick={() => setDischargeTarget(a)} title="ย้ายออก" className="gx-btn gx-btn-ghost gx-btn-sm">
                        <LogOut size={14} /> ย้ายออก
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteAdmission(a.id, a.person?.name ?? 'รายการนี้')}
                    className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]"
                    title="ลบรายการ (กรณีกรอกผิด)"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              {/* มือถือ: ไม่โชว์ปุ่มในแถว — แตะแถวเพื่อเปิดรายละเอียด + action */}
              <ChevronRight size={16} className="shrink-0 text-[var(--fg-subtle)] sm:hidden" />
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

      {detailTarget && (
        <PersonDetailSheet
          admission={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={canEdit ? () => { setDetailTarget(null); setEditTarget(detailTarget) } : undefined}
          onTransfer={canEdit ? () => { setDetailTarget(null); setTransferTarget(detailTarget) } : undefined}
          onDischarge={canEdit ? () => { setDetailTarget(null); setDischargeTarget(detailTarget) } : undefined}
          onDelete={canEdit ? () => { setDetailTarget(null); deleteAdmission(detailTarget.id, detailTarget.person?.name ?? 'รายการนี้') } : undefined}
        />
      )}

      {editTarget && (
        <EditAdmissionModal
          shelterId={shelter.id}
          admission={editTarget}
          zones={zones}
          teams={teams}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadAdmissions() }}
        />
      )}

      {dischargeTarget && (
        <DischargeModal
          shelterId={shelter.id}
          admission={dischargeTarget}
          onClose={() => setDischargeTarget(null)}
          onSaved={() => { setDischargeTarget(null); loadAdmissions() }}
        />
      )}
    </div>
  )
}

// ─── Discharge Modal (เลือกเหตุผลย้ายออก — เก็บเป็นประวัติ) ───
function DischargeModal({
  shelterId,
  admission,
  onClose,
  onSaved,
}: {
  shelterId: string
  admission: AdmissionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState<string>(DISCHARGE_REASONS[0].code)
  const [destination, setDestination] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // เหตุผลที่ควรระบุปลายทาง (ญาติ/ศูนย์อื่น)
  const needsDestination = reason === 'moved_relative' || reason === 'transferred_shelter'

  async function submit() {
    setSaving(true); setError(null)
    const res = await fetch(`/api/shelters/${shelterId}/admissions/${admission.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'discharged',
        exitReason: reason,
        exitDestination: destination.trim() || undefined,
        notes: note.trim() || undefined,
      }),
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
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogOut size={16} className="shrink-0 text-[var(--accent)]" />
            <h2 className="truncate text-base font-semibold">ย้ายออก — {admission.person?.name ?? 'ไม่ระบุชื่อ'}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">เหตุผลการย้ายออก *</label>
            <div className="grid grid-cols-1 gap-1.5">
              {DISCHARGE_REASONS.map((r) => (
                <label
                  key={r.code}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    reason === r.code ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'border-[var(--border)] hover:border-[var(--accent)]'
                  }`}
                >
                  <input type="radio" name="discharge-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} className="accent-[var(--accent)]" />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {needsDestination && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ปลายทาง</label>
              <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={reason === 'transferred_shelter' ? 'ชื่อศูนย์พักพิงปลายทาง' : 'บ้านญาติ/สถานที่'} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="บันทึกเพิ่มเติม (ถ้ามี)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </div>

          {error && <p className="text-sm text-[var(--risk-flood)]">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button type="button" onClick={onClose} className="gx-btn gx-btn-ghost gx-btn-sm">ยกเลิก</button>
          <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} ยืนยันย้ายออก
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Person Detail Sheet ───
function PersonDetailSheet({
  admission,
  onClose,
  onEdit,
  onTransfer,
  onDischarge,
  onDelete,
}: {
  admission: AdmissionRow
  onClose: () => void
  onEdit?: () => void
  onTransfer?: () => void
  onDischarge?: () => void
  onDelete?: () => void
}) {
  const p = admission.person
  const isAdmitted = admission.status === 'admitted'
  const hasActions = !!(onTransfer || onDischarge || onDelete)

  const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
    value ? (
      <div className="flex items-start gap-2 py-1.5 text-sm">
        <span className="w-28 shrink-0 text-xs text-[var(--fg-subtle)]">{label}</span>
        <span className="flex-1 text-[var(--fg)]">{value}</span>
      </div>
    ) : null

  const address = [
    p?.hno && `เลขที่ ${p.hno}`,
    p?.villno && `ม.${p.villno}`,
    p?.tambon && `ต.${p.tambon}`,
    p?.amphoe && `อ.${p.amphoe}`,
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <User size={16} className="shrink-0 text-[var(--accent)]" />
            <h2 className="truncate text-base font-semibold">{p?.name ?? 'ไม่ระบุชื่อ'}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="gx-btn gx-btn-ghost gx-btn-sm"
              >
                <Pencil size={13} /> แก้ไข
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {/* สถานะ admission */}
          <section className="px-5 py-4">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">สถานะการพักพิง</p>
            <div className="space-y-0.5">
              <Row label="สถานะ" value={admission.status === 'admitted' ? 'พักอยู่' : admission.status === 'transferred' ? 'ส่งต่อ รพ.' : admission.status === 'discharged' ? 'ย้ายออก' : 'ยกเลิก'} />
              <Row label="โซน/อาคาร" value={admission.zoneName} />
              <Row label="เข้าพักเมื่อ" value={fmt(admission.admittedAt)} />
              {admission.dischargedAt && <Row label="ย้ายออกเมื่อ" value={fmt(admission.dischargedAt)} />}
              {admission.status === 'discharged' && admission.exitReason && (
                <Row label="เหตุผลย้ายออก" value={EXIT_REASON_LABEL[admission.exitReason as AdmissionExitReason] ?? admission.exitReason} />
              )}
              <Row label="นำส่งโดย" value={admission.broughtByText} />
              {admission.exitDestination && <Row label={admission.status === 'transferred' ? 'ปลายทาง รพ.' : 'ปลายทาง'} value={admission.exitDestination} />}
              <Row label="หมายเหตุ" value={admission.notes} />
            </div>
          </section>

          {/* ข้อมูลส่วนตัว */}
          <section className="px-5 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              <User size={11} /> ข้อมูลส่วนตัว
            </p>
            <div className="space-y-0.5">
              <Row label="ชื่อ-สกุล" value={p?.name} />
              <Row label="เลขบัตร" value={p?.nationalIdMasked} />
              <Row label="วันเกิด" value={p?.birthDate ? new Date(p.birthDate).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : null} />
              <Row label="อายุ" value={p?.age != null ? `${p.age} ปี` : null} />
              <Row label="เพศ" value={p?.sex} />
              <Row label="สัญชาติ" value={p?.nationality} />
            </div>
          </section>

          {/* ติดต่อและที่อยู่ */}
          <section className="px-5 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              <Phone size={11} /> ติดต่อ / ที่อยู่
            </p>
            <div className="space-y-0.5">
              {p?.phone ? (
                <div className="flex items-center gap-2 py-1.5">
                  <span className="w-28 shrink-0 text-xs text-[var(--fg-subtle)]">โทรศัพท์</span>
                  <a href={`tel:${p.phone}`} className="font-mono text-sm text-[var(--accent)] hover:underline">{p.phone}</a>
                </div>
              ) : null}
              {address && (
                <div className="flex items-start gap-2 py-1.5">
                  <span className="w-28 shrink-0 text-xs text-[var(--fg-subtle)]">ที่อยู่</span>
                  <span className="flex-1 text-sm text-[var(--fg)]">{address}</span>
                </div>
              )}
            </div>
          </section>

          {/* ข้อมูลสุขภาพ */}
          <section className="px-5 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
              <HeartPulse size={11} /> ข้อมูลสุขภาพ
            </p>
            {!p?.conditions && !p?.drugAllergy && !p?.foodAllergy && !p?.equipment && !(p?.lifeSupport && p.lifeSupport.length) ? (
              <p className="text-xs text-[var(--fg-subtle)]">ไม่มีข้อมูลสุขภาพที่บันทึกไว้</p>
            ) : (
              <div className="space-y-1.5">
                {p?.lifeSupport && p.lifeSupport.length > 0 && (
                  <div className="rounded-lg bg-[color-mix(in_oklch,var(--risk-flood)_8%,transparent)] px-3 py-2 text-sm">
                    <span className="mb-1 block text-[10.5px] font-medium text-[var(--risk-flood)]">อุปกรณ์พยุงชีพ</span>
                    <div className="flex flex-wrap gap-1">
                      {p.lifeSupport.map((ls) => (
                        <span key={ls} className="inline-flex items-center gap-1 rounded bg-[color-mix(in_oklch,var(--risk-flood)_16%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--risk-flood)]">
                          <HeartPulse size={10} /> {LIFE_SUPPORT_LABEL[ls] ?? ls}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p?.equipment && p.equipment !== '-' && (
                  <div className="rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-sm">
                    <span className="block text-[10.5px] font-medium text-[var(--fg-subtle)]">อุปกรณ์/เครื่องมือ</span>
                    <span className="text-[var(--fg)]">{p.equipment}</span>
                  </div>
                )}
                {p?.conditions && (
                  <div className="rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-sm">
                    <span className="block text-[10.5px] font-medium text-[var(--fg-subtle)]">โรคประจำตัว</span>
                    <span className="text-[var(--fg)]">{p.conditions}</span>
                  </div>
                )}
                {p?.drugAllergy && p.drugAllergy !== '-' && (
                  <div className="rounded-lg bg-[color-mix(in_oklch,var(--risk-flood)_8%,transparent)] px-3 py-2 text-sm">
                    <span className="block text-[10.5px] font-medium text-[var(--risk-flood)]">แพ้ยา</span>
                    <span className="text-[var(--fg)]">{p.drugAllergy}</span>
                  </div>
                )}
                {p?.foodAllergy && p.foodAllergy !== '-' && (
                  <div className="rounded-lg bg-[color-mix(in_oklch,var(--risk-near)_10%,transparent)] px-3 py-2 text-sm">
                    <span className="block text-[10.5px] font-medium text-[var(--risk-near)]">แพ้อาหาร</span>
                    <span className="text-[var(--fg)]">{p.foodAllergy}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* แท็ก */}
          {p?.isVulnerable && (
            <section className="px-5 py-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-3 py-1 text-xs font-medium text-[var(--risk-flood)]">
                <ShieldAlert size={12} /> กลุ่มเปราะบาง
              </span>
            </section>
          )}
        </div>

        {/* Footer actions — แหล่งรวม action บนมือถือ (แถวซ่อนปุ่มไว้) */}
        {hasActions && (
          <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3">
            {isAdmitted && onTransfer && (
              <button type="button" onClick={onTransfer} className="gx-btn gx-btn-ghost gx-btn-sm flex-1 hover:!border-[var(--risk-near)] hover:!text-[var(--risk-near)]">
                <Hospital size={14} /> ส่ง รพ.
              </button>
            )}
            {isAdmitted && onDischarge && (
              <button type="button" onClick={onDischarge} className="gx-btn gx-btn-ghost gx-btn-sm flex-1">
                <LogOut size={14} /> ย้ายออก
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete} title="ลบรายการ" className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Edit Admission Modal ───
interface EditAdmissionModalProps {
  shelterId: string
  admission: AdmissionRow
  zones: ShelterZone[]
  teams: RescueTeam[]
  onClose: () => void
  onSaved: () => void
}

function EditAdmissionModal({ shelterId, admission, zones, teams, onClose, onSaved }: EditAdmissionModalProps) {
  const p = admission.person

  // person fields
  const [prefix, setPrefix] = useState(p?.prefix ?? 'นาย')
  const [firstName, setFirstName] = useState(p?.firstName ?? '')
  const [lastName, setLastName] = useState(p?.lastName ?? '')
  const [birthDate, setBirthDate] = useState(p?.birthDate ?? '')
  const [age, setAge] = useState(p?.age != null ? String(p.age) : '')
  const [sex, setSex] = useState(p?.sex ?? 'ชาย')
  const [nationality, setNationality] = useState(p?.nationality ?? 'ไทย')
  const [phone, setPhone] = useState(p?.phone ?? '')
  const [hno, setHno] = useState(p?.hno ?? '')
  const [villno, setVillno] = useState(p?.villno ?? '')
  const [tambon, setTambon] = useState(p?.tambon ?? '')
  const [amphoe, setAmphoe] = useState(p?.amphoe ?? '')
  const [conditions, setConditions] = useState(p?.conditions ?? '')
  const [drugAllergy, setDrugAllergy] = useState(p?.drugAllergy ?? '')
  const [foodAllergy, setFoodAllergy] = useState(p?.foodAllergy ?? '')

  // admission fields
  const [zoneId, setZoneId] = useState(admission.zoneId ?? '')
  const [intakePoint, setIntakePoint] = useState(admission.intakePoint ?? '')
  const [broughtByTeamId, setBroughtByTeamId] = useState(admission.broughtByTeamId ?? '')
  const [broughtByText, setBroughtByText] = useState(admission.broughtByText ?? '')
  const [notes, setNotes] = useState(admission.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!firstName.trim()) { setError('กรอกชื่ออย่างน้อย'); return }
    setSaving(true); setError(null)

    const admPatch = {
      zoneId: zoneId || undefined,
      intakePoint: intakePoint || undefined,
      broughtByTeamId: broughtByTeamId || null,
      broughtByText: broughtByTeamId ? '' : broughtByText,
      notes: notes || undefined,
    }
    const personPatch = {
      prefix, firstName: firstName.trim(), lastName: lastName.trim(),
      birthDate: birthDate || null,
      age: age ? Number(age) : null,
      sex, nationality, phone,
      hno, villno, tambon, amphoe,
      conditions, drugAllergy, foodAllergy,
    }

    const requests: Promise<Response>[] = [
      fetch(`/api/shelters/${shelterId}/admissions/${admission.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(admPatch),
      }),
    ]
    if (p?.id) {
      requests.push(
        fetch(`/api/household-members/${p.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(personPatch),
        })
      )
    }

    const results = await Promise.all(requests)
    setSaving(false)
    const failed = results.find((r) => !r.ok)
    if (failed) {
      const j = await failed.json().catch(() => ({}))
      setError(j.error ?? 'บันทึกไม่สำเร็จ')
      return
    }
    onSaved()
  }

  const F = 'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]'
  const L = 'mb-1 block text-xs font-medium text-[var(--fg-muted)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Pencil size={16} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold">แก้ไขข้อมูลผู้พักพิง</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {/* ── ข้อมูลบุคคล ── */}
          <section className="p-5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ข้อมูลบุคคล</p>
            <div className="grid grid-cols-6 gap-2.5">
              <div className="col-span-2">
                <label className={L}>คำนำหน้า</label>
                <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className={F}>
                  {['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.'].map((pr) => <option key={pr}>{pr}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={L}>ชื่อ *</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ชื่อ" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>นามสกุล</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="นามสกุล" className={F} />
              </div>

              <div className="col-span-2">
                <label className={L}>วันเกิด</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>อายุ (ปี)</label>
                <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="อายุ" className={`${F} font-mono`} />
              </div>
              <div className="col-span-1">
                <label className={L}>เพศ</label>
                <select value={sex} onChange={(e) => setSex(e.target.value)} className={F}>
                  <option>ชาย</option><option>หญิง</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className={L}>สัญชาติ</label>
                <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={F}>
                  {['ไทย', 'พม่า', 'ลาว', 'กัมพูชา', 'ไร้สถานะ', 'อื่นๆ'].map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>

              <div className="col-span-3">
                <label className={L}>เบอร์โทรศัพท์</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร" className={F} />
              </div>
              <div className="col-span-3">
                <label className={L}>ที่อยู่ เลขที่บ้าน</label>
                <input value={hno} onChange={(e) => setHno(e.target.value)} placeholder="เลขที่" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>หมู่ที่</label>
                <input value={villno} onChange={(e) => setVillno(e.target.value)} placeholder="หมู่" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>ตำบล</label>
                <input value={tambon} onChange={(e) => setTambon(e.target.value)} placeholder="ตำบล" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>อำเภอ</label>
                <input value={amphoe} onChange={(e) => setAmphoe(e.target.value)} placeholder="อำเภอ" className={F} />
              </div>
            </div>
          </section>

          {/* ── ข้อมูลสุขภาพ ── */}
          <section className="p-5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ข้อมูลสุขภาพ</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className={L}>โรคประจำตัว</label>
                <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="เช่น เบาหวาน ความดัน หัวใจ" className={F} />
              </div>
              <div>
                <label className={L}>แพ้ยา</label>
                <input value={drugAllergy} onChange={(e) => setDrugAllergy(e.target.value)} placeholder="ระบุยาที่แพ้" className={F} />
              </div>
              <div>
                <label className={L}>แพ้อาหาร</label>
                <input value={foodAllergy} onChange={(e) => setFoodAllergy(e.target.value)} placeholder="ระบุอาหารที่แพ้" className={F} />
              </div>
            </div>
          </section>

          {/* ── รายละเอียดการพักอาศัย ── */}
          <section className="p-5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">รายละเอียดการพักอาศัย</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={L}>โซน/อาคาร</label>
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={F}>
                  <option value="">— ไม่ระบุโซน —</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label className={L}>จุดรับเข้า (Admit)</label>
                <input value={intakePoint} onChange={(e) => setIntakePoint(e.target.value)} placeholder="จุด Admit" className={F} />
              </div>
              <div>
                <label className={L}>ทีม/หน่วยนำส่ง</label>
                <select value={broughtByTeamId} onChange={(e) => { setBroughtByTeamId(e.target.value); if (e.target.value) setBroughtByText('') }} className={F}>
                  <option value="">— เลือกทีม —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className={L}>หน่วยนำส่ง (พิมพ์เอง)</label>
                <input value={broughtByText} onChange={(e) => { setBroughtByText(e.target.value); if (e.target.value) setBroughtByTeamId('') }} placeholder="หน่วยนอกทะเบียน" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>หมายเหตุ</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม"
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3">
          {error ? <span className="text-xs text-[var(--risk-flood)]">{error}</span> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="gx-btn gx-btn-ghost gx-btn-sm">ยกเลิก</button>
            <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} บันทึก
            </button>
          </div>
        </div>
      </div>
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

/** dropdown ตัวกรองแบบกะทัดรัด — ไฮไลต์เมื่อเลือกค่าที่ไม่ใช่ 'all' */
function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  label: string
}) {
  const active = value !== 'all'
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus:border-[var(--accent)] ${
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-[var(--fg)]'
          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]'
      }`}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
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

  // health fields สำหรับ search tab (pre-fill จาก picked, แก้ไขได้ก่อน admit)
  const [pickedPhone, setPickedPhone] = useState('')
  const [pickedConditions, setPickedConditions] = useState('')
  const [pickedDrugAllergy, setPickedDrugAllergy] = useState('')
  const [pickedFoodAllergy, setPickedFoodAllergy] = useState('')

  // walk-in fields
  const [prefix, setPrefix] = useState('นาย')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [nationality, setNationality] = useState('ไทย')
  const [sex, setSex] = useState('ชาย')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('')
  const [hno, setHno] = useState('')
  const [villno, setVillno] = useState('')
  const [tambon, setTambon] = useState('')
  const [amphoe, setAmphoe] = useState('')
  const [conditions, setConditions] = useState('')
  const [foodAllergy, setFoodAllergy] = useState('')
  const [drugAllergy, setDrugAllergy] = useState('')

  // common (admission metadata)
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id ?? '')
  const [broughtByTeamId, setBroughtByTeamId] = useState('')
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
      setPicked(list.length === 1 ? list[0] : null)
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, tab])

  // sync ข้อมูลสุขภาพจาก picked เมื่อเลือกคนใหม่
  useEffect(() => {
    setPickedPhone(picked?.phone ?? '')
    setPickedConditions(picked?.conditions ?? '')
    setPickedDrugAllergy(picked?.drugAllergy ?? '')
    setPickedFoodAllergy(picked?.foodAllergy ?? '')
  }, [picked])

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
      // PATCH ข้อมูลสุขภาพที่อาจแก้ไขระหว่าง intake
      await fetch(`/api/household-members/${picked.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: pickedPhone,
          conditions: pickedConditions,
          drugAllergy: pickedDrugAllergy,
          foodAllergy: pickedFoodAllergy,
        }),
      }).catch(() => {})
    } else {
      if (!firstName.trim()) { setError('กรอกชื่ออย่างน้อย'); setSaving(false); return }
      body.person = {
        prefix, firstName: firstName.trim(), lastName: lastName.trim(),
        nationalId: nationalId || undefined,
        birthDate: birthDate || undefined,
        nationality, sex,
        age: age ? Number(age) : undefined,
        phone: phone || undefined,
        hno: hno || undefined,
        villno: villno || undefined,
        tambon: tambon || undefined,
        amphoe: amphoe || undefined,
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

  const F = 'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]'
  const L = 'mb-1 block text-xs font-medium text-[var(--fg-muted)]'

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

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-sunken)]">
          {(['search', 'walkin'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setPicked(null) }}
              className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-medium ${tab === t ? 'border-[var(--accent)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)]'}`}
            >
              {t === 'search' ? 'ค้นจากทะเบียน' : 'Walk-in (คนใหม่/ต่างด้าว)'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">

          {/* ── ค้นจากทะเบียน ── */}
          {tab === 'search' && (
            <>
              <div className="p-5 space-y-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="พิมพ์เลขบัตร 13 หลัก หรือชื่อ-สกุล"
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {searching && <p className="text-center text-xs text-[var(--fg-subtle)]">กำลังค้นหา...</p>}
                {!searching && query.trim().length >= 3 && results.length === 0 && (
                  <p className="text-center text-xs text-[var(--fg-subtle)]">ไม่พบในทะเบียน — สลับไปแท็บ Walk-in เพื่อเพิ่มใหม่</p>
                )}
                <ul className="space-y-1.5">
                  {results.map((p) => (
                    <li key={p.id ?? p.name}>
                      <button
                        type="button"
                        onClick={() => setPicked(p)}
                        disabled={!!p.activeShelterName}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${picked?.id === p.id ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'border-[var(--border)] hover:enabled:border-[var(--accent)]'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.name}</span>
                            {p.isVulnerable && <span className="rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--risk-flood)]">เปราะบาง</span>}
                            {p.age != null && <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age} ปี</span>}
                            {p.sex && <span className="text-xs text-[var(--fg-subtle)]">· {p.sex}</span>}
                          </div>
                          <p className="font-mono text-xs text-[var(--fg-subtle)]">{p.nationalIdMasked ?? '—'}</p>
                          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                            {[p.conditions, p.drugAllergy && `แพ้ยา: ${p.drugAllergy}`, p.foodAllergy && `แพ้อาหาร: ${p.foodAllergy}`].filter(Boolean).join(' · ') || 'ไม่มีข้อมูลสุขภาพ'}
                          </p>
                          {p.activeShelterName && (
                            <p className="mt-1 inline-flex items-center gap-1 rounded bg-[color-mix(in_oklch,var(--risk-near)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--risk-near)]">
                              ⚠ พักอยู่ที่ {p.activeShelterName} แล้ว — ย้ายออกก่อนถึงจะรับเข้าได้
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── ข้อมูลสุขภาพ (โชว์เมื่อเลือกคนแล้ว) ── */}
              {picked && (
                <section className="p-5 space-y-2.5 bg-[color-mix(in_oklch,var(--accent)_4%,transparent)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                      ยืนยัน/แก้ไขข้อมูลสุขภาพ — {picked.name}
                    </p>
                    <span className="text-[10px] text-[var(--fg-subtle)]">ข้อมูลจะบันทึกลงทะเบียนด้วย</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="col-span-2">
                      <label className={L}>เบอร์โทรศัพท์</label>
                      <input value={pickedPhone} onChange={(e) => setPickedPhone(e.target.value)} placeholder="เบอร์โทร" className={F} />
                    </div>
                    <div className="col-span-2">
                      <label className={L}>โรคประจำตัว</label>
                      <input value={pickedConditions} onChange={(e) => setPickedConditions(e.target.value)} placeholder="เช่น เบาหวาน ความดัน หัวใจ ติดเตียง" className={F} />
                    </div>
                    <div>
                      <label className={L}>แพ้ยา</label>
                      <input value={pickedDrugAllergy} onChange={(e) => setPickedDrugAllergy(e.target.value)} placeholder="ระบุยาที่แพ้" className={F} />
                    </div>
                    <div>
                      <label className={L}>แพ้อาหาร</label>
                      <input value={pickedFoodAllergy} onChange={(e) => setPickedFoodAllergy(e.target.value)} placeholder="ระบุอาหารที่แพ้" className={F} />
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Walk-in ── */}
          {tab === 'walkin' && (
            <>
              {/* ข้อมูลบุคคล */}
              <section className="p-5 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ข้อมูลบุคคล</p>
                <div className="grid grid-cols-6 gap-2.5">
                  <div className="col-span-2">
                    <label className={L}>คำนำหน้า</label>
                    <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className={F}>
                      {['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.'].map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={L}>ชื่อ *</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ชื่อ" className={F} />
                  </div>
                  <div className="col-span-2">
                    <label className={L}>นามสกุล</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="นามสกุล" className={F} />
                  </div>

                  <div className="col-span-3">
                    <label className={L}>เลขบัตรประชาชน 13 หลัก</label>
                    <input
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 13))}
                      placeholder="X-XXXX-XXXXX-XX-X"
                      className={`${F} font-mono tracking-widest`}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className={L}>วัน/เดือน/ปีเกิด</label>
                    <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={F} />
                  </div>

                  <div className="col-span-2">
                    <label className={L}>อายุ (ปี)</label>
                    <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="อายุ" className={`${F} font-mono`} />
                  </div>
                  <div className="col-span-2">
                    <label className={L}>เพศ</label>
                    <select value={sex} onChange={(e) => setSex(e.target.value)} className={F}>
                      <option>ชาย</option><option>หญิง</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={L}>สัญชาติ</label>
                    <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={F}>
                      {['ไทย', 'พม่า', 'ลาว', 'กัมพูชา', 'ไร้สถานะ', 'อื่นๆ'].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </div>

                  <div className="col-span-6">
                    <label className={L}>หมายเลขโทรศัพท์</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทร" className={F} />
                  </div>
                </div>
              </section>

              {/* ที่อยู่ */}
              <section className="p-5 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ที่อยู่</p>
                <div className="grid grid-cols-6 gap-2.5">
                  <div className="col-span-2">
                    <label className={L}>เลขที่บ้าน</label>
                    <input value={hno} onChange={(e) => setHno(e.target.value)} placeholder="เลขที่" className={F} />
                  </div>
                  <div className="col-span-1">
                    <label className={L}>หมู่ที่</label>
                    <input value={villno} onChange={(e) => setVillno(e.target.value)} placeholder="หมู่" className={F} />
                  </div>
                  <div className="col-span-3">
                    <label className={L}>ตำบล</label>
                    <input value={tambon} onChange={(e) => setTambon(e.target.value)} placeholder="ตำบล" className={F} />
                  </div>
                  <div className="col-span-6">
                    <label className={L}>อำเภอ</label>
                    <input value={amphoe} onChange={(e) => setAmphoe(e.target.value)} placeholder="อำเภอ" className={F} />
                  </div>
                </div>
              </section>

              {/* ข้อมูลสุขภาพ */}
              <section className="p-5 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ข้อมูลสุขภาพ</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className={L}>โรคประจำตัว</label>
                    <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="เช่น เบาหวาน ความดัน หัวใจ ติดเตียง" className={F} />
                  </div>
                  <div>
                    <label className={L}>แพ้ยา</label>
                    <input value={drugAllergy} onChange={(e) => setDrugAllergy(e.target.value)} placeholder="ระบุยาที่แพ้" className={F} />
                  </div>
                  <div>
                    <label className={L}>แพ้อาหาร</label>
                    <input value={foodAllergy} onChange={(e) => setFoodAllergy(e.target.value)} placeholder="ระบุอาหารที่แพ้" className={F} />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── รายละเอียดการรับเข้า (ทุก tab) ── */}
          <section className="p-5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">รายละเอียดการรับเข้า</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={L}>โซน/อาคาร</label>
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={F}>
                  <option value="">— ไม่ระบุโซน —</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label className={L}>จุด Admit</label>
                <input value={intakePoint} onChange={(e) => setIntakePoint(e.target.value)} placeholder="จุดรับเข้า (ถ้ามี)" className={F} />
              </div>
              <div>
                <label className={L}>ทีม/หน่วยนำส่ง</label>
                <select value={broughtByTeamId} onChange={(e) => { setBroughtByTeamId(e.target.value); if (e.target.value) setBroughtByText('') }} className={F}>
                  <option value="">— เลือกทีม —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className={L}>หรือพิมพ์ชื่อหน่วย</label>
                <input value={broughtByText} onChange={(e) => { setBroughtByText(e.target.value); if (e.target.value) setBroughtByTeamId('') }} placeholder="หน่วยงานนำส่ง" className={F} />
              </div>
              <div className="col-span-2">
                <label className={L}>หมายเหตุ</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุเพิ่มเติม" className={F} />
              </div>
            </div>
          </section>

          {picked && (
            <div className="mx-5 mb-4 rounded-lg border border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-3 text-xs">
              จะรับเข้า: <strong>{picked.name}</strong>
              {picked.nationalIdMasked && <span className="ml-1 font-mono text-[var(--fg-muted)]">({picked.nationalIdMasked})</span>}
              {picked.isVulnerable && <span className="ml-2 rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--risk-flood)]">เปราะบาง</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3">
          {error ? (
            <span className="text-xs text-[var(--risk-flood)]">{error}</span>
          ) : tab === 'search' && !picked ? (
            <span className="text-xs text-[var(--fg-subtle)]">เลือกรายชื่อจากผลค้นหาก่อน</span>
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
