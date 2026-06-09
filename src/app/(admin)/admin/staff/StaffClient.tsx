'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-is-mobile'
import {
  UserPlus, ShieldCheck, Ban, RotateCcw, Lock,
  Loader2, CircleUser, Clock, Pencil, Save, CheckCircle2, Search, X,
} from 'lucide-react'
import type { UserRole } from '@/types'
import { maskCid } from '@/lib/cid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'

interface StaffRow {
  id: string
  name: string
  nationalId: string | null
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

const VIA_LABEL: Record<string, string> = {
  thaid: 'ThaiD',
  sso: 'SSO (ProviderID/ThaiD)',
  whitelist: 'whitelist',
  credentials: 'dev',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function StatusBadge({ status }: { status: StaffRow['status'] }) {
  if (status === 'pending') {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 border-0 rounded-full px-2.5">
        รออนุมัติ
      </Badge>
    )
  }
  if (status === 'active') {
    return (
      <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:bg-green-500/10 dark:text-green-400 border-0 rounded-full px-2.5">
        ใช้งาน
      </Badge>
    )
  }
  return (
    <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 border-0 rounded-full px-2.5">
      ถูกระงับ
    </Badge>
  )
}

// ─── Detail Sheet ────────────────────────────────────────────────────────────

function StaffDetailSheet({
  staff,
  open,
  onOpenChange,
  assignableRoles,
  isNational,
  provinceOptions,
  busy,
  onApprove,
  onSuspend,
  onReactivate,
  onSave,
}: {
  staff: StaffRow | null
  open: boolean
  onOpenChange: (v: boolean) => void
  assignableRoles: UserRole[]
  isNational: boolean
  provinceOptions: string[]
  busy: boolean
  onApprove: () => void
  onSuspend: () => void
  onReactivate: () => void
  onSave: (fields: { name: string; role: UserRole; province: string; unitName: string }) => void
}) {
  const isMobile = useIsMobile()
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('officer')
  const [editProvince, setEditProvince] = useState('')
  const [editUnit, setEditUnit] = useState('')

  useEffect(() => {
    if (staff) {
      setEditName(staff.name)
      setEditRole(staff.role)
      setEditProvince(staff.province ?? '')
      setEditUnit(staff.unitName ?? '')
    }
  }, [staff])

  if (!staff) return null

  const inputCls = 'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]'

  const dirty =
    editName !== staff.name ||
    editRole !== staff.role ||
    editProvince !== (staff.province ?? '') ||
    editUnit !== (staff.unitName ?? '')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-sunken)] text-[var(--fg-muted)]">
              <CircleUser size={20} strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{staff.name}</SheetTitle>
              <SheetDescription className="mt-0.5 flex items-center gap-2">
                <StatusBadge status={staff.status} />
                <span className="text-xs text-[var(--fg-subtle)]">{ROLE_LABEL[staff.role] ?? staff.role}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ข้อมูลพื้นฐาน */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">ข้อมูลผู้ใช้</p>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--fg-muted)]">ชื่อ-สกุล</span>
                <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--fg-muted)]">บทบาท</span>
                <select className={inputCls} value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
                  {(assignableRoles.includes(staff.role) ? assignableRoles : [staff.role, ...assignableRoles]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--fg-muted)]">จังหวัด</span>
                {isNational ? (
                  <select className={inputCls} value={editProvince} onChange={(e) => setEditProvince(e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <div className={`${inputCls} flex items-center gap-2 !bg-[var(--bg-sunken)] text-[var(--fg-muted)]`}>
                    <Lock size={12} strokeWidth={1.75} className="shrink-0 text-[var(--fg-subtle)]" />
                    <span>{staff.province ?? '—'}</span>
                  </div>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--fg-muted)]">หน่วยงาน / หน่วยบริการ</span>
                <input className={inputCls} placeholder="ไม่บังคับ" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
              </label>
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={!dirty || busy || !editName.trim()}
              onClick={() => onSave({ name: editName, role: editRole, province: editProvince, unitName: editUnit })}
              className="gap-1.5"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              บันทึกการเปลี่ยนแปลง
            </Button>
          </section>

          {/* ประวัติ */}
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">ประวัติ</p>
            <dl className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
              {[
                { label: 'ลงทะเบียนผ่าน', value: VIA_LABEL[staff.registeredVia] ?? staff.registeredVia },
                { label: 'วันที่สมัคร', value: fmt(staff.createdAt) },
                { label: 'อนุมัติเมื่อ', value: fmt(staff.approvedAt) },
                { label: 'Login ล่าสุด', value: fmt(staff.lastLoginAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-xs text-[var(--fg-muted)] shrink-0">{label}</dt>
                  <dd className="font-mono text-xs text-[var(--fg)] text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* สถานะ */}
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">จัดการสถานะ</p>
            <div className="flex flex-wrap gap-2">
              {staff.status === 'pending' && (
                <>
                  <Button size="sm" variant="outline" disabled={busy} onClick={onApprove}
                    className="gap-1.5 text-green-700 hover:bg-green-500/15 hover:border-green-500/40">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    อนุมัติ
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={onSuspend}
                    className="gap-1.5 text-rose-600 hover:bg-rose-500/15 hover:border-rose-500/40">
                    <Ban className="size-3.5" /> ปฏิเสธ
                  </Button>
                </>
              )}
              {staff.status === 'active' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={onSuspend}
                  className="gap-1.5 text-rose-600 hover:bg-rose-500/15 hover:border-rose-500/40">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                  ระงับสิทธิ์
                </Button>
              )}
              {staff.status === 'suspended' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={onReactivate}
                  className="gap-1.5">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  คืนสิทธิ์
                </Button>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Table Row ───────────────────────────────────────────────────────────────

function StaffTableRow({
  r, busy, assignableRoles, onApprove, onSuspend, onReactivate, onRole, onOpenDetail,
}: {
  r: StaffRow
  busy: boolean
  assignableRoles: UserRole[]
  onApprove: () => void
  onSuspend: () => void
  onReactivate: () => void
  onRole: (role: UserRole) => void
  onOpenDetail: () => void
}) {
  const location = [r.province, r.unitName].filter(Boolean).join(' · ') || '—'

  return (
    <TableRow>
      {/* ชื่อ */}
      <TableCell>
        <div className="flex items-center gap-2">
          <CircleUser size={15} strokeWidth={1.75} className="shrink-0 text-[var(--fg-subtle)]" />
          <span className="text-sm font-medium text-[var(--fg)]">{r.name}</span>
        </div>
      </TableCell>

      {/* เลขบัตร ปชช. */}
      <TableCell className="whitespace-nowrap font-mono text-xs text-[var(--fg-muted)]">
        {r.nationalId ? maskCid(r.nationalId) : '—'}
      </TableCell>

      {/* สถานะ */}
      <TableCell>
        <StatusBadge status={r.status} />
      </TableCell>

      {/* บทบาท */}
      <TableCell className="text-sm text-[var(--fg-muted)]">
        {ROLE_LABEL[r.role] ?? r.role}
      </TableCell>

      {/* จังหวัด/หน่วยงาน */}
      <TableCell className="max-w-[180px] text-sm text-[var(--fg-muted)]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className="block cursor-default truncate">{location}</span>
            </TooltipTrigger>
            <TooltipContent>{location}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>

      {/* Login ล่าสุด */}
      <TableCell className="whitespace-nowrap text-xs text-[var(--fg-subtle)]">
        <span className="font-mono">{fmt(r.lastLoginAt)}</span>
        <span className="ml-1.5 opacity-60">· {VIA_LABEL[r.registeredVia] ?? r.registeredVia}</span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <TooltipProvider>
          <div className="flex items-center gap-1">
            {/* Role selector — active only */}
            {r.status === 'active' && (
              <select
                value={r.role}
                disabled={busy}
                onChange={(e) => onRole(e.target.value as UserRole)}
                className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-50 mr-1"
              >
                {(assignableRoles.includes(r.role) ? assignableRoles : [r.role, ...assignableRoles]).map((role) => (
                  <option key={role} value={role}>{ROLE_LABEL[role] ?? role}</option>
                ))}
              </select>
            )}

            {/* Pending: approve + reject */}
            {r.status === 'pending' && (
              <>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button variant="outline" size="icon-sm" onClick={onApprove} disabled={busy} aria-label="อนุมัติ"
                      className="text-green-700 hover:bg-green-500/15 hover:text-green-700 hover:border-green-500/40">
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>อนุมัติ</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button variant="outline" size="icon-sm" onClick={onSuspend} disabled={busy} aria-label="ปฏิเสธ"
                      className="text-rose-600 hover:bg-rose-500/15 hover:text-rose-600 hover:border-rose-500/40">
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>ปฏิเสธ</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Active: suspend */}
            {r.status === 'active' && (
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button variant="outline" size="icon-sm" onClick={onSuspend} disabled={busy} aria-label="ระงับสิทธิ์"
                    className="text-rose-600 hover:bg-rose-500/15 hover:text-rose-600 hover:border-rose-500/40">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>ระงับสิทธิ์</TooltipContent>
              </Tooltip>
            )}

            {/* Suspended: reactivate */}
            {r.status === 'suspended' && (
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button variant="outline" size="icon-sm" onClick={onReactivate} disabled={busy} aria-label="คืนสิทธิ์">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>คืนสิทธิ์</TooltipContent>
              </Tooltip>
            )}

            {/* ดูรายละเอียด / แก้ไข */}
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Button variant="ghost" size="icon-sm" onClick={onOpenDetail} aria-label="แก้ไข / รายละเอียด">
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>แก้ไข / รายละเอียด</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function StaffClient({ isNational, province, provinceOptions }: Props) {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // whitelist form
  const [cid, setCid] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('officer')
  const [formProvince, setFormProvince] = useState(isNational ? '' : (province ?? ''))
  const [unitName, setUnitName] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [patchSuccess, setPatchSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // detail sheet
  const [detailStaff, setDetailStaff] = useState<StaffRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // search + filter
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')

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

  async function patch(id: string, body: Record<string, unknown>, closeDetail = false) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'อัปเดตไม่สำเร็จ')
      if (closeDetail) setDetailOpen(false)
      await load()
      setPatchSuccess('บันทึกเรียบร้อยแล้ว')
      setTimeout(() => setPatchSuccess(null), 3000)
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
      const addedName = name
      setCid(''); setName(''); setUnitName(''); setRole('officer')
      if (isNational) setFormProvince('')
      await load()
      setShowForm(false)
      setFormSuccess(`เพิ่ม "${addedName}" เรียบร้อยแล้ว`)
      setTimeout(() => setFormSuccess(null), 4000)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setCreating(false)
    }
  }

  function openDetail(r: StaffRow) {
    setDetailStaff(r)
    setDetailOpen(true)
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const unitOptions = [...new Set(rows.map((r) => r.unitName).filter(Boolean) as string[])].sort()

  const others = rows.filter((r) => {
    if (r.status === 'pending') return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (roleFilter && r.role !== roleFilter) return false
    if (provinceFilter && r.province !== provinceFilter) return false
    if (unitFilter && r.unitName !== unitFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const digits = search.replace(/\D/g, '')
      const hit = r.name.toLowerCase().includes(q)
        || (r.province ?? '').toLowerCase().includes(q)
        || (r.unitName ?? '').toLowerCase().includes(q)
        || (digits.length > 0 && (r.nationalId ?? '').includes(digits))
      if (!hit) return false
    }
    return true
  })
  const counts = {
    pending: pending.length,
    active: rows.filter((r) => r.status === 'active').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  }

  const inputCls = 'h-10 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]'

  const rowProps = (r: StaffRow) => ({
    r,
    busy: busyId === r.id,
    assignableRoles,
    onApprove: () => patch(r.id, { status: 'active' }),
    onSuspend: () => patch(r.id, { status: 'suspended' }),
    onReactivate: () => patch(r.id, { status: 'active' }),
    onRole: (role: UserRole) => patch(r.id, { role }),
    onOpenDetail: () => openDetail(r),
  })

  const tableHead = (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>ชื่อ-สกุล</TableHead>
        <TableHead className="w-[150px]">เลขบัตร ปชช.</TableHead>
        <TableHead className="w-[100px]">สถานะ</TableHead>
        <TableHead>บทบาท</TableHead>
        <TableHead>จังหวัด / หน่วยงาน</TableHead>
        <TableHead>Login ล่าสุด</TableHead>
        <TableHead className="w-[230px]">Actions</TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          {isNational ? 'ทุกจังหวัด' : <span>จังหวัด <b className="font-medium text-[var(--fg)]">{province ?? 'ไม่ระบุ'}</b></span>}
          {counts.pending > 0 && <span className="gx-badge gx-badge-near"><span className="gx-badge-dot" />รออนุมัติ {counts.pending}</span>}
          <span className="gx-badge"><span className="gx-badge-dot" />ใช้งาน {counts.active}</span>
          {counts.suspended > 0 && <span className="gx-badge gx-badge-flood"><span className="gx-badge-dot" />ระงับ {counts.suspended}</span>}
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
          className="gx-btn gx-btn-primary"
        >
          <UserPlus size={15} strokeWidth={1.9} />
          {showForm ? 'ยกเลิก' : 'เพิ่มเจ้าหน้าที่'}
        </button>
      </div>

      {/* success banner */}
      {formSuccess && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-[13px] text-green-700 dark:text-green-400">
          <CheckCircle2 size={14} strokeWidth={1.9} />
          {formSuccess}
        </div>
      )}
      {patchSuccess && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-[13px] text-green-700 dark:text-green-400">
          <CheckCircle2 size={14} strokeWidth={1.9} />
          {patchSuccess}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-md border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--risk-flood)]">
          {error}
        </div>
      )}

      {/* Whitelist form — collapsible */}
      {showForm && (
        <form onSubmit={createStaff} className="gx-card p-5" style={{ ['--tile' as string]: 'var(--accent)' }}>
          <p className="mb-3 text-sm font-semibold text-[var(--fg)]">ออกสิทธิ์ล่วงหน้า (whitelist)</p>
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
              {creating ? 'กำลังเพิ่ม...' : 'บันทึก'}
            </button>
            {formError && <span className="text-sm text-[var(--risk-flood)]">{formError}</span>}
          </div>
        </form>
      )}

      {/* รออนุมัติ */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <Clock size={13} strokeWidth={1.9} className="text-amber-500" />
            รออนุมัติ <span className="font-mono">{pending.length}</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-[var(--bg-elevated)]">
            <Table>
              {tableHead}
              <TableBody>
                {pending.map((r) => <StaffTableRow key={r.id} {...rowProps(r)} />)}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ เลขบัตร ปชช. หน่วยงาน จังหวัด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-8 pr-8 text-sm outline-none transition-colors focus:border-[var(--accent)]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)]">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-0.5">
          {([['all', 'ทั้งหมด'], ['active', 'ใช้งาน'], ['suspended', 'ถูกระงับ']] as const).map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => setStatusFilter(val)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === val
                  ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as '' | UserRole)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs outline-none focus:border-[var(--accent)]"
        >
          <option value="">— ทุกบทบาท —</option>
          {assignableRoles.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>

        {/* Province filter — national only */}
        {isNational && (
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs outline-none focus:border-[var(--accent)]"
          >
            <option value="">— ทุกจังหวัด —</option>
            {provinceOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        {/* Unit filter */}
        {unitOptions.length > 0 && (
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs outline-none focus:border-[var(--accent)]"
          >
            <option value="">— ทุกหน่วยงาน —</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        )}
      </div>

      {/* เจ้าหน้าที่ทั้งหมด */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          เจ้าหน้าที่ทั้งหมด{' '}
          <span className="ml-1 font-mono">{others.length}</span>
          {(search || statusFilter !== 'all' || roleFilter || provinceFilter || unitFilter) && (
            <span className="ml-1 text-[var(--fg-subtle)]">/ {rows.filter(r => r.status !== 'pending').length} รายการ</span>
          )}
        </h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {loading && <div className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">กำลังโหลด…</div>}
          {!loading && others.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">
              {(search || statusFilter !== 'all' || roleFilter || provinceFilter || unitFilter) ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีเจ้าหน้าที่'}
            </div>
          )}
          {!loading && others.length > 0 && (
            <Table>
              {tableHead}
              <TableBody>
                {others.map((r) => <StaffTableRow key={r.id} {...rowProps(r)} />)}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Detail sheet */}
      <StaffDetailSheet
        staff={detailStaff}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        assignableRoles={assignableRoles}
        isNational={isNational}
        provinceOptions={provinceOptions}
        busy={detailStaff ? busyId === detailStaff.id : false}
        onApprove={() => detailStaff && patch(detailStaff.id, { status: 'active' }, true)}
        onSuspend={() => detailStaff && patch(detailStaff.id, { status: 'suspended' }, true)}
        onReactivate={() => detailStaff && patch(detailStaff.id, { status: 'active' }, true)}
        onSave={(fields) => detailStaff && patch(detailStaff.id, fields)}
      />
    </div>
  )
}
