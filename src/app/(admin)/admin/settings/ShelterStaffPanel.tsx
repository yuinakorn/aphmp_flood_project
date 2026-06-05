'use client'

import { useEffect, useState } from 'react'
import { UserPlus, X, ShieldCheck, Loader2 } from 'lucide-react'

interface StaffMember {
  id: string
  userId: string
  name: string
  email?: string | null
  role: string
  unitName?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  eoc: 'EOC',
  officer: 'เจ้าหน้าที่',
  vhv: 'อสม.',
  ems: 'EMS',
  rescue: 'กู้ภัย',
  ddpm: 'ปภ.',
  shelter_manager: 'ผู้จัดการศูนย์',
  viewer: 'ผู้ดู',
}

export function ShelterStaffPanel({ shelterId }: { shelterId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [nationalId, setNationalId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/shelters/${shelterId}/staff`, { cache: 'no-store' })
    if (res.ok) setStaff((await res.json()).data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelterId])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const cid = nationalId.replace(/\D/g, '')
    if (cid.length !== 13) { setMsg('กรอกเลขบัตรประชาชน 13 หลัก'); return }
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/shelters/${shelterId}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId: cid }),
    })
    if (res.ok) {
      setNationalId('')
      await load()
    } else {
      setMsg((await res.json().catch(() => ({})))?.error ?? 'เพิ่มไม่สำเร็จ')
    }
    setBusy(false)
  }

  async function remove(userId: string) {
    await fetch(`/api/shelters/${shelterId}/staff?userId=${userId}`, { method: 'DELETE' })
    await load()
  }

  return (
    <section className="gx-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--fg)]">ผู้รับผิดชอบประจำศูนย์</h3>
      </div>
      <p className="mb-3 text-xs text-[var(--fg-muted)]">
        ระบุเจ้าหน้าที่ด้วยเลขบัตรประชาชน 13 หลัก — ผู้ที่เพิ่มจะเห็นและจัดการ roster เฉพาะศูนย์นี้ (สำหรับ role ที่ไม่ใช่ระดับสั่งการ)
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
          <Loader2 className="size-4 animate-spin" /> กำลังโหลด…
        </div>
      ) : staff.length === 0 ? (
        <p className="text-sm text-[var(--fg-subtle)]">ยังไม่มีผู้รับผิดชอบ</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-md bg-[var(--bg-sunken)] px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-[var(--fg)]">{s.name}</span>
                <span className="ml-2 text-xs text-[var(--fg-muted)]">
                  {ROLE_LABEL[s.role] ?? s.role}{s.unitName ? ` · ${s.unitName}` : ''}
                </span>
              </span>
              <button onClick={() => remove(s.userId)} className="text-[var(--fg-subtle)] hover:text-[var(--risk-flood)]" title="ลบ">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          inputMode="numeric"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 13))}
          placeholder="เลขบัตรประชาชน 13 หลัก"
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 font-mono text-sm tracking-wide"
        />
        <button type="submit" disabled={busy} className="gx-btn gx-btn-primary gx-btn-sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} เพิ่ม
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-[var(--risk-flood)]">{msg}</p>}
    </section>
  )
}
