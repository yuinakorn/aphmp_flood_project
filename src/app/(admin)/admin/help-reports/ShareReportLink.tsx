'use client'

import { useState } from 'react'
import { QrCode, X as XIcon, Copy, Check, Download, Printer, ExternalLink } from 'lucide-react'
import { ReportQR, downloadReportQr, useOrigin } from '@/components/report/ReportQR'

/** ปุ่ม + modal แชร์ลิงก์ฟอร์มแจ้งเหตุสาธารณะ (/report) ให้ประชาชน */
export function ShareReportLink() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const origin = useOrigin()

  const url = origin ? `${origin}/report` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard อาจถูกบล็อก — ผู้ใช้คัดลอกจากช่องเองได้ */
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="gx-btn gx-btn-primary gx-btn-sm">
        <QrCode size={15} /> แชร์ลิงก์แจ้งเหตุ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-[var(--accent)]" />
                <p className="text-sm font-semibold text-[var(--fg)]">ลิงก์แจ้งเหตุสำหรับประชาชน</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="gx-btn gx-btn-ghost gx-btn-sm" aria-label="ปิด">
                <XIcon size={15} />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="mb-4 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                ให้ประชาชนสแกน QR หรือเปิดลิงก์เพื่อแจ้งขอความช่วยเหลือเอง — คำร้องจะเข้ากล่อง “รอตรวจสอบ” นี้
              </p>

              <div className="flex justify-center">
                <div className="rounded-xl border border-[var(--border)] bg-white p-3">
                  {url ? <ReportQR url={url} size={200} /> : <div className="size-[200px] animate-pulse rounded bg-slate-100" />}
                </div>
              </div>

              {/* URL + copy */}
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[var(--fg)]">{url || '…'}</span>
                <button type="button" onClick={copy} disabled={!url} className="gx-btn gx-btn-ghost gx-btn-sm shrink-0">
                  {copied ? <><Check size={14} className="text-[var(--risk-safe)]" /> คัดลอกแล้ว</> : <><Copy size={14} /> คัดลอก</>}
                </button>
              </div>

              {/* actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadReportQr(url, 'qr-แจ้งเหตุน้ำท่วม.png')}
                  disabled={!url}
                  className="gx-btn gx-btn-ghost gx-btn-sm justify-center"
                >
                  <Download size={14} /> ดาวน์โหลด QR
                </button>
                <a
                  href="/report/poster"
                  target="_blank"
                  rel="noreferrer"
                  className="gx-btn gx-btn-ghost gx-btn-sm justify-center"
                >
                  <Printer size={14} /> โปสเตอร์พิมพ์
                </a>
              </div>

              <a
                href="/report"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                <ExternalLink size={13} /> เปิดหน้าฟอร์มเพื่อทดสอบ
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
