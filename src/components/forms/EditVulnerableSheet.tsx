'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { Pencil, MapPin, Crosshair, Lock, Loader2, Wind, Maximize2, X, Check } from 'lucide-react'
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

interface Props {
  personId: string
  open: boolean
  onClose: () => void
  onDone: () => void
  isNational: boolean
  /** จังหวัดสังกัดผู้ใช้ (ล็อกสำหรับ non-national) */
  userProvince: string | null
  defaultCenter: { lat: number; lng: number }
}

const TYPES = [
  { value: 'bedridden', label: 'ติดเตียง' },
  { value: 'elderly', label: 'ผู้สูงอายุติดบ้าน' },
  { value: 'disabled', label: 'พิการ' },
  { value: 'pregnant', label: 'ตั้งครรภ์' },
  { value: 'other', label: 'อื่นๆ' },
]

const PREFIXES = ['ไม่ระบุ', 'นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.']

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
  'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--bg-sunken)] disabled:opacity-60'

interface GeoOpt {
  id: number
  nameTh: string
}

export function EditVulnerableSheet({
  personId, open, onClose, onDone, isNational, userProvince, defaultCenter,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [prefix, setPrefix] = useState('นาย')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState('')
  const [type, setType] = useState('bedridden')
  const [cond, setCond] = useState('')
  const [lifeSupport, setLifeSupport] = useState<string[]>([])
  const [medicalPriority, setMedicalPriority] = useState('C')
  const [caregiverPhone, setCaregiverPhone] = useState('')
  const [careUnit, setCareUnit] = useState('')
  const [village, setVillage] = useState('')
  const [tambon, setTambon] = useState('')
  const [amphoe, setAmphoe] = useState('')
  const [formProvince, setFormProvince] = useState('')
  const [lat, setLat] = useState(defaultCenter.lat)
  const [lng, setLng] = useState(defaultCenter.lng)

  const [provinces, setProvinces] = useState<GeoOpt[]>([])
  const [districts, setDistricts] = useState<GeoOpt[]>([])
  const [subdistricts, setSubdistricts] = useState<GeoOpt[]>([])
  const [provinceId, setProvinceId] = useState<number | ''>('')
  const [districtId, setDistrictId] = useState<number | ''>('')
  const [subdistrictId, setSubdistrictId] = useState<number | ''>('')

  const prefillDone = useRef(false)
  const pendingAmphoe = useRef('')
  const pendingTambon = useRef('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)

  useEffect(() => {
    if (!mapExpanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapExpanded(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapExpanded])

  // โหลดข้อมูลคนเมื่อ open
  useEffect(() => {
    if (!open) return
    prefillDone.current = false
    setLoading(true)
    setError(null)
    fetch(`/api/vulnerable/${personId}`)
      .then((r) => r.json())
      .then((j) => {
        const d = j.data
        if (!d) throw new Error('ไม่พบข้อมูล')
        setPrefix(d.prefix ?? 'ไม่ระบุ')
        setFirstName(d.firstName ?? '')
        setLastName(d.lastName ?? '')
        setAge(d.age != null ? String(d.age) : '')
        setType(d.type ?? 'bedridden')
        setCond(d.cond ?? '')
        setLifeSupport(d.lifeSupport ?? [])
        setMedicalPriority(d.medicalPriority ?? 'C')
        setCaregiverPhone(d.caregiverPhone ?? '')
        setCareUnit(d.careUnit ?? '')
        setVillage(d.village ?? '')
        setTambon(d.tambon ?? '')
        setAmphoe(d.amphoe ?? '')
        setFormProvince(d.province ?? (isNational ? '' : (userProvince ?? '')))
        setLat(d.lat ?? defaultCenter.lat)
        setLng(d.lng ?? defaultCenter.lng)
        pendingAmphoe.current = d.amphoe ?? ''
        pendingTambon.current = d.tambon ?? ''
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, personId]) // eslint-disable-line react-hooks/exhaustive-deps

  // โหลดรายการจังหวัด
  useEffect(() => {
    fetch('/api/geo/provinces', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setProvinces(d) })
      .catch(() => {})
  }, [])

  // resolve provinceId จาก formProvince
  useEffect(() => {
    if (provinces.length === 0 || !formProvince || provinceId !== '') return
    const p = provinces.find((o) => o.nameTh === formProvince)
    if (p) {
      setProvinceId(p.id)
      fetch(`/api/geo/districts?provinceId=${p.id}`)
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setDistricts(d) })
        .catch(() => {})
    }
  }, [provinces, formProvince]) // eslint-disable-line react-hooks/exhaustive-deps

  // resolve districtId จาก amphoe
  useEffect(() => {
    if (districts.length === 0 || !pendingAmphoe.current || districtId !== '') return
    const d = districts.find((o) => o.nameTh === pendingAmphoe.current)
    if (d) {
      setDistrictId(d.id)
      fetch(`/api/geo/subdistricts?districtId=${d.id}`)
        .then((r) => r.json())
        .then((sd) => { if (Array.isArray(sd)) setSubdistricts(sd) })
        .catch(() => {})
    }
  }, [districts]) // eslint-disable-line react-hooks/exhaustive-deps

  // resolve subdistrictId จาก tambon
  useEffect(() => {
    if (subdistricts.length === 0 || !pendingTambon.current || subdistrictId !== '') return
    const s = subdistricts.find((o) => o.nameTh === pendingTambon.current)
    if (s) {
      setSubdistrictId(s.id)
      prefillDone.current = true
    }
  }, [subdistricts]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadDistricts(pid: number) {
    fetch(`/api/geo/districts?provinceId=${pid}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setDistricts(d) })
      .catch(() => {})
  }
  function loadSubdistricts(did: number) {
    fetch(`/api/geo/subdistricts?districtId=${did}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSubdistricts(d) })
      .catch(() => {})
  }

  function onSelectProvince(id: number | '') {
    setProvinceId(id)
    setDistrictId(''); setSubdistrictId('')
    setDistricts([]); setSubdistricts([])
    setAmphoe(''); setTambon('')
    pendingAmphoe.current = ''; pendingTambon.current = ''
    setFormProvince(id === '' ? '' : (provinces.find((o) => o.id === id)?.nameTh ?? ''))
    if (id !== '') loadDistricts(id)
  }
  function onSelectDistrict(id: number | '') {
    setDistrictId(id)
    setSubdistrictId(''); setSubdistricts([]); setTambon('')
    pendingTambon.current = ''
    setAmphoe(id === '' ? '' : (districts.find((o) => o.id === id)?.nameTh ?? ''))
    if (id !== '') loadSubdistricts(id)
  }
  function onSelectSubdistrict(id: number | '') {
    setSubdistrictId(id)
    setTambon(id === '' ? '' : (subdistricts.find((o) => o.id === id)?.nameTh ?? ''))
  }

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
      const res = await fetch(`/api/vulnerable/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: prefix === 'ไม่ระบุ' ? null : prefix,
          firstName, lastName,
          age: age ? Number(age) : null,
          type, cond: cond.trim() || null,
          lifeSupport, medicalPriority,
          caregiverPhone: caregiverPhone.trim() || null,
          careUnit: careUnit.trim() || null,
          village: village.trim() || null,
          tambon: tambon.trim() || null,
          amphoe: amphoe.trim() || null,
          province: isNational ? formProvince : undefined,
          lat, lng,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'แก้ไขไม่สำเร็จ')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full gap-0 sm:!w-[40vw] sm:!max-w-none sm:min-w-[480px]">
        <SheetHeader className="border-b border-[var(--border)]">
          <SheetTitle className="flex items-center gap-2">
            <Pencil size={16} /> แก้ไขข้อมูลกลุ่มเปราะบาง
          </SheetTitle>
          <SheetDescription>
            การแก้ไขทุกครั้งถูกบันทึก audit log
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--fg-subtle)]" />
          </div>
        ) : (
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

            {/* ภาวะ */}
            <div className="flex flex-col gap-1.5">
              <Label>ภาวะ / อาการ</Label>
              <Input value={cond} onChange={(e) => setCond(e.target.value)} placeholder="เช่น เบาหวาน ความดัน" />
            </div>

            {/* life support */}
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5">
                <Wind size={13} className="text-[var(--risk-flood)]" /> อุปกรณ์พยุงชีพ
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
            <div className="flex flex-col gap-1.5">
              <Label>จังหวัด</Label>
              {isNational ? (
                <select
                  className={selectCls}
                  value={provinceId === '' ? '' : String(provinceId)}
                  onChange={(e) => onSelectProvince(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">— เลือกจังหวัด —</option>
                  {provinces.map((p) => <option key={p.id} value={String(p.id)}>{p.nameTh}</option>)}
                </select>
              ) : (
                <div className="flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-3 text-[13px] text-[var(--fg-muted)]">
                  <Lock size={12} className="text-[var(--fg-subtle)]" />{formProvince || userProvince || 'ไม่พบจังหวัดสังกัด'}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>อำเภอ</Label>
                <select
                  className={selectCls}
                  value={districtId === '' ? '' : String(districtId)}
                  disabled={provinceId === ''}
                  onChange={(e) => onSelectDistrict(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">{provinceId === '' ? 'เลือกจังหวัดก่อน' : '— เลือกอำเภอ —'}</option>
                  {districts.map((d) => <option key={d.id} value={String(d.id)}>{d.nameTh}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>ตำบล</Label>
                <select
                  className={selectCls}
                  value={subdistrictId === '' ? '' : String(subdistrictId)}
                  disabled={districtId === ''}
                  onChange={(e) => onSelectSubdistrict(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">{districtId === '' ? 'เลือกอำเภอก่อน' : '— เลือกตำบล —'}</option>
                  {subdistricts.map((s) => <option key={s.id} value={String(s.id)}>{s.nameTh}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>หมู่บ้าน/หมู่</Label>
              <Input value={village} onChange={(e) => setVillage(e.target.value)} placeholder="เช่น ม.3 บ้านกลางเวียง" />
            </div>

            {/* พิกัด */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><MapPin size={13} className="text-[var(--accent)]" /> พิกัด (คลิก/ลากหมุด)</Label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setMapExpanded(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]">
                    <Maximize2 size={12} /> ขยายแผนที่
                  </button>
                  <button type="button" onClick={useGps} disabled={geoBusy}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] disabled:opacity-50">
                    {geoBusy ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />} ใช้ GPS
                  </button>
                </div>
              </div>
              <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} />
              <p className="font-mono text-[10.5px] text-[var(--fg-subtle)]">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
            </div>

            {error && <p className="text-[12px] text-[var(--risk-flood)]">{error}</p>}
          </div>
        )}

        <SheetFooter className="flex-row gap-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>ยกเลิก</Button>
          <Button type="button" className="flex-1" onClick={submit} disabled={submitting || loading}>
            {submitting ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
          </Button>
        </SheetFooter>
      </SheetContent>

      {mapExpanded && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[2000] flex flex-col bg-black/60 p-4 sm:p-8" onClick={() => setMapExpanded(false)}>
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[var(--bg)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[var(--accent)]" />
                <span className="text-[14px] font-semibold text-[var(--fg)]">ปักหมุดตำแหน่ง</span>
              </div>
              <button type="button" onClick={() => setMapExpanded(false)}
                className="rounded-md p-1.5 text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg)]">
                <X size={18} />
              </button>
            </div>
            <div className="relative flex-1 p-3">
              <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} heightClass="h-full" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={useGps} disabled={geoBusy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] disabled:opacity-50">
                  {geoBusy ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />} ใช้ GPS
                </button>
                <span className="font-mono text-[12px] text-[var(--fg-subtle)]">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              </div>
              <Button type="button" onClick={() => setMapExpanded(false)}>
                <Check size={15} /> ใช้ตำแหน่งนี้
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Sheet>
  )
}
