'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Printer, FileDown, Search, Eye, AlertTriangle, Users, Hospital, LogOut } from 'lucide-react'

interface IncidentMeta {
  id: string
  name: string
  tambon: string | null
  amphoe: string | null
  province: string | null
}

interface PersonRow {
  id: string
  status: string
  zoneName: string | null
  intakePoint: string | null
  broughtByText: string | null
  exitReason: string | null
  exitDestination: string | null
  notes: string | null
  admittedAt: string | null
  dischargedAt: string | null
  person: {
    id: string
    name: string
    nationalIdMasked: string | null
    birthDate: string | null
    age: number | null
    sex: string | null
    nationality: string | null
    phone: string | null
    hno: string | null
    villno: string | null
    tambon: string | null
    conditions: string | null
    foodAllergy: string | null
    drugAllergy: string | null
    isVulnerable: boolean
  } | null
}

interface ShelterGroup {
  shelterId: string
  shelterName: string
  summary: { cumulative: number; current: number; discharged: number; toHospital: number }
  rows: PersonRow[]
}

interface RosterResponse {
  incidentId: string
  shelters: ShelterGroup[]
  totals: { cumulative: number; current: number; discharged: number; toHospital: number }
}

type StatusFilter = 'all' | 'current' | 'discharged'

const STATUS_OPTS: { value: StatusFilter; label: string }[] = [
  { value: 'current', label: 'พักอยู่' },
  { value: 'discharged', label: 'ย้ายออกแล้ว' },
  { value: 'all', label: 'ทั้งหมด' },
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' })
}

function statusLabel(r: PersonRow): string {
  if (r.exitReason === 'admitted_hospital') return 'ส่ง รพ.'
  switch (r.status) {
    case 'admitted': return 'พักอยู่'
    case 'transferred': return 'ส่งต่อ'
    case 'discharged': return 'ย้ายออก'
    case 'cancelled': return 'ยกเลิก'
    default: return r.status
  }
}

function statusCls(r: PersonRow): string {
  if (r.status === 'admitted') return 'gx-badge gx-badge-safe'
  if (r.exitReason === 'admitted_hospital' || r.status === 'transferred') return 'gx-badge gx-badge-near'
  return 'gx-badge'
}

function addr(p: NonNullable<PersonRow['person']>): string {
  const parts = [
    p.hno ? `เลขที่ ${p.hno}` : null,
    p.villno ? `หมู่ ${p.villno}` : null,
    p.tambon ? `ต.${p.tambon}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

export function RosterView({
  incident,
  canWrite,
  seesAllShelters,
}: {
  incident: IncidentMeta | null
  canWrite: boolean
  seesAllShelters: boolean
}) {
  const [data, setData] = useState<RosterResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('current')
  const [shelterId, setShelterId] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!incident) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (status !== 'all') sp.set('status', status)
      if (shelterId !== 'all') sp.set('shelterId', shelterId)
      const res = await fetch(`/api/eoc/roster?${sp.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.error ?? 'โหลดข้อมูลไม่สำเร็จ')
        setData(null)
      } else {
        setData(await res.json())
      }
    } catch {
      setError('เชื่อมต่อไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [incident, status, shelterId])

  useEffect(() => {
    void load()
  }, [load])

  async function reveal(memberId: string) {
    if (revealed[memberId]) return
    const res = await fetch(`/api/household-members/${memberId}/national-id`, { cache: 'no-store' })
    if (res.ok) {
      const j = await res.json()
      setRevealed((prev) => ({ ...prev, [memberId]: j.nationalId ?? '—' }))
    }
  }

  // filter ค้นหาชื่อในฝั่ง client
  const shelters = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.shelters
    return data.shelters
      .map((s) => ({ ...s, rows: s.rows.filter((r) => r.person?.name.toLowerCase().includes(q)) }))
      .filter((s) => s.rows.length > 0)
  }, [data, query])

  const allShelterOpts = data?.shelters ?? []

  function exportHref() {
    const sp = new URLSearchParams()
    if (status !== 'all') sp.set('status', status)
    if (shelterId !== 'all') sp.set('shelterId', shelterId)
    return `/api/eoc/roster/export?${sp.toString()}`
  }

  if (!incident) {
    return (
      <div className="gx-card flex items-center gap-3 p-6 text-[var(--fg-muted)]">
        <AlertTriangle className="size-5 text-[var(--risk-near)]" />
        <div>
          <p className="font-medium text-[var(--fg)]">ยังไม่ได้เลือกเหตุการณ์</p>
          <p className="text-sm">เลือกเหตุการณ์ (Incident) ที่มุมขวาบนก่อน เพื่อดู roster ผู้พักพิงของเหตุการณ์นั้น</p>
        </div>
      </div>
    )
  }

  return (
    <div className="roster-root space-y-5">
      {/* หัวกระดาษ (แสดงทั้งจอ + พิมพ์) */}
      <div>
        <p className="gx-eyebrow">Roster ผู้พักพิง · {seesAllShelters ? 'ทุกศูนย์ในเหตุการณ์' : 'ศูนย์ที่รับผิดชอบ'}</p>
        <h1 className="gx-title">รายชื่อผู้ใช้บริการศูนย์พักพิง</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          เหตุการณ์: {incident.name}
          {[incident.tambon, incident.amphoe, incident.province].filter(Boolean).length > 0 &&
            ` · ${[incident.tambon && `ต.${incident.tambon}`, incident.amphoe && `อ.${incident.amphoe}`, incident.province && `จ.${incident.province}`].filter(Boolean).join(' ')}`}
        </p>
      </div>

      {/* แถบสรุปรวม */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat icon={<Users className="size-4" />} label="พักอยู่ปัจจุบัน" value={data.totals.current} tone="safe" />
          <SummaryStat icon={<Users className="size-4" />} label="สะสมทั้งหมด" value={data.totals.cumulative} />
          <SummaryStat icon={<LogOut className="size-4" />} label="ย้ายออกแล้ว" value={data.totals.discharged} />
          <SummaryStat icon={<Hospital className="size-4" />} label="ส่งต่อ รพ." value={data.totals.toHospital} tone="near" />
        </div>
      )}

      {/* ตัวกรอง + ปุ่ม (ไม่พิมพ์) */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-[var(--border)] p-0.5">
          {STATUS_OPTS.map((o) => (
            <button
              key={o.value}
              onClick={() => setStatus(o.value)}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${status === o.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)]'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {seesAllShelters && allShelterOpts.length > 1 && (
          <select
            value={shelterId}
            onChange={(e) => setShelterId(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
          >
            <option value="all">ทุกศูนย์</option>
            {allShelterOpts.map((s) => (
              <option key={s.shelterId} value={s.shelterId}>{s.shelterName}</option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ-สกุล"
            className="w-48 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 pl-8 pr-3 text-sm"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={() => window.print()} className="gx-btn gx-btn-ghost gx-btn-sm">
            <Printer className="size-4" /> พิมพ์ / PDF
          </button>
          {canWrite && (
            <a href={exportHref()} className="gx-btn gx-btn-primary gx-btn-sm">
              <FileDown className="size-4" /> Export .xlsx
            </a>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 p-8 text-[var(--fg-muted)]">
          <Loader2 className="size-5 animate-spin" /> กำลังโหลด…
        </div>
      )}
      {error && !loading && (
        <div className="gx-card flex items-center gap-3 p-6 text-[var(--risk-flood)]">
          <AlertTriangle className="size-5" /> {error}
        </div>
      )}

      {!loading && !error && shelters.length === 0 && (
        <div className="gx-card p-8 text-center text-[var(--fg-muted)]">
          ไม่พบรายชื่อผู้พักพิงตามเงื่อนไขที่เลือก
        </div>
      )}

      {!loading &&
        !error &&
        shelters.map((s) => (
          <section key={s.shelterId} className="roster-shelter gx-card overflow-hidden p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-base font-semibold text-[var(--fg)]">{s.shelterName}</h2>
              <p className="text-xs text-[var(--fg-muted)]">
                พักอยู่ {s.summary.current} · สะสม {s.summary.cumulative} · ย้ายออก {s.summary.discharged} · ส่ง รพ. {s.summary.toHospital}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="gx-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ชื่อ-สกุล</th>
                    <th>เลขบัตร ปชช.</th>
                    <th>วันเกิด</th>
                    <th>สัญชาติ</th>
                    <th>โทรศัพท์</th>
                    <th>ที่อยู่</th>
                    <th>เพศ</th>
                    <th>อายุ</th>
                    <th className="min-w-[6rem]">โรคประจำตัว</th>
                    <th className="min-w-[5rem]">แพ้อาหาร</th>
                    <th className="min-w-[5rem]">แพ้ยา</th>
                    <th className="min-w-[7rem]">จุด/โซน</th>
                    <th>วันเข้า</th>
                    <th>วันออก</th>
                    <th>สถานะ</th>
                    <th>หมายเหตุ / หน่วยงานนำส่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, i) => {
                    const p = r.person
                    const nid = p ? revealed[p.id] ?? p.nationalIdMasked ?? '—' : '—'
                    return (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td className="gx-cell-strong whitespace-nowrap">
                          {p?.name ?? '—'}
                          {p?.isVulnerable && (
                            <span className="ml-1.5 align-middle gx-badge gx-badge-near">เปราะบาง</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap font-mono text-xs">
                          {nid}
                          {p && !revealed[p.id] && p.nationalIdMasked && (
                            <button
                              onClick={() => reveal(p.id)}
                              title="เผยเลขบัตร (บันทึก audit)"
                              className="no-print ml-1.5 inline-flex align-middle text-[var(--fg-subtle)] hover:text-[var(--accent)]"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap">{fmtDate(p?.birthDate ?? null)}</td>
                        <td>{p?.nationality ?? '—'}</td>
                        <td className="whitespace-nowrap">{p?.phone ?? '—'}</td>
                        <td className="whitespace-nowrap">{p ? addr(p) : '—'}</td>
                        <td>{p?.sex ?? '—'}</td>
                        <td>{p?.age ?? '—'}</td>
                        <td>{p?.conditions ?? '—'}</td>
                        <td>{p?.foodAllergy ?? '—'}</td>
                        <td>{p?.drugAllergy ?? '—'}</td>
                        <td className="whitespace-nowrap">{r.zoneName ?? r.intakePoint ?? '—'}</td>
                        <td className="whitespace-nowrap">{fmtDate(r.admittedAt)}</td>
                        <td className="whitespace-nowrap">{fmtDate(r.dischargedAt)}</td>
                        <td><span className={statusCls(r)}>{statusLabel(r)}</span></td>
                        <td>{r.broughtByText ?? r.exitDestination ?? r.notes ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  )
}

function SummaryStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'safe' | 'near'
}) {
  const color =
    tone === 'safe' ? 'text-[var(--risk-safe)]' : tone === 'near' ? 'text-[var(--risk-near)]' : 'text-[var(--fg)]'
  return (
    <div className="gx-card flex items-center gap-3 p-4">
      <span className={`gx-icon-tile ${color}`}>{icon}</span>
      <div>
        <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
        <p className="text-xs text-[var(--fg-muted)]">{label}</p>
      </div>
    </div>
  )
}
