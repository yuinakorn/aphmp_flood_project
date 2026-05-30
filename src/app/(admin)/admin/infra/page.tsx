import Link from 'next/link'
import { Hospital, Stethoscope, Plus, Pencil, Trash2, Tent, ArrowUpRight } from 'lucide-react'
import infraData from '../../../../../public/data/infrastructure.json'
import type { Infrastructure } from '@/types'

export const metadata = { title: 'สถานพยาบาล — GIS Health Intelligence' }

const meta: Record<
  string,
  {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
    label: string
    tone: string
  }
> = {
  hospital: { icon: Hospital, label: 'โรงพยาบาล', tone: 'var(--infra-medical)' },
  clinic: { icon: Stethoscope, label: 'รพ.สต.', tone: 'var(--infra-medical)' },
}

// เฉพาะหมวด "สถานพยาบาล" — ศูนย์พักพิง/จุดรวมพลย้ายไปอยู่ /admin/shelters (ops surface)
const MEDICAL_TYPES = ['hospital', 'clinic'] as const

export default function InfraPage() {
  const infra = (infraData as Infrastructure[]).filter((i) =>
    (MEDICAL_TYPES as readonly string[]).includes(i.type),
  )
  const groups = MEDICAL_TYPES

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">ทะเบียน · สถานพยาบาล</p>
          <h1 className="gx-title mt-1.5">สถานพยาบาล</h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            <span className="font-mono text-[var(--fg)]">{infra.length}</span> แห่ง · โรงพยาบาล / รพ.สต. / หน่วยบริการด่านหน้า
          </p>
        </div>
        <button type="button" className="gx-btn gx-btn-primary">
          <Plus size={16} strokeWidth={2} /> เพิ่มสถานพยาบาล
        </button>
      </div>

      <Link href="/admin/shelters" className="gx-note mt-4 transition-colors hover:border-[var(--accent)]" style={{ ['--tile' as string]: 'var(--infra-shelter)' }}>
        <Tent size={16} className="mt-0.5 shrink-0 text-[var(--infra-shelter)]" />
        <p className="flex-1 text-sm text-[var(--fg-muted)]">
          <strong className="text-[var(--fg)]">ศูนย์พักพิง / จุดรวมพล</strong> ย้ายไปจัดการที่หน้า "ศูนย์พักพิง" แล้ว — มีระบบรับเข้า/ย้ายออก/ส่งต่อ รพ. รายคนตามโซน
        </p>
        <ArrowUpRight size={16} className="shrink-0 text-[var(--fg-subtle)]" />
      </Link>

      <div className="mt-7 flex flex-col gap-6">
        {groups.map((g) => {
          const list = infra.filter((i) => i.type === g)
          if (list.length === 0) return null
          const m = meta[g]
          const Icon = m.icon
          return (
            <section key={g}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
                <span style={{ color: m.tone }} className="flex"><Icon size={15} strokeWidth={1.75} /></span>
                {m.label}
                <span className="font-mono text-xs font-normal text-[var(--fg-subtle)]">· {list.length}</span>
              </h2>

              <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                {list.map((item, i) => (
                  <li
                    key={`${g}-${i}`}
                    className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[var(--bg-sunken)]"
                    style={{ ['--tile' as string]: m.tone }}
                  >
                    <span className="gx-icon-tile size-10"><Icon size={18} strokeWidth={1.75} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--fg)]">{item.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-subtle)]">
                        <span>ความจุ: <span className="text-[var(--fg-muted)]">{item.cap}</span></span>
                        <span className="font-mono">{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button aria-label="แก้ไข" className="gx-btn gx-btn-ghost gx-btn-sm !h-8 !w-8 !p-0">
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                      <button aria-label="ลบ" className="gx-btn gx-btn-ghost gx-btn-sm !h-8 !w-8 !p-0 hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]">
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
