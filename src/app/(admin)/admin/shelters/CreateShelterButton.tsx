'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2 } from 'lucide-react'
import { LocationPicker } from '@/components/forms/LocationPicker'

const DEFAULT_LAT = 20.43
const DEFAULT_LNG = 99.88

export function CreateShelterButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<'shelter' | 'assembly'>('shelter')
  const [capacity, setCapacity] = useState('')
  const [bedriddenCapacity, setBedriddenCapacity] = useState('')
  const [contact, setContact] = useState('')
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [oxygenSupport, setOxygenSupport] = useState(false)
  const [wheelchairSupport, setWheelchairSupport] = useState(false)
  const [electricitySupport, setElectricitySupport] = useState(false)

  function reset() {
    setName(''); setType('shelter'); setCapacity(''); setBedriddenCapacity('')
    setContact(''); setLat(DEFAULT_LAT); setLng(DEFAULT_LNG)
    setOxygenSupport(false); setWheelchairSupport(false); setElectricitySupport(false)
    setError(null)
  }

  async function submit() {
    if (!name.trim()) { setError('กรอกชื่อศูนย์'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/shelters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name, type,
        capacity: capacity ? Number(capacity) : undefined,
        bedriddenCapacity: bedriddenCapacity ? Number(bedriddenCapacity) : undefined,
        contact: contact || undefined,
        lat, lng,
        oxygenSupport, wheelchairSupport, electricitySupport,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'บันทึกไม่สำเร็จ')
      return
    }
    setOpen(false); reset(); router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="gx-btn gx-btn-primary">
        <Plus size={16} /> เพิ่มศูนย์ใหม่
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:max-h-[92vh] sm:max-w-xl sm:rounded-xl">
            <div className="flex justify-center pt-3 sm:hidden"><div className="h-1 w-10 rounded-full bg-[var(--border)]" /></div>
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
              <h2 className="text-base font-semibold">เพิ่มศูนย์พักพิง / จุดรวมพล</h2>
              <button type="button" onClick={() => { setOpen(false); reset() }} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อศูนย์ *" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5" />
                <select value={type} onChange={(e) => setType(e.target.value as 'shelter' | 'assembly')} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
                  <option value="shelter">ศูนย์อพยพ (พักค้าง)</option>
                  <option value="assembly">จุดรวมพล (ชั่วคราว)</option>
                </select>
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="เบอร์ติดต่อ" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5" />
                <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} placeholder="ความจุรวม (คน)" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono" />
                <input value={bedriddenCapacity} onChange={(e) => setBedriddenCapacity(e.target.value.replace(/\D/g, ''))} placeholder="ความจุติดเตียง (คน)" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono" />
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ตำแหน่ง — คลิกหรือลากหมุดเพื่อกำหนด</p>
                <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} heightClass="h-[220px]" />
                <p className="font-mono text-[11px] text-[var(--fg-muted)]">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
              </div>

              <div className="space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">รองรับด้านสุขภาพ</p>
                <div className="flex flex-wrap gap-3 text-sm">
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

            <div className="border-t border-[var(--border)] bg-[var(--bg-sunken)] px-4 pb-6 pt-4 sm:flex sm:items-center sm:justify-between sm:px-5 sm:pb-3 sm:pt-3">
              {error && <p className="mb-3 text-xs text-[var(--risk-flood)] sm:mb-0">{error}</p>}
              <div className="flex gap-2 sm:ml-auto">
                <button type="button" onClick={() => { setOpen(false); reset() }} className="gx-btn gx-btn-ghost gx-btn-sm flex-1 sm:flex-none">ยกเลิก</button>
                <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm flex-1 sm:flex-none disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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
