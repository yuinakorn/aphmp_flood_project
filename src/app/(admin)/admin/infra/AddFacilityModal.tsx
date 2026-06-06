'use client'

import { useState } from 'react'
import { X, Plus, Loader2, Hospital, Stethoscope, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LocationPicker } from '@/components/forms/LocationPicker'

const TYPES = [
  { value: 'hospital', label: 'โรงพยาบาล', icon: Hospital },
  { value: 'clinic', label: 'รพ.สต. / คลินิก', icon: Stethoscope },
  { value: 'temporary_health_post', label: 'หน่วยบริการด่านหน้า', icon: Building2 },
]

const PROVINCE_CENTER: Record<string, [number, number]> = {
  'น่าน':       [18.784, 100.772],
  'เชียงใหม่':  [18.789,  98.974],
  'เชียงราย':   [19.908,  99.831],
  'แม่ฮ่องสอน': [19.301,  97.970],
  'ลำพูน':      [18.574,  99.009],
  'ลำปาง':      [18.289,  99.490],
  'แพร่':       [18.144, 100.140],
  'พะเยา':      [19.166, 100.200],
}

function provinceCenter(province: string | null): [number, number] {
  if (province && PROVINCE_CENTER[province]) return PROVINCE_CENTER[province]
  return [13.75, 100.50]
}

interface Props {
  isNational: boolean
  defaultProvince: string | null
}

export function AddFacilityButton({ isNational, defaultProvince }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="gx-btn gx-btn-primary">
        <Plus size={16} strokeWidth={2} /> เพิ่มสถานพยาบาล
      </button>
      {open && (
        <AddFacilityModal
          isNational={isNational}
          defaultProvince={defaultProvince}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function AddFacilityModal({ isNational, defaultProvince, onClose }: Props & { onClose: () => void }) {
  const router = useRouter()
  const [type, setType] = useState('hospital')
  const [name, setName] = useState('')
  const [province, setProvince] = useState(defaultProvince ?? '')
  const [amphoe, setAmphoe] = useState('')
  const [tambon, setTambon] = useState('')
  const [capacity, setCapacity] = useState('')
  const [contact, setContact] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [center] = useState<[number, number]>(() => provinceCenter(defaultProvince))
  const [lat, setLat] = useState(center[0])
  const [lng, setLng] = useState(center[1])
  const [pinMoved, setPinMoved] = useState(false)

  function handlePinChange(newLat: number, newLng: number) {
    setLat(newLat)
    setLng(newLng)
    setPinMoved(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('ต้องระบุชื่อ'); return }
    if (!pinMoved) { setError('กรุณาปักหมุดตำแหน่งบนแผนที่ก่อน'); return }
    if (isNational && !province.trim()) { setError('ต้องระบุจังหวัด'); return }

    setSaving(true); setError(null)
    const res = await fetch('/api/infra', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type,
        name: name.trim(),
        province: province.trim() || undefined,
        amphoe: amphoe.trim() || undefined,
        tambon: tambon.trim() || undefined,
        lat,
        lng,
        capacity: capacity ? Number(capacity) : undefined,
        contact: contact.trim() || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({})))?.error ?? 'บันทึกไม่สำเร็จ'); return }
    router.refresh()
    onClose()
  }

  const fieldCls = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-3.5">
          <h2 className="text-base font-semibold">เพิ่มสถานพยาบาล</h2>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 overflow-y-auto p-5">
          {/* ประเภท */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]">ประเภท</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
                    type === value
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ชื่อ */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">ชื่อสถานพยาบาล <span className="text-[var(--risk-critical)]">*</span></label>
            <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น โรงพยาบาลแม่สาย" />
          </div>

          {/* จังหวัด */}
          {isNational ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">จังหวัด <span className="text-[var(--risk-critical)]">*</span></label>
              <input className={fieldCls} value={province} onChange={(e) => setProvince(e.target.value)} placeholder="เช่น เชียงราย" />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">จังหวัด</label>
              <input className={`${fieldCls} opacity-60`} value={province} readOnly />
            </div>
          )}

          {/* อำเภอ / ตำบล */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">อำเภอ</label>
              <input className={fieldCls} value={amphoe} onChange={(e) => setAmphoe(e.target.value)} placeholder="เช่น แม่สาย" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">ตำบล</label>
              <input className={fieldCls} value={tambon} onChange={(e) => setTambon(e.target.value)} placeholder="เช่น เวียงพางคำ" />
            </div>
          </div>

          {/* แผนที่ปักหมุด */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">
              ตำแหน่ง <span className="text-[var(--risk-critical)]">*</span>
              <span className="ml-1 font-normal text-[var(--fg-subtle)]">— คลิกหรือลากหมุดเพื่อกำหนดจุด</span>
            </label>
            <LocationPicker lat={lat} lng={lng} onChange={handlePinChange} heightClass="h-[240px]" />
            <p className={`mt-1 font-mono text-[11px] ${pinMoved ? 'text-[var(--fg-muted)]' : 'text-[var(--fg-subtle)]'}`}>
              {pinMoved
                ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                : 'ยังไม่ได้ปักหมุด'}
            </p>
          </div>

          {/* ความจุ / เบอร์ติดต่อ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">ความจุ (เตียง)</label>
              <input className={fieldCls} type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="120" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">เบอร์ติดต่อ</label>
              <input className={fieldCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="053-711300" />
            </div>
          </div>

          {error && <p className="rounded-lg bg-[var(--risk-critical)]/10 px-3 py-2 text-xs text-[var(--risk-critical)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="gx-btn gx-btn-ghost">ยกเลิก</button>
            <button type="submit" disabled={saving} className="gx-btn gx-btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
