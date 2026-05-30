'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Loader2, Save } from 'lucide-react'

interface Initial {
  id: string
  name: string
  type: string
  capacity: number | null
  bedriddenCapacity: number | null
  oxygenSupport: boolean
  wheelchairSupport: boolean
  electricitySupport: boolean
  contact: string | null
  lat: number
  lng: number
}

export function EditShelterButton({ initial }: { initial: Initial }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initial.name)
  const [type, setType] = useState<'shelter' | 'assembly'>(initial.type === 'assembly' ? 'assembly' : 'shelter')
  const [capacity, setCapacity] = useState(initial.capacity?.toString() ?? '')
  const [bedriddenCapacity, setBedriddenCapacity] = useState(initial.bedriddenCapacity?.toString() ?? '')
  const [contact, setContact] = useState(initial.contact ?? '')
  const [lat, setLat] = useState(initial.lat.toString())
  const [lng, setLng] = useState(initial.lng.toString())
  const [oxygenSupport, setOxygenSupport] = useState(initial.oxygenSupport)
  const [wheelchairSupport, setWheelchairSupport] = useState(initial.wheelchairSupport)
  const [electricitySupport, setElectricitySupport] = useState(initial.electricitySupport)

  async function submit() {
    if (!name.trim()) { setError('กรอกชื่อศูนย์'); return }
    if (!lat.trim() || !lng.trim()) { setError('กรอกพิกัด'); return }
    setSaving(true); setError(null)
    const res = await fetch(`/api/shelters/${initial.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), type,
        capacity: capacity ? Number(capacity) : null,
        bedriddenCapacity: bedriddenCapacity ? Number(bedriddenCapacity) : null,
        contact: contact || null,
        lat: Number(lat), lng: Number(lng),
        oxygenSupport, wheelchairSupport, electricitySupport,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'บันทึกไม่สำเร็จ')
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="gx-btn gx-btn-ghost">
        <Pencil size={14} /> แก้ไขข้อมูลศูนย์
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Pencil size={16} className="text-[var(--accent)]" />
                <h2 className="text-base font-semibold">แก้ไขข้อมูลศูนย์</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">ชื่อศูนย์</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">ประเภท</span>
                  <select value={type} onChange={(e) => setType(e.target.value as 'shelter' | 'assembly')} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
                    <option value="shelter">ศูนย์อพยพ (พักค้าง)</option>
                    <option value="assembly">จุดรวมพล (ชั่วคราว)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">เบอร์ติดต่อ</span>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="—" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">ความจุรวม (คน)</span>
                  <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} placeholder="—" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">ติดเตียง (คน)</span>
                  <input value={bedriddenCapacity} onChange={(e) => setBedriddenCapacity(e.target.value.replace(/\D/g, ''))} placeholder="—" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">latitude</span>
                  <input value={lat} onChange={(e) => setLat(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]">longitude</span>
                  <input value={lng} onChange={(e) => setLng(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono" />
                </label>
              </div>

              <div className="space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">รองรับด้านสุขภาพ</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { v: oxygenSupport, set: setOxygenSupport, label: 'ออกซิเจน' },
                    { v: wheelchairSupport, set: setWheelchairSupport, label: 'รถเข็น/ติดเตียง' },
                    { v: electricitySupport, set: setElectricitySupport, label: 'ไฟฟ้าสำรอง' },
                  ].map((c) => (
                    <label key={c.label} className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
                      <input type="checkbox" checked={c.v} onChange={(e) => c.set(e.target.checked)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3">
              {error ? <span className="text-xs text-[var(--risk-flood)]">{error}</span> : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="gx-btn gx-btn-ghost gx-btn-sm">ยกเลิก</button>
                <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
