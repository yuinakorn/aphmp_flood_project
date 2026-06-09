'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, UserPlus, CheckCircle2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROLE_LABEL, REQUESTABLE_ROLES } from '@/lib/roles'
import { registerStaffAction, type RegisterResult } from './actions'

const ERROR_TEXT: Record<NonNullable<RegisterResult['error']>, string> = {
  invalid_cid: 'เลขประจำตัวประชาชนไม่ถูกต้อง (13 หลัก)',
  invalid_province: 'กรุณาเลือกจังหวัดที่สังกัด',
  missing_name: 'กรุณากรอกชื่อ-นามสกุล',
  invalid_role: 'กรุณาเลือกสิทธิ์ที่ต้องการ',
  exists: 'เลขบัตรนี้ลงทะเบียนไว้แล้ว — กลับไปเข้าสู่ระบบ',
}

export function RegisterClient({ initialCid, provinces }: { initialCid: string; provinces: string[] }) {
  const [cid, setCid] = useState(initialCid)
  const [name, setName] = useState('')
  const [province, setProvince] = useState('')
  const [role, setRole] = useState('')
  const [unitName, setUnitName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await registerStaffAction({ cid: cid.replace(/\D/g, ''), name, province, role, unitName })
      if (res.ok) setDone(true)
      else setError(ERROR_TEXT[res.error ?? 'invalid_cid'])
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-8">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color-mix(in_oklch,var(--risk-safe)_14%,transparent)] text-[var(--risk-safe)]">
            <CheckCircle2 size={28} strokeWidth={1.9} />
          </span>
          <h2 className="mt-5 text-[19px] font-semibold tracking-tight">ส่งคำขอลงทะเบียนแล้ว</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
            คำขอของคุณกำลังรอผู้ดูแลระบบอนุมัติ เมื่อได้รับอนุมัติแล้วจะเข้าสู่ระบบด้วย ThaiD ได้ทันที
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90"
          >
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-8">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          กลับหน้าเข้าสู่ระบบ
        </Link>

        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">ลงทะเบียนเจ้าหน้าที่</p>
        <h2 className="mt-2 text-[20px] font-semibold tracking-tight">ขอสิทธิ์เข้าใช้งาน</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
          กรอกข้อมูลเพื่อส่งคำขอ ผู้ดูแลระบบจะตรวจสอบและอนุมัติ
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="เลขประจำตัวประชาชน">
            <input
              inputMode="numeric"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="x-xxxx-xxxxx-xx-x"
              maxLength={17}
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 font-mono text-[14px] tracking-wide outline-none focus:border-[var(--accent)]"
            />
          </Field>

          <Field label="ชื่อ-นามสกุล">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น นาง สมศรี ใจดี"
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[14px] outline-none focus:border-[var(--accent)]"
            />
          </Field>

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
          {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} strokeWidth={1.9} />}
          {loading ? 'กำลังส่งคำขอ' : 'ส่งคำขอลงทะเบียน'}
        </Button>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] px-3 py-2.5 text-[12px] text-[var(--risk-flood)]"
          >
            <Ban size={14} className="mt-px shrink-0" />
            {error}
          </div>
        )}
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
