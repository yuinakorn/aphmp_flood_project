import { useState } from 'react'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'

interface Props {
  count: number
  onView: () => void
}

// แถบเตือนเชิงปฏิบัติการ — ผู้ป่วยกลุ่มวิกฤต (priority A) ที่อยู่ในเขตน้ำท่วม
// แบบย่อขนาดเป็นไอคอนปุ่มสีแดงพร้อมตัวเลขแจ้งเตือน และกดเพื่อขยายดูรายละเอียดได้
export function CriticalCaseBanner({ count, onView }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (count <= 0) return null

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[401] flex justify-end">
      {isOpen ? (
        // สถานะขยายข้อความเต็ม (Expanded)
        <div className="pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-lg border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_12%,var(--bg-elevated))] px-3 py-2 shadow-lg backdrop-blur transition-all duration-200">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--risk-flood)] text-white">
            <AlertTriangle className="size-3.5" strokeWidth={2} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[12.5px] font-semibold text-[var(--fg)]">
              ผู้ป่วยกลุ่มวิกฤต (A) ในเขตน้ำท่วม{' '}
              <span className="font-mono text-[var(--risk-flood)]">{count}</span> ราย
            </p>
            <p className="text-[11px] text-[var(--fg-muted)]">ต้องเร่งประเมิน/ประสานอพยพโดยด่วน</p>
          </div>
          <button
            type="button"
            onClick={onView}
            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--risk-flood)] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
          >
            ดูรายชื่อ <ArrowRight className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="ml-0.5 rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--border)] hover:text-[var(--fg)] transition-colors"
            title="ย่อขนาดการแจ้งเตือน"
            aria-label="ย่อขนาดการแจ้งเตือน"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : (
        // สถานะย่อขนาดเป็นไอคอนปุ่ม (Collapsed)
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto relative flex size-9 items-center justify-center rounded-full bg-[var(--risk-flood)] text-white shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 focus:outline-none"
          title={`มีผู้ป่วยกลุ่มวิกฤต (A) ในเขตน้ำท่วม ${count} ราย — คลิกเพื่อดูรายละเอียด`}
        >
          {/* วงแหวนสะท้อนกะพริบเพื่อดึงดูดสายตาอย่างนุ่มนวล */}
          <span className="absolute inset-0 rounded-full bg-[var(--risk-flood)] opacity-75 animate-ping" />
          <AlertTriangle className="relative size-[18px]" strokeWidth={2.2} />
          
          {/* ป้ายตัวเลขสีขาวขอบแดงแสดงจำนวนเคส */}
          <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold font-mono text-[var(--risk-flood)] shadow-sm border border-[var(--risk-flood)]">
            {count}
          </span>
        </button>
      )}
    </div>
  )
}
