'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'

const noopSubscribe = () => () => {}
/** อ่าน window.location.origin แบบ SSR-safe (server → '', client → origin) ไม่มี hydration mismatch */
export function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '')
}

/** สร้าง QR เป็น data URL (offline ไม่ยิงข้อมูลออกนอก) — คืน '' ระหว่างกำลังสร้าง */
export function useReportQr(url: string, pixels = 480): string {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, { margin: 1, width: pixels, errorCorrectionLevel: 'M' })
      .then((d) => { if (alive) setSrc(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [url, pixels])
  return src
}

export function ReportQR({ url, size = 220, className = '' }: { url: string; size?: number; className?: string }) {
  const src = useReportQr(url, size * 2)
  if (!src) {
    return <div style={{ width: size, height: size }} className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={`QR สำหรับ ${url}`} className={className} />
}

/** ดาวน์โหลด QR เป็นไฟล์ PNG */
export async function downloadReportQr(url: string, filename = 'qr-report.png', pixels = 1024) {
  const dataUrl = await QRCode.toDataURL(url, { margin: 2, width: pixels, errorCorrectionLevel: 'M' })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
