'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  LifeBuoy, MapPin, CheckCircle2, Phone, AlertTriangle, Loader2, Maximize2,
  X as XIcon, Check, Home, HeartPulse, ShieldAlert, Soup, Warehouse,
  HelpCircle, User, MessageSquare, ArrowLeft, ArrowRight, Sparkles, AlertCircle
} from 'lucide-react'
import { REQUEST_TYPE_OPTIONS } from '@/lib/help-request-labels'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import type { HelpRequestType } from '@/types'

const LocationPicker = dynamic(
  () => import('@/components/forms/LocationPicker').then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-[180px] w-full animate-pulse rounded-2xl bg-slate-100" /> },
)

// ศูนย์กลางเริ่มต้น — อ.แม่สาย จ.เชียงราย (บริบทน้ำท่วมหลัก)
const DEFAULT_LAT = 20.4275
const DEFAULT_LNG = 99.8826

const OPTION_STYLES: Record<HelpRequestType, {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  bgLight: string;
  borderActive: string;
}> = {
  evacuation: {
    icon: Home,
    color: 'text-sky-600 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/30',
    borderActive: 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20',
  },
  medical: {
    icon: HeartPulse,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderActive: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20',
  },
  rescue: {
    icon: ShieldAlert,
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/30',
    borderActive: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20',
  },
  supplies: {
    icon: Soup,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    borderActive: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20',
  },
  shelter: {
    icon: Warehouse,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderActive: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20',
  },
  other: {
    icon: HelpCircle,
    color: 'text-slate-600 dark:text-slate-400',
    bgLight: 'bg-slate-50 dark:bg-slate-900/30',
    borderActive: 'border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/50 dark:bg-slate-900/20',
  },
}

export function ReportForm() {
  const [step, setStep] = useState(1)
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

  const handleCategorySelect = (val: HelpRequestType) => {
    setRequestType(val)
    setTimeout(() => {
      setStep(2)
    }, 250)
  }

  const nextStep = () => {
    if (step === 1 && requestType) setStep(2)
    else if (step === 2 && phoneValid) setStep(3)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-12">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        @keyframes wave-flow {
          0% { transform: translateX(0) scaleY(1); }
          50% { transform: translateX(-25%) scaleY(0.85); }
          100% { transform: translateX(-50%) scaleY(1); }
        }
        .wave-animation {
          animation: wave-flow 15s linear infinite;
        }
        .wave-animation-slow {
          animation: wave-flow 22s linear infinite;
          opacity: 0.3;
        }
        @keyframes scale-up {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scale-up 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-stretch">
        {/* ───── Left Panel: Illustration & Help Message ───── */}
        <div className="md:col-span-5 flex flex-col justify-between relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 p-6 md:p-8 text-white shadow-xl min-h-[380px] md:min-h-[580px]">
          {/* Decorative background gradients */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-700/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

          {/* Logo / Header tag */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Sparkles size={13} className="text-amber-300" />
              <span>ศูนย์รับแจ้งเหตุประสานงานกู้ภัยน้ำท่วม</span>
            </div>
            <h2 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
              แจ้งขอความช่วยเหลือ <br/>ผ่านระบบ FloodWatch
            </h2>
            <p className="mt-2 text-xs md:text-sm text-sky-50 font-light max-w-ch leading-relaxed">
              กรอกข้อมูลความต้องการของคุณในระบบนี้ ข้อมูลจะส่งตรงไปยังทีมกู้ภัยและเจ้าหน้าที่เคลื่อนที่ในพื้นที่ทันที เพื่อดำเนินการคัดกรองความเร่งด่วนและประสานงานเข้าช่วยเหลืออย่างเร่งด่วน
            </p>
          </div>

          {/* Friendly vector illustration */}
          <div className="relative z-10 my-4 flex justify-center items-center flex-1">
            <img
              src="/images/flood_help_illustration.png"
              alt="ช่วยเหลือภัยน้ำท่วม"
              className="w-full max-w-[240px] md:max-w-[280px] h-auto object-contain animate-float drop-shadow-md"
            />
          </div>

          {/* Hotline / Security note */}
          <div className="relative z-10 space-y-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3.5 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <Phone size={18} className="mt-0.5 shrink-0 text-amber-300 animate-pulse" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-200">สายด่วนช่วยเหลือเฉพาะหน้า (24 ชม.)</p>
                  <p className="text-sky-100">เจ็บป่วยฉุกเฉิน/โรงพยาบาล: โทร <a href="tel:1669" className="font-bold text-white underline">1669</a></p>
                  <p className="text-sky-100 font-light">ปภ. สายด่วนสาธารณภัย: โทร <a href="tel:1784" className="font-bold text-white underline">1784</a></p>
                </div>
              </div>
            </div>

            <p className="text-center md:text-left text-[10px] text-sky-100/60 font-light">
              * ข้อมูลของท่านจะใช้เฉพาะเพื่อช่วยชีวิตและติดต่อประสานงานกู้ภัยตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </p>
          </div>

          {/* Wave animation decorative background overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none overflow-hidden select-none z-0">
            <svg className="absolute w-[200%] h-full bottom-0 left-0 wave-animation text-sky-500/20 fill-current" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,60 C150,90 350,30 500,60 C650,90 850,30 1000,60 C1150,90 1350,30 1500,60 C1650,90 1850,30 2000,60 L2000,120 L0,120 Z" />
            </svg>
            <svg className="absolute w-[200%] h-full bottom-0 left-0 wave-animation-slow text-blue-700/10 fill-current" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,50 C180,80 300,20 480,50 C660,80 780,20 960,50 C1140,80 1260,20 1440,50 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* ───── Right Panel: Step-by-Step Form & Dialogs ───── */}
        <div className="md:col-span-7 flex flex-col">
          <div className="gx-card p-6 md:p-8 flex flex-col justify-between min-h-[460px] md:min-h-[580px] relative">
            
            {doneId ? (
              /* Success State */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 animate-card-swap">
                <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 shadow-sm border border-emerald-100 dark:border-emerald-900/50">
                  <CheckCircle2 size={36} className="animate-scale-up" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800">บันทึกคำร้องสำเร็จ</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-500 max-w-sm">
                  เจ้าหน้าที่กู้ภัยและผู้ประสานงานในพื้นที่กำลังคัดกรองข้อมูล และจะติดต่อกลับที่เบอร์ <span className="font-bold text-slate-800">{reporterPhone}</span> โดยเร็วที่สุด
                </p>

                <div className="w-full mt-6 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-left text-xs text-amber-800">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-900">กรณีภัยอันตรายถึงชีวิต</p>
                    <p className="leading-normal">หากสถานการณ์แย่ลงอย่างรวดเร็วและเป็นอันตรายถึงแก่ชีวิตเฉพาะหน้า กรุณาติดต่อสายด่วนแพทย์ฉุกเฉิน <a href="tel:1669" className="font-bold underline hover:text-amber-950">1669</a> หรือ ปภ. <a href="tel:1784" className="font-bold underline hover:text-amber-950">1784</a> โดยตรงทันที</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDoneId(null)
                    setRequestType(null)
                    setReporterPhone('')
                    setReporterName('')
                    setDescription('')
                    setPeopleCount('')
                    setAddressText('')
                    setUsePin(false)
                    setStep(1)
                  }}
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700 underline-offset-4 hover:underline"
                >
                  <Sparkles size={15} /> ต้องการแจ้งขอความช่วยเหลืออีกครั้ง คลิกที่นี่
                </button>
              </div>
            ) : (
              /* Wizard Steps */
              <>
                {/* Steps indicator progress bar */}
                <div className="mb-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          s === step ? 'w-8 bg-sky-600' : s < step ? 'w-2 bg-sky-600/50' : 'w-2 bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-400">ขั้นตอนที่ {step} / 3</span>
                </div>

                {/* Form Step Body with dynamic mount key */}
                <div key={step} className="animate-card-swap flex-1 flex flex-col justify-between">
                  {step === 1 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <LifeBuoy className="text-sky-600" size={20} />
                        1. ต้องการความช่วยเหลือเรื่องอะไรครับ? <span className="text-rose-500">*</span>
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">โปรดระบุหมวดหมู่ความต้องการหลักของท่านเพื่อให้ศูนย์จัดเตรียมทีมเข้าช่วยเหลือได้ตรงจุด</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {REQUEST_TYPE_OPTIONS.map((o) => {
                          const isSelected = requestType === o.value
                          const styles = OPTION_STYLES[o.value]
                          const IconComponent = styles.icon

                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => handleCategorySelect(o.value)}
                              className={`group relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? styles.borderActive + ' shadow-sm bg-sky-50/10'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                              }`}
                            >
                              {isSelected && (
                                <span className="absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full bg-sky-600 text-white shadow-xs animate-scale-up">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              )}

                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-xl shrink-0 transition-colors ${styles.bgLight} ${styles.color} group-hover:scale-105 duration-200`}>
                                  <IconComponent size={20} />
                                </div>
                                <div className="pr-4">
                                  <span className={`block text-[14px] font-bold ${isSelected ? 'text-sky-700 dark:text-sky-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {o.label}
                                  </span>
                                  <span className="mt-1 block text-[11px] leading-normal text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">
                                    {o.hint}
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Phone className="text-sky-600" size={20} />
                        2. ข้อมูลเบอร์ติดต่อและรายละเอียดเหตุการณ์
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">ข้อมูลสำหรับเจ้าหน้าที่ติดต่อกลับและข้อมูลเบื้องต้นเกี่ยวกับผู้ประสบภัย</p>

                      <div className="space-y-4">
                        {/* Phone */}
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            เบอร์โทรศัพท์ติดต่อกลับ <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input
                              type="tel"
                              inputMode="tel"
                              value={reporterPhone}
                              onChange={(e) => setReporterPhone(e.target.value)}
                              placeholder="กรอกเบอร์โทรศัพท์ (เช่น 0891234567)"
                              className={`w-full rounded-2xl border pl-12 pr-12 py-3.5 text-[15px] outline-hidden focus:ring-1 transition-all ${
                                reporterPhone.trim() === ''
                                  ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-sky-500 focus:ring-sky-500'
                                  : phoneValid
                                  ? 'border-emerald-400 bg-emerald-50/5 dark:bg-emerald-950/10 focus:border-emerald-500 focus:ring-emerald-500'
                                  : 'border-rose-300 bg-rose-50/5 dark:bg-rose-950/10 focus:border-rose-500 focus:ring-rose-500'
                              }`}
                            />
                            {phoneValid && (
                              <Check className="absolute right-4 top-3.5 text-emerald-500" size={18} strokeWidth={3} />
                            )}
                            {!phoneValid && reporterPhone.trim().length > 0 && (
                              <AlertCircle className="absolute right-4 top-3.5 text-rose-500 animate-pulse" size={18} />
                            )}
                          </div>
                          {!phoneValid && reporterPhone.trim().length > 0 && (
                            <p className="mt-1.5 text-xs text-rose-500">กรุณากรอกเบอร์โทรศัพท์ติดต่อให้ถูกต้อง (6-20 หลัก)</p>
                          )}
                        </div>

                        {/* Name */}
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            ชื่อผู้แจ้งเหตุ (ไม่บังคับ)
                          </label>
                          <div className="relative">
                            <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <input
                              type="text"
                              value={reporterName}
                              onChange={(e) => setReporterName(e.target.value)}
                              placeholder="ระบุชื่อจริง หรือชื่อเล่นผู้ประสานงาน"
                              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-12 pr-4 py-3.5 text-[15px] outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            รายละเอียดเหตุการณ์เพิ่มเติม
                          </label>
                          <div className="relative">
                            <MessageSquare className="absolute left-4 top-3.5 text-slate-400" size={18} />
                            <textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              rows={3}
                              placeholder="เช่น น้ำท่วมถึงระดับอก มีผู้ป่วยติดเตียงและผู้สูงอายุติดอยู่ภายในบ้านชั้น 2 จำนวน 2 ท่าน ต้องการความช่วยเหลือด่วน"
                              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-12 pr-4 py-3.5 text-[15px] outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none transition-all text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                              จำนวนผู้ประสบภัย
                            </label>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={peopleCount}
                              onChange={(e) => setPeopleCount(e.target.value)}
                              placeholder="ระบุตัวเลข (เช่น 3)"
                              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-[15px] outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-800 dark:text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                              จังหวัดที่เกิดภัย
                            </label>
                            <select
                              value={province}
                              onChange={(e) => setProvince(e.target.value)}
                              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-[15px] outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-800 dark:text-slate-200"
                            >
                              <option value="">— เลือกจังหวัด —</option>
                              {ALLOWED_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <MapPin className="text-sky-600" size={20} />
                        3. ระบุตำแหน่งและที่อยู่ที่พบเหตุ
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">ที่อยู่อย่างละเอียดและพิกัดหมุดบนแผนที่ เพื่อให้เรือกู้ภัยและเจ้าหน้าที่นำทางไปพบโดยเร็วที่สุด</p>

                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            ข้อมูลที่อยู่ / จุดสังเกตในพื้นที่
                          </label>
                          <input
                            type="text"
                            value={addressText}
                            onChange={(e) => setAddressText(e.target.value)}
                            placeholder="บ้านเลขที่ หมู่บ้าน ซอย ตำบล หรือจุดเด่นสังเกตเห็นง่าย (เช่น หลังวัด...)"
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-[15px] outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-800 dark:text-slate-200"
                          />
                        </div>

                        {/* Map Picker Widget */}
                        <div className="rounded-2xl border border-slate-150 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950 p-4">
                          {!usePin ? (
                            <div className="text-center py-6">
                              <MapPin className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">ระบุพิกัดลงบนแผนที่ (แนะนำอย่างยิ่ง)</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">การปักพิกัด GPS จะช่วยลดความผิดพลาดในการค้นหาบ้านท่ามกลางพื้นที่น้ำท่วมได้สูงสุด</p>
                              <button
                                type="button"
                                onClick={() => setUsePin(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-900 px-4 py-2.5 text-xs font-bold text-sky-700 dark:text-sky-400 transition-colors cursor-pointer"
                              >
                                <MapPin size={14} /> เปิดแผนที่เพื่อปักหมุดตำแหน่ง
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                  <MapPin size={14} className="text-sky-600 animate-pulse" /> เลื่อนแผนที่และกดปักหมุดตรงพิกัดของคุณ
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setUsePin(false)}
                                  className="text-xs font-medium text-slate-400 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                >
                                  ไม่ปักหมุดพิกัด
                                </button>
                              </div>
                              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                                <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} heightClass="h-[160px]" />
                                <button
                                  type="button"
                                  onClick={() => setMapExpanded(true)}
                                  className="absolute right-2.5 top-2.5 z-[1000] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs backdrop-blur hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Maximize2 size={13} /> ขยายเต็มหน้าจอ
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">สามารถขยายขนาดเต็มหน้าจอเพื่อกดค้นหาพิกัดบ้านและปักหมุดได้อย่างแม่นยำยิ่งขึ้น</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="mt-4 rounded-xl border border-rose-200 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <AlertCircle size={15} /> {error}
                    </p>
                  )}
                </div>

                {/* Form Action Buttons */}
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="gx-btn gx-btn-ghost flex-1 py-3 text-slate-600 dark:text-slate-300 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <ArrowLeft size={16} /> ย้อนกลับ
                    </button>
                  ) : (
                    <div className="flex-1" />
                  )}

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={step === 1 ? !requestType : !phoneValid}
                      className="gx-btn gx-btn-primary flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ถัดไป <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={submitting}
                      className="gx-btn gx-btn-primary flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> กำลังส่ง...
                        </>
                      ) : (
                        <>
                          <LifeBuoy size={16} /> ส่งขอความช่วยเหลือ
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
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

          </div>
        </div>
      </div>

      {/* Fullscreen Map Dialog Overlay (ใช้ lat/lng ชุดเดียวกับ LocationPicker) */}
      {mapExpanded && (
        <div className="fixed inset-0 z-[1200] flex flex-col bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-900">
            <span className="inline-flex items-center gap-2 text-[15px] font-bold text-slate-800 dark:text-slate-200">
              <MapPin size={18} className="text-sky-600" /> ปักหมุดตำแหน่งของคุณ
            </span>
            <button
              type="button"
              onClick={() => setMapExpanded(false)}
              aria-label="ปิดแผนที่"
              className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <XIcon size={20} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} heightClass="h-full" />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
            <p className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">แตะหรือลากหมุดไปยังพิกัดบ้านหรือตำแหน่งที่ต้องการให้เจ้าหน้าที่ไปรับ</p>
            <button
              type="button"
              onClick={() => setMapExpanded(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-3.5 text-[15px] font-bold text-white cursor-pointer"
            >
              <Check size={18} /> ยืนยันใช้ตำแหน่งนี้
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
