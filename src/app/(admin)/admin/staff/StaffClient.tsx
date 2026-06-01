'use client'

import { useEffect, useState } from 'react'
import { UserPlus, ShieldCheck, Ban, RotateCcw, Lock, Clock, CircleUser, Loader2 } from 'lucide-react'
import type { UserRole } from '@/types'

interface StaffRow {
  id: string
  name: string
  role: UserRole
  province: string | null
  unitName: string | null
  status: 'pending' | 'active' | 'suspended'
  registeredVia: string
  createdAt: string | null
  lastLoginAt: string | null
  approvedAt: string | null
}

interface Props {
  isNational: boolean
  province: string | null
  provinceOptions: string[]
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  ddpm: 'ปภ. (ระดับชาติ)',
  eoc: 'ผู้บัญชาการ EOC',
  officer: 'เจ้าหน้าที่',
  vhv: 'อสม.',
  ems: 'กู้ชีพ EMS',
  rescue: 'กู้ภัย',
  shelter_manager: 'ผู้จัดการศูนย์พักพิง',
  viewer: 'ผู้ดู',
}

const STATUS_META: Record<StaffRow['status'], { label: string; tone: string }> = {
  pending: { label: 'รออนุมัติ', tone: 'var(--risk-near)' },
  active: { label: 'ใช้งาน', tone: 'var(--risk-safe)' },
  suspended: { label: 'ถูกระงับ', tone: 'var(--risk-flood)' },
}

const VIA_LABEL: Record<string, string> = {
  thaid: 'ThaiD (ลงทะเบียนเอง)',
  whitelist: 'whitelist',
  credentials: 'dev',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function StaffClient({ isNational, province, provinceOptions }: Props) {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // ฟอร์ม whitelist
  const [cid, setCid] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('officer')
  const [formProvince, setFormProvince] = useState(isNational ? '' : (province ?? ''))
  const [unitName, setUnitName] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const assignableRoles: UserRole[] = isNational
    ? ['officer', 'eoc', 'vhv', 'ems', 'rescue', 'shelter_manager', 'viewer', 'admin', 'ddpm']
    : ['officer', 'eoc', 'vhv', 'ems', 'rescue', 'shelter_manager', 'viewer']

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/staff')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setRows(json.data as StaffRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'อัปเดตไม่สำเร็จ')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusyId(null)
    }
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    setFormError(null)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: cid.replace(/\D/g, ''), name, role, province: formProvince, unitName }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'เพิ่มเจ้าหน้าที่ไม่สำเร็จ')
      setCid(''); setName(''); setUnitName(''); setRole('officer')
      if (isNational) setFormProvince('')
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setCreating(false)
    }
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const others = rows.filter((r) => r.status !== 'pending')
  const counts = {
    pending: pending.length,
    active: rows.filter((r) => r.status === 'active').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  }

  const inputCls = 'h-10 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">ทะเบียนเจ้าหน้าที่ · ThaiD</p>
          <h1 className="gx-title mt-1.5">จัดการเจ้าหน้าที่</h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            {isNational ? 'ทุกจังหวัด' : <>จังหวัด <b className="font-medium text-[var(--fg)]">{province ?? 'ไม่ระบุ'}</b></>}
            {' · '}อนุมัติคำขอ · ออก whitelist · ระงับสิทธิ์
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {counts.pending > 0 && <span className="gx-badge gx-badge-near"><span className="gx-badge-dot" />รออนุมัติ {counts.pending}</span>}
          <span className="gx-badge"><span className="gx-badge-dot" />ใช้งาน {counts.active}</span>
          {counts.suspended > 0 && <span className="gx-badge gx-badge-flood"><span className="gx-badge-dot" />ระงับ {counts.suspended}</span>}
        </div>
      </div>

      {/* whitelist form */}
      <form onSubmit={createStaff} className="gx-card mt-6 p-5" style={{ ['--tile' as string]: 'var(--accent)' }}>
        <div className="mb-4 flex items-center gap-3">
          <span className="gx-icon-tile size-10"><UserPlus size={18} strokeWidth={1.75} /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">เพิ่มเจ้าหน้าที่ (whitelist)</p>
            <p className="text-xs text-[var(--fg-muted)]">ออกสิทธิ์ล่วงหน้าด้วยเลขบัตรประชาชน — เข้าใช้งานได้ทันทีเมื่อ login ด้วย ThaiD</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputCls} inputMode="numeric" placeholder="เลขบัตรประชาชน 13 หลัก" value={cid} onChange={(e) => setCid(e.target.value)} maxLength={17} required />
          <input className={inputCls} placeholder="ชื่อ-นามสกุล" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {assignableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          {isNational ? (
            <select className={inputCls} value={formProvince} onChange={(e) => setFormProvince(e.target.value)} required>
              <option value="">— เลือกจังหวัด —</option>
              {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <div className={`${inputCls} flex items-center gap-2 !bg-[var(--bg-sunken)] text-[var(--fg-muted)]`}>
              <Lock size={13} strokeWidth={1.75} className="shrink-0 text-[var(--fg-subtle)]" />
              <span className="truncate">{province ?? 'ไม่พบจังหวัดสังกัด'}</span>
            </div>
          )}
          <input className={`${inputCls} sm:col-span-2`} placeholder="หน่วยงาน / หน่วยบริการ (ไม่บังคับ)" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={creating || !cid.trim() || !name.trim()} className="gx-btn gx-btn-primary disabled:opacity-50">
            {creating ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} strokeWidth={1.9} />}
            {creating ? 'กำลังเพิ่ม...' : 'เพิ่มเจ้าหน้าที่'}
          </button>
          {formError && <span className="text-sm text-[var(--risk-flood)]">{formError}</span>}
        </div>
      </form>

      {error && (
        <div role="alert" className="mt-4 rounded-md border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--risk-flood)]">
          {error}
        </div>
      )}

      {/* รออนุมัติ */}
      {pending.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
            <Clock size={15} strokeWidth={1.9} className="text-[var(--risk-near)]" />
            รออนุมัติ <span className="font-mono text-[var(--fg-subtle)]">{pending.length}</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--risk-near)_35%,var(--border))] bg-[var(--bg-elevated)]">
            {pending.map((r) => (
              <StaffItem key={r.id} r={r} busy={busyId === r.id} assignableRoles={assignableRoles}
                onApprove={() => patch(r.id, { status: 'active' })}
                onSuspend={() => patch(r.id, { status: 'suspended' })}
                onReactivate={() => patch(r.id, { status: 'active' })}
                onRole={(role) => patch(r.id, { role })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ทั้งหมด */}
      <section className="mt-7">
        <h2 className="mb-2.5 text-sm font-semibold text-[var(--fg)]">เจ้าหน้าที่ทั้งหมด <span className="ml-1 font-mono text-[var(--fg-subtle)]">{others.length}</span></h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {loading && <div className="px-4 py-8 text-center text-sm text-[var(--fg-subtle)]">กำลังโหลด…</div>}
          {!loading && others.length === 0 && <div className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีเจ้าหน้าที่</div>}
          {others.map((r) => (
            <StaffItem key={r.id} r={r} busy={busyId === r.id} assignableRoles={assignableRoles}
              onApprove={() => patch(r.id, { status: 'active' })}
              onSuspend={() => patch(r.id, { status: 'suspended' })}
              onReactivate={() => patch(r.id, { status: 'active' })}
              onRole={(role) => patch(r.id, { role })}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function StaffItem({
  r, busy, assignableRoles, onApprove, onSuspend, onReactivate, onRole,
}: {
  r: StaffRow
  busy: boolean
  assignableRoles: UserRole[]
  onApprove: () => void
  onSuspend: () => void
  onReactivate: () => void
  onRole: (role: UserRole) => void
}) {
  const st = STATUS_META[r.status]
  return (
    <div className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 last:border-b-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${st.tone} 13%, transparent)`, color: st.tone }}>
        <CircleUser size={20} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--fg)]">{r.name}</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `color-mix(in oklch, ${st.tone} 14%, transparent)`, color: st.tone }}>
            {st.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-subtle)]">
          <span>{ROLE_LABEL[r.role] ?? r.role}</span>
          {r.province && <span>{r.province}</span>}
          {r.unitName && <span>{r.unitName}</span>}
          <span>via {VIA_LABEL[r.registeredVia] ?? r.registeredVia}</span>
          <span className="font-mono">login ล่าสุด {fmt(r.lastLoginAt)}</span>
        </div>
      </div>

      {/* role select (เฉพาะ active) */}
      {r.status === 'active' && (
        <select
          value={r.role}
          disabled={busy}
          onChange={(e) => onRole(e.target.value as UserRole)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-50"
        >
          {(assignableRoles.includes(r.role) ? assignableRoles : [r.role, ...assignableRoles]).map((role) => (
            <option key={role} value={role}>{ROLE_LABEL[role] ?? role}</option>
          ))}
        </select>
      )}

      {/* actions */}
      {r.status === 'pending' && (
        <>
          <button type="button" disabled={busy} onClick={onApprove} className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
            <ShieldCheck size={13} /> อนุมัติ
          </button>
          <button type="button" disabled={busy} onClick={onSuspend} className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)] disabled:opacity-50">
            ปฏิเสธ
          </button>
        </>
      )}
      {r.status === 'active' && (
        <button type="button" disabled={busy} onClick={onSuspend} className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)] disabled:opacity-50">
          <Ban size={13} /> ระงับ
        </button>
      )}
      {r.status === 'suspended' && (
        <button type="button" disabled={busy} onClick={onReactivate} className="gx-btn gx-btn-ghost gx-btn-sm disabled:opacity-50">
          <RotateCcw size={13} /> คืนสิทธิ์
        </button>
      )}
    </div>
  )
}
