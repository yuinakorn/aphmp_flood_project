'use client'

import { Printer, LifeBuoy, Phone, ShieldAlert, Sparkles } from 'lucide-react'
import { ReportQR, useOrigin } from '@/components/report/ReportQR'

export function Poster() {
  const origin = useOrigin()
  const url = origin ? `${origin}/report` : ''
  const display = origin ? origin.replace(/^https?:\/\//, '') + '/report' : '…'

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-8 print:bg-white print:p-0 flex flex-col justify-start items-center">
      <style>{`
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
        .poster-sheet {
          min-height: 297mm;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body, html {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            min-height: 0 !important;
            height: auto !important;
          }
          .poster-sheet {
            border: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            min-height: 0 !important;
            height: auto !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Print action header (hidden during printing) */}
      <div className="w-full max-w-[210mm] mb-5 flex justify-between items-center print:hidden">
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-slate-800">เครื่องมือเตรียมสื่อประชาสัมพันธ์ (A4)</h1>
          <p className="text-[11px] text-slate-500 leading-normal">ดาวน์โหลดหรือพิมพ์เพื่อนำไปติดประกาศ ณ จุดพักพิง หรือศูนย์ประสานงานในพื้นที่</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 px-4.5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
        >
          <Printer size={15} /> พิมพ์โปสเตอร์ (A4)
        </button>
      </div>

      {/* A4 Sheet Poster Container */}
      <article
        className="poster-sheet w-full max-w-[210mm] flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 md:p-12 text-center shadow-md print:rounded-none print:border-0 print:shadow-none print:p-0 print:my-0"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        {/* Logos header row */}
        <div className="w-full flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_MOPH.svg" alt="กระทรวงสาธารณสุข" className="h-10 md:h-12 w-auto object-contain" />
            <div className="text-left">
              <p className="text-[11px] md:text-xs font-bold text-slate-800 tracking-wide">กระทรวงสาธารณสุข</p>
              <p className="text-[9px] md:text-[10px] text-slate-400">Ministry of Public Health</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-100 px-3.5 py-1.5 text-xs font-bold text-sky-700">
            <LifeBuoy size={13} className="text-sky-600 animate-spin-slow" />
            <span>FloodWatch</span>
          </div>
        </div>

        {/* Poster Header Banner */}
        <div className="w-full rounded-2xl bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 p-6 md:p-8 text-white mb-8 shadow-xs print:shadow-none print:border print:border-sky-600 print:bg-none print:text-slate-800">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight text-white print:text-slate-800">
            ต้องการความช่วยเหลือภัยน้ำท่วม?
          </h2>
          <p className="mt-2.5 text-xs md:text-sm text-sky-100 print:text-slate-500 font-light max-w-lg mx-auto leading-relaxed">
            สแกนคิวอาร์โค้ด (QR Code) ด้านล่างนี้เพื่อกรอกคำร้องผ่านโทรศัพท์มือถือ <br />
            (ต้องการอพยพ / ผู้เจ็บป่วยต้องการยา / ขาดแคลนอาหารน้ำดื่ม / หาที่พักพิงชั่วคราว)
          </p>
        </div>

        {/* Side-by-Side Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full max-w-3xl my-3 print:grid-cols-12 print:gap-8">
          
          {/* Left Side: Reassuring Illustration & Value Props */}
          <div className="md:col-span-5 print:col-span-5 flex flex-col items-center justify-center text-center">
            <img
              src="/images/flood_help_illustration.png"
              alt="ช่วยเหลือผู้ประสบภัย"
              className="w-full max-w-[170px] md:max-w-[210px] h-auto object-contain drop-shadow-sm mb-4"
            />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 justify-center">
              <Sparkles size={14} className="text-sky-600" /> สะดวก รวดเร็ว อุ่นใจ
            </h3>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed text-left max-w-[220px] mx-auto space-y-1">
              <span className="block">✓ ข้อมูลส่งตรงถึงเรือกู้ภัยและแพทย์ในพื้นที่</span>
              <span className="block">✓ ระบุตำแหน่งพิกัดแผนที่เพื่อการเดินทางที่แม่นยำ</span>
              <span className="block">✓ คัดกรองช่วยเหลือตามลำดับความเร่งด่วนทันที</span>
            </p>
          </div>

          {/* Right Side: QR Code Area */}
          <div className="md:col-span-7 print:col-span-7 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-8 print:border-l print:border-t-0 print:border-slate-150 print:pl-8">
            <div className="relative rounded-3xl border-4 border-slate-150 dark:border-slate-800 p-4 bg-white shadow-xs print:border-slate-300">
              {url ? <ReportQR url={url} size={220} className="rounded-xl" /> : <div className="size-[220px] animate-pulse rounded-2xl bg-slate-100" />}
            </div>
            
            <p className="mt-4 text-xs font-semibold text-slate-400">หรือพิมพ์ที่อยู่ลิงก์บนเบราว์เซอร์</p>
            <p className="mt-1 font-mono text-xs md:text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl select-all select-none">
              {display}
            </p>
          </div>

        </div>

        {/* Emergency Contacts Footer Panel */}
        <div className="mt-8 w-full max-w-xl border-t border-slate-100 dark:border-slate-800 pt-6">
          <p className="mb-3 text-xs font-bold text-rose-600 flex items-center gap-1.5 justify-center">
            <ShieldAlert size={15} className="animate-pulse" /> ⚠ หากอันตรายใกล้ตัวถึงแก่ชีวิต โทรเบอร์ตรงทันที
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-rose-50/60 border border-rose-100 dark:border-rose-950/20 p-3.5 text-center print:bg-none print:border-rose-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <p className="flex items-center justify-center gap-1.5 font-mono text-xl md:text-2xl font-extrabold text-rose-600"><Phone size={16} /> 1669</p>
              <p className="text-[10px] font-bold text-rose-500 mt-1">เจ็บป่วยฉุกเฉิน / กู้ชีพ</p>
            </div>
            <div className="rounded-2xl bg-amber-50/60 border border-amber-100 dark:border-amber-950/20 p-3.5 text-center print:bg-none print:border-amber-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <p className="flex items-center justify-center gap-1.5 font-mono text-xl md:text-2xl font-extrabold text-amber-600"><Phone size={16} /> 1784</p>
              <p className="text-[10px] font-bold text-amber-500 mt-1">สายด่วนภัยพิบัติ ปภ.</p>
            </div>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="mt-auto pt-8 text-[9px] text-slate-400 tracking-wider">
          ระบบภูมิสารสนเทศสุขภาพระดับหน้าด่าน • Spatial Health Registry &amp; Disaster Response
        </div>
      </article>
    </main>
  )
}
