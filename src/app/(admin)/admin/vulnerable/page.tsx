import { auth } from '@/lib/auth'
import { Plus, ShieldCheck } from 'lucide-react'
import { VulnerableTable } from './VulnerableTable'

export const metadata = { title: 'จัดการกลุ่มเปราะบาง — GIS Health Intelligence' }

export default async function VulnerablePage() {
  const session = await auth()
  const canEdit = ['admin', 'officer'].includes(session?.user?.role ?? '')

  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? 'http://localhost:3003'}/api/vulnerable`,
    { cache: 'no-store' },
  )
  const persons = await res.json().catch(() => [])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            ทะเบียน · PDPA-controlled
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">
            กลุ่มเปราะบาง
          </h1>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
            <span className="font-mono">{persons.length}</span> ราย · เข้าถึงทุกครั้งถูกบันทึก
            audit log
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12.5px] font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
          >
            <Plus size={14} strokeWidth={2} />
            เพิ่มรายการ
          </button>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2.5">
        <ShieldCheck
          size={14}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-[var(--signal-data)]"
        />
        <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
          ข้อมูลในหน้านี้คือข้อมูลส่วนบุคคลตาม PDPA
          เปิดเผยเฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต
          และทุกการดู/แก้ไขถูกบันทึกเวลา + ผู้ใช้
        </p>
      </div>

      <div className="mt-6">
        <VulnerableTable persons={persons} canEdit={canEdit} />
      </div>
    </div>
  )
}
