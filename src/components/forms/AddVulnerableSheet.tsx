'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { UserPlus, MapPin, Crosshair, Lock, Loader2, Wind } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LocationPicker = dynamic(
  () => import('@/components/forms/LocationPicker').then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-[200px] w-full animate-pulse rounded-md bg-[var(--bg-sunken)]" /> },
)

export interface AddVulnerableArea {
  village: string | null
  tambon: string | null
  amphoe: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
  /** พื้นที่ตั้งต้นจากเหตุการณ์ที่กำลังจัดการ (prefill) */
  area: AddVulnerableArea
  /** จังหวัดสังกัด (ล็อกสำหรับ non-national) */
  province: string | null
  isNational: boolean
  provinceOptions: string[]
  /** จุดกึ่งกลางแผนที่ตั้งต้น (พื้นที่เหตุการณ์) */
  defaultCenter: { lat: number; lng: number }
  incidentName: string | null
}

const TYPES = [
  { value: 'bedridden', label: 'ติดเตียง' },
  { value: 'elderly', label: 'ผู้สูงอายุติดบ้าน' },
  { value: 'disabled', label: 'พิการ' },
  { value: 'pregnant', label: 'ตั้งครรภ์' },
  { value: 'other', label: 'อื่นๆ' },
]

const PREFIXES = ['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.']

const PRIORITIES = [
  { value: 'A', label: 'A · วิกฤต' },
  { value: 'B', label: 'B · เร่งด่วน' },
  { value: 'C', label: 'C · เฝ้าระวัง' },
]

const LIFE_SUPPORT = [
  { value: 'oxygen', label: 'ออกซิเจน' },
  { value: 'dialysis_capd', label: 'ฟอกไต (CAPD)' },
  { value: 'dialysis_hd', label: 'ฟอกไตเลือด (HD)' },
  { value: 'ventilator', label: 'เครื่องช่วยหายใจ' },
  { value: 'anti_seizure', label: 'ยากันชัก' },
  { value: 'feeding_tube', label: 'สายให้อาหาร' },
]

const selectCls =
  'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)]'

export function AddVulnerableSheet({
  open, onClose, onDone, area, province, isNational, provinceOptions, defaultCenter, incidentName,
}: Props) {
  const [prefix, setPrefix] = useState('นาย')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState('')
  const [type, setType] = useState('bedridden')
  const [lifeSupport, setLifeSupport] = useState<string[]>([])
  const [medicalPriority, setMedicalPriority] = useState('C')
  const [caregiverPhone, setCaregiverPhone] = useState('')
  const [careUnit, setCareUnit] = useState('')
  const [village, setVillage] = useState(area.village ?? '')
  const [tambon, setTambon] = useState(area.tambon ?? '')
  const [amphoe, setAmphoe] = useState(area.amphoe ?? '')
  const [formProvince, setFormProvince] = useState(isNational ? '' : (province ?? ''))
  const [lat, setLat] = useState(defaultCenter.lat)
  const [lng, setLng] = useState(defaultCenter.lng)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)

  const toggleLS = (code: string) =>
    setLifeSupport((v) => (v.includes(code) ? v.filter((x) => x !== code) : [...v, code]))

  function useGps() {
    if (!navigator.geolocation) return
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGeoBusy(false) },
      () => { setError('ดึงตำแหน่ง GPS ไม่สำเร็จ'); setGeoBusy(false) },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  async function submit() {
    if (submitting) return
    if (!firstName.trim() || !lastName.trim()) { setError('กรอกชื่อ-นามสกุล'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/vulnerable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix, firstName, lastName,
          age: age ? Number(age) : null,
          type, lifeSupport, medicalPriority,
          caregiverPhone: caregiverPhone.trim() || null,
          careUnit: careUnit.trim() || null,
          village: village.trim() || null,
          tambon: tambon.trim() || null,
          amphoe: amphoe.trim() || null,
          province: isNational ? formProvince : undefined, // non-national: server ล็อกจากสังกัด
          lat, lng,
          consent: true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'เพิ่มไม่สำเร็จ')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-[var(--border)]">
          <SheetTitle className="flex items-center gap-2">
            <UserPlus size={16} /> เพิ่มกลุ่มเปราะบาง
          </SheetTitle>
          <SheetDescription>
            {incidentName ? `ผูกพื้นที่เหตุการณ์: ${incidentName}` : 'เพิ่มเข้าทะเบียน (โหมดปกติ)'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* ชื่อ */}
          <div className="grid grid-cols-[88px_1fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>คำนำหน้า</Label>
              <select className={selectCls} value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                {PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อ</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ชื่อ" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_88px] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>นามสกุล</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="นามสกุล" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>อายุ</Label>
              <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="ปี" />
            </div>
          </div>

          {/* ประเภท + ความเร่งด่วน */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>ประเภท</Label>
              <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ความเร่งด่วน</Label>
              <select className={selectCls} value={medicalPriority} onChange={(e) => setMedicalPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* life support */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Wind size={13} className="text-[var(--risk-flood)]" /> อุปกรณ์พยุงชีพ
              <span className="font-normal text-[var(--fg-subtle)]">(ดันคะแนนความเสี่ยงในโหมดวิกฤต)</span>
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {LIFE_SUPPORT.map((o) => {
                const on = lifeSupport.includes(o.value)
                return (
                  <label key={o.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors ${
                      on
                        ? 'border-[color-mix(in_oklch,var(--risk-flood)_45%,transparent)] bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] font-medium text-[var(--risk-flood)]'
                        : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]'
                    }`}>
                    <input type="checkbox" checked={on} onChange={() => toggleLS(o.value)} className="accent-[var(--risk-flood)]" />
                    {o.label}
                  </label>
                )
              })}
            </div>
          </div>

          {/* ผู้ดูแล + หน่วยบริการ */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>เบอร์ผู้ดูแล</Label>
              <Input value={caregiverPhone} onChange={(e) => setCaregiverPhone(e.target.value)} inputMode="tel" placeholder="08x-xxx-xxxx" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>หน่วยบริการ</Label>
              <Input value={careUnit} onChange={(e) => setCareUnit(e.target.value)} placeholder="รพ.สต." />
            </div>
          </div>

          {/* ที่อยู่ */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>หมู่บ้าน/หมู่</Label>
              <Input value={village} onChange={(e) => setVillage(e.target.value)} placeholder="ม." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ตำบล</Label>
              <Input value={tambon} onChange={(e) => setTambon(e.target.value)} placeholder="ตำบล" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>อำเภอ</Label>
              <Input value={amphoe} onChange={(e) => setAmphoe(e.target.value)} placeholder="อำเภอ" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>จังหวัด</Label>
            {isNational ? (
              <select className={selectCls} value={formProvince} onChange={(e) => setFormProvince(e.target.value)}>
                <option value="">— เลือกจังหวัด —</option>
                {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-3 text-[13px] text-[var(--fg-muted)]">
                <Lock size={12} className="text-[var(--fg-subtle)]" />{province ?? 'ไม่พบจังหวัดสังกัด'}
              </div>
            )}
          </div>

          {/* พิกัด */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><MapPin size={13} className="text-[var(--accent)]" /> พิกัด (คลิก/ลากหมุด)</Label>
              <button type="button" onClick={useGps} disabled={geoBusy}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] disabled:opacity-50">
                {geoBusy ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />} ใช้ GPS
              </button>
            </div>
            <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} />
            <p className="font-mono text-[10.5px] text-[var(--fg-subtle)]">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
          </div>

          {error && <p className="text-[12px] text-[var(--risk-flood)]">{error}</p>}
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>ยกเลิก</Button>
          <Button type="button" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังเพิ่ม…' : 'เพิ่มเข้าทะเบียน'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
