'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LifeBuoy, MapPin, CheckCircle2, Phone, AlertTriangle, Loader2, Maximize2, X as XIcon, Check } from 'lucide-react'
import { REQUEST_TYPE_OPTIONS } from '@/lib/help-request-labels'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import type { HelpRequestType } from '@/types'

const LocationPicker = dynamic(
  () => import('@/components/forms/LocationPicker').then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl bg-slate-100" /> },
)

// ศูนย์กลางเริ่มต้น — อ.แม่สาย จ.เชียงราย (บริบทน้ำท่วมหลัก)
const DEFAULT_LAT = 20.4275
const DEFAULT_LNG = 99.8826

export function ReportForm() {
  const [requestType, setRequestType] = useState<HelpRequestType | null>(null)
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [description, setDescription] = useState('')
  const [peopleCount, setPeopleCount] = useState('')
  const [province, setProvince] = useState('')
  const [addressText, setAddressText] = useState('')
  const [usePin, setUsePin] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [website, setWebsite] = useState('') // honeypot

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const phoneValid = /^[0-9+\-\s]{6,20}$/.test(reporterPhone.trim())
  const canSubmit = !!requestType && phoneValid && !submitting

  async function submit() {
    if (!canSubmit) {
      setError(!requestType ? 'กรุณาเลือกประเภทความช่วยเหลือ' : 'กรุณากรอกเบอร์ติดต่อกลับให้ถูกต้อง')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/public-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim(),
          description: description.trim() || null,
          peopleCount: peopleCount ? Number(peopleCount) : null,
          province: province || null,
          addressText: addressText.trim() || null,
          lat: usePin ? lat : null,
          lng: usePin ? lng : null,
          website,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? 'ส่งคำร้องไม่สำเร็จ กรุณาลองใหม่')
        return
      }
      setDoneId(json?.id ?? 'ok')
    } catch {
      setError('เชื่อมต่อไม่ได้ กรุณาตรวจสอบสัญญาณแล้วลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  // ───── หน้าสำเร็จ ─────
  if (doneId) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={36} strokeWidth={2} />
        </div>
        <h1 className="text-xl font-bold text-slate-800">ส่งคำร้องเรียบร้อยแล้ว</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          เจ้าหน้าที่จะตรวจสอบและติดต่อกลับที่เบอร์ <span className="font-semibold text-slate-800">{reporterPhone}</span> โดยเร็วที่สุด
        </p>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>หากอยู่ในอันตรายถึงชีวิตเฉพาะหน้า โทร <a href="tel:1669" className="font-bold underline">1669</a> (การแพทย์ฉุกเฉิน) หรือ <a href="tel:1784" className="font-bold underline">1784</a> (สายด่วน ปภ.) ทันที</span>
        </div>
        <button
          type="button"
          onClick={() => { setDoneId(null); setRequestType(null); setDescription(''); setPeopleCount(''); setAddressText('') }}
          className="mt-6 text-sm font-medium text-sky-600 underline-offset-2 hover:underline"
        >
          แจ้งเหตุอีกครั้ง
        </button>
      </div>
    )
  }

  // ───── ฟอร์ม ─────
  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      {/* header */}
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-600 text-white shadow-sm">
          <LifeBuoy size={22} />
        </span>
        <div>
          <h1 className="text-lg font-bold leading-snug text-slate-800">แจ้งขอความช่วยเหลือ น้ำท่วม</h1>
          <p className="text-sm text-slate-500">กรอกข้อมูลสั้น ๆ เจ้าหน้าที่จะติดต่อกลับโดยเร็ว</p>
        </div>
      </div>

      {/* emergency hint */}
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
        <Phone size={16} className="mt-0.5 shrink-0" />
        <span>อันตรายถึงชีวิตเฉพาะหน้า โทร <a href="tel:1669" className="font-bold underline">1669</a> ทันที — ฟอร์มนี้สำหรับแจ้งเพื่อให้ทีมเข้าช่วยเหลือตามลำดับความเร่งด่วน</span>
      </div>

      {/* 1. ประเภท */}
      <label className="mb-2 block text-sm font-semibold text-slate-700">1. ต้องการความช่วยเหลือเรื่องอะไร <span className="text-rose-500">*</span></label>
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REQUEST_TYPE_OPTIONS.map((o) => {
          const on = requestType === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setRequestType(o.value)}
              className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                on ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={`block text-[14px] font-semibold ${on ? 'text-sky-700' : 'text-slate-800'}`}>{o.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{o.hint}</span>
            </button>
          )
        })}
      </div>

      {/* 2. เบอร์ + ชื่อ */}
      <label className="mb-2 block text-sm font-semibold text-slate-700">2. เบอร์โทรติดต่อกลับ <span className="text-rose-500">*</span></label>
      <input
        type="tel"
        inputMode="tel"
        value={reporterPhone}
        onChange={(e) => setReporterPhone(e.target.value)}
        placeholder="08X-XXX-XXXX"
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
      />
      <input
        value={reporterName}
        onChange={(e) => setReporterName(e.target.value)}
        placeholder="ชื่อผู้แจ้ง (ไม่บังคับ)"
        className="mb-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
      />

      {/* 3. รายละเอียด */}
      <label className="mb-2 block text-sm font-semibold text-slate-700">3. รายละเอียดเหตุการณ์</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="เช่น น้ำท่วมถึงเอว มีผู้สูงอายุติดเตียง 1 คน ออกเองไม่ได้"
        className="mb-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
      />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">จำนวนคนที่ต้องช่วย</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={peopleCount}
            onChange={(e) => setPeopleCount(e.target.value)}
            placeholder="เช่น 3"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">จังหวัด</label>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[15px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          >
            <option value="">— เลือก —</option>
            {ALLOWED_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* 4. ที่อยู่ */}
      <label className="mb-2 block text-sm font-semibold text-slate-700">4. ที่อยู่ / จุดที่ต้องการให้ไปช่วย</label>
      <input
        value={addressText}
        onChange={(e) => setAddressText(e.target.value)}
        placeholder="บ้านเลขที่ หมู่บ้าน ตำบล จุดสังเกต"
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
      />

      {/* ปักหมุดแผนที่ (ไม่บังคับ) */}
      {!usePin ? (
        <button
          type="button"
          onClick={() => setUsePin(true)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-sky-400 hover:text-sky-600"
        >
          <MapPin size={16} /> ปักหมุดตำแหน่งบนแผนที่ (ช่วยให้ทีมหาเจอเร็วขึ้น)
        </button>
      ) : (
        <div className="mb-6">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600"><MapPin size={15} className="text-sky-600" /> ลากหมุดไปยังจุดที่ต้องการ</span>
            <button type="button" onClick={() => setUsePin(false)} className="shrink-0 text-[13px] text-slate-400 hover:text-slate-600">เอาออก</button>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} heightClass="h-[220px]" />
            <button
              type="button"
              onClick={() => setMapExpanded(true)}
              className="absolute right-2.5 top-2.5 z-[1000] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white"
            >
              <Maximize2 size={15} /> ขยายแผนที่
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-slate-400">แตะ “ขยายแผนที่” เพื่อซูมหาตำแหน่งให้แม่นยำขึ้น</p>
        </div>
      )}

      {/* honeypot — ซ่อนจากคนจริง */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden
      />

      {error && (
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      {/* submit — sticky bottom */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <><Loader2 size={18} className="animate-spin" /> กำลังส่ง...</> : <><LifeBuoy size={18} /> ส่งคำร้องขอความช่วยเหลือ</>}
          </button>
        </div>
      </div>

      {/* แผนที่เต็มจอ — ปักหมุดแม่นยำ (ใช้ lat/lng ชุดเดียวกับด้านบน) */}
      {mapExpanded && (
        <div className="fixed inset-0 z-[1200] flex flex-col bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <MapPin size={18} className="text-sky-600" /> ปักหมุดตำแหน่งของคุณ
            </span>
            <button
              type="button"
              onClick={() => setMapExpanded(false)}
              aria-label="ปิดแผนที่"
              className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <XIcon size={20} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} heightClass="h-full" />
          </div>
          <div className="border-t border-slate-200 bg-white px-4 py-3">
            <p className="mb-2 text-center text-[13px] text-slate-500">แตะหรือลากหมุดไปยังตำแหน่งที่ต้องการให้ทีมไปช่วย</p>
            <button
              type="button"
              onClick={() => setMapExpanded(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-sky-700"
            >
              <Check size={18} /> ใช้ตำแหน่งนี้
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
