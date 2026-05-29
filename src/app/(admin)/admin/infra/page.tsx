import { Hospital, Tent, Flag, Stethoscope, Plus, Pencil, Trash2 } from 'lucide-react'
import infraData from '../../../../../public/data/infrastructure.json'
import type { Infrastructure } from '@/types'

export const metadata = { title: 'สถานที่สำคัญ — GIS Health Intelligence' }

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
  shelter: { icon: Tent, label: 'ศูนย์อพยพ', tone: 'var(--infra-shelter)' },
  assembly: { icon: Flag, label: 'จุดรวมพล', tone: 'var(--infra-shelter)' },
}

export default function InfraPage() {
  const infra = infraData as Infrastructure[]
  const groups = ['hospital', 'clinic', 'shelter', 'assembly'] as const

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            ทะเบียน · สถานพยาบาล / ศูนย์อพยพ
          </p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">
            สถานที่สำคัญ
          </h1>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
            <span className="font-mono">{infra.length}</span> จุด
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12.5px] font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          <Plus size={14} strokeWidth={2} />
          เพิ่มสถานที่
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {groups.map((g) => {
          const list = infra.filter((i) => i.type === g)
          if (list.length === 0) return null
          const m = meta[g]
          const Icon = m.icon
          return (
            <section key={g}>
              <h2 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                <Icon size={12} strokeWidth={2} />
                {m.label}
                <span className="font-mono">· {list.length}</span>
              </h2>

              <ul className="mt-2 divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
                {list.map((item, i) => (
                  <li
                    key={`${g}-${i}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        background: `color-mix(in oklch, ${m.tone} 12%, transparent)`,
                        color: m.tone,
                      }}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                    </span>
                    <div className="flex-1">
                      <div className="text-[14px] font-medium">{item.name}</div>
                      <div className="mt-0.5 flex gap-3 text-[11px] text-[var(--fg-subtle)]">
                        <span>ความจุ: {item.cap}</span>
                        <span className="font-mono">
                          {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        aria-label="แก้ไข"
                        className="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--accent)]"
                      >
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button
                        aria-label="ลบ"
                        className="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--risk-flood)]"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
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
