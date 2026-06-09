'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldQuestion, Clock, Ban, CheckCircle2, LogOut, Pencil, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROLE_LABEL, REQUESTABLE_ROLES } from '@/lib/roles'
import { requestAccessAction, type RequestAccessResult } from './actions'

const ERROR_TEXT: Record<NonNullable<RequestAccessResult['error']>, string> = {
  unauthorized: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  stale_session: 'เซสชันไม่ตรงกับทะเบียน กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้ง',
  invalid_province: 'กรุณาเลือกจังหวัดที่สังกัด',
  invalid_role: 'กรุณาเลือกสิทธิ์ที่ต้องการ',
  not_pending: 'บัญชีนี้ได้รับการพิจารณาแล้ว',
  failed: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง',
}

interface Props {
  name: string
  status: 'pending' | 'suspended'
  submitted: boolean
  currentProvince: string
  currentRole: string
  currentUnitName: string
  provinces: string[]
}

export function RequestAccessClient({
  name,
  status,
  submitted,
  currentProvince,
  currentRole,
  currentUnitName,
  provinces,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(!submitted)
  const [province, setProvince] = useState(currentProvince)
  const [role, setRole] = useState(currentRole || '')
  const [unitName, setUnitName] = useState(currentUnitName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await requestAccessAction({ province, role, unitName })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(ERROR_TEXT[res.error ?? 'failed'])
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]">
            <ShieldQuestion size={22} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
              GIS Health Intelligence
            </p>
            <h1 className="text-[19px] font-semibold tracking-tight">ขอสิทธิ์เข้าใช้งาน</h1>
          </div>
        </div>

        {name && (
          <p className="mt-4 text-[13px] text-[var(--fg-muted)]">
            สวัสดี <span className="font-medium text-[var(--fg)]">{name}</span> — บัญชีของคุณยังไม่ได้รับสิทธิ์เข้าใช้งานระบบ
          </p>
        )}

        {status === 'suspended' ? (
          <Banner kind="error" icon={<Ban size={15} className="mt-px shrink-0" />}>
            บัญชีนี้ถูกระงับสิทธิ์ — กรุณาติดต่อผู้ดูแลระบบหรือผู้บัญชาการ EOC ของจังหวัด
          </Banner>
        ) : submitted && !editing ? (
          <>
            <Banner kind="info" icon={<Clock size={15} className="mt-px shrink-0" />}>
              ส่งคำขอแล้ว — กำลังรอผู้ดูแลระบบหรือผู้บัญชาการ EOC อนุมัติ
              เมื่อได้รับอนุมัติแล้ว กรุณาออกจากระบบแล้วเข้าใหม่อีกครั้ง
            </Banner>

            <dl className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[13px]">
              <Row label="จังหวัดที่ขอ" value={currentProvince || '—'} />
              <Row label="สิทธิ์ที่ขอ" value={ROLE_LABEL[currentRole as keyof typeof ROLE_LABEL] ?? currentRole ?? '—'} />
              <Row label="หน่วยงาน" value={currentUnitName || '—'} />
            </dl>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.refresh()}
                className="h-10 w-full text-[13px]"
              >
                <RotateCw size={15} strokeWidth={1.9} />
                ตรวจสอบสถานะอีกครั้ง
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(true)}
                className="h-9 w-full text-[12.5px] text-[var(--fg-muted)]"
              >
                <Pencil size={14} strokeWidth={1.9} />
                แก้ไขคำขอ
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
              เลือกจังหวัดที่สังกัดและสิทธิ์ที่ต้องการ ผู้ดูแลระบบหรือผู้บัญชาการ EOC จะตรวจสอบและอนุมัติ
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <Field label="จังหวัดที่สังกัด">
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[14px] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">— เลือกจังหวัด —</option>
                  {provinces.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>

              <Field label="สิทธิ์ที่ต้องการ">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[14px] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">— เลือกสิทธิ์ —</option>
                  {REQUESTABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </Field>

              <Field label="หน่วยงาน / หน่วยบริการ (ไม่บังคับ)">
                <input
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="เช่น รพ.สต.แม่สาย"
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[14px] outline-none focus:border-[var(--accent)]"
                />
              </Field>
            </div>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="mt-6 h-10 w-full bg-[var(--accent)] px-4 text-[13px] text-[var(--accent-fg)] hover:opacity-90"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} strokeWidth={1.9} />}
              {loading ? 'กำลังส่งคำขอ' : submitted ? 'บันทึกการแก้ไขคำขอ' : 'ส่งคำขอสิทธิ์'}
            </Button>

            {error && (
              <Banner kind="error" icon={<Ban size={14} className="mt-px shrink-0" />}>{error}</Banner>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => { window.location.href = '/api/auth/logout' }}
          className="mt-8 inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
        >
          <LogOut size={13} strokeWidth={1.75} />
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <dt className="shrink-0 text-[var(--fg-muted)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--fg)]">{value}</dd>
    </div>
  )
}

function Banner({
  kind,
  icon,
  children,
}: {
  kind: 'error' | 'info'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px] leading-relaxed"
      style={
        kind === 'error'
          ? { borderColor: 'var(--risk-flood)', background: 'color-mix(in oklch, var(--risk-flood) 10%, transparent)', color: 'var(--risk-flood)' }
          : { borderColor: 'var(--risk-near)', background: 'color-mix(in oklch, var(--risk-near) 10%, transparent)', color: 'var(--risk-near)' }
      }
    >
      {icon}
      {children}
    </div>
  )
}
