'use client'

import { Printer, LifeBuoy, Phone } from 'lucide-react'
import { ReportQR, useOrigin } from '@/components/report/ReportQR'

export function Poster() {
  const origin = useOrigin()
  const url = origin ? `${origin}/report` : ''
  const display = origin ? origin.replace(/^https?:\/\//, '') + '/report' : '…'

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      {/* print button — ซ่อนตอนพิมพ์ */}
      <div className="mx-auto mb-5 flex max-w-[210mm] justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          <Printer size={16} /> พิมพ์โปสเตอร์ (A4)
        </button>
      </div>

      {/* A4 sheet */}
      <article
        className="mx-auto flex max-w-[210mm] flex-col items-center rounded-2xl border border-slate-200 bg-white px-10 py-12 text-center shadow-sm print:rounded-none print:border-0 print:shadow-none"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1.5 text-sm font-semibold text-sky-700">
          <LifeBuoy size={16} /> ศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม
        </span>

        <h1 className="mt-6 text-[34px] font-bold leading-tight text-slate-800">
          ต้องการความช่วยเหลือ<br />จากน้ำท่วม?
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          สแกน QR นี้เพื่อแจ้งเจ้าหน้าที่ — บอกตำแหน่งและสิ่งที่ต้องการ
        </p>

        <div className="my-8 rounded-2xl border-2 border-slate-200 p-4">
          {url ? <ReportQR url={url} size={300} /> : <div className="size-[300px] animate-pulse rounded bg-slate-100" />}
        </div>

        <p className="text-base text-slate-500">หรือเปิดลิงก์</p>
        <p className="mt-1 font-mono text-xl font-semibold text-slate-800">{display}</p>

        <div className="mt-9 w-full max-w-md">
          <p className="mb-2 text-sm font-semibold text-rose-600">⚠ อันตรายถึงชีวิตเฉพาะหน้า โทรทันที</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-rose-50 px-4 py-3" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <p className="flex items-center justify-center gap-1.5 font-mono text-2xl font-bold text-rose-700"><Phone size={18} /> 1669</p>
              <p className="text-xs text-rose-600">การแพทย์ฉุกเฉิน</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <p className="flex items-center justify-center gap-1.5 font-mono text-2xl font-bold text-amber-700"><Phone size={18} /> 1784</p>
              <p className="text-xs text-amber-700">สายด่วน ปภ.</p>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-slate-400">
          ระบบภูมิสารสนเทศสุขภาพระดับหน้าด่าน · Spatial Health Registry &amp; Disaster Response
        </p>
      </article>
    </main>
  )
}
