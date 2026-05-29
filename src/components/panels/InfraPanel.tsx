'use client'

import { Hospital, Tent, Flag, Stethoscope } from 'lucide-react'
import type { Infrastructure } from '@/types'
import { PanelShell } from './PanelShell'

interface Props {
  infra: Infrastructure[]
  onSelect: (i: Infrastructure) => void
  onClose: () => void
}

const meta: Record<
  string,
  { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; label: string; tone: string }
> = {
  hospital: { icon: Hospital, label: 'โรงพยาบาล', tone: 'var(--infra-medical)' },
  clinic: { icon: Stethoscope, label: 'รพ.สต.', tone: 'var(--infra-medical)' },
  shelter: { icon: Tent, label: 'ศูนย์อพยพ', tone: 'var(--infra-shelter)' },
  assembly: { icon: Flag, label: 'จุดรวมพล', tone: 'var(--infra-shelter)' },
}

export function InfraPanel({ infra, onSelect, onClose }: Props) {
  const groups = ['hospital', 'clinic', 'shelter', 'assembly'] as const

  return (
    <PanelShell
      title="สถานพยาบาล & ศูนย์อพยพ"
      hint={`${infra.length} จุด`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5 px-5 py-5">
        {groups.map((g) => {
          const list = infra.filter((i) => i.type === g)
          if (list.length === 0) return null
          const m = meta[g]
          const Icon = m.icon
          return (
            <section key={g}>
              <div className="mb-2 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                <Icon size={12} strokeWidth={2} />
                {m.label}
                <span className="font-mono text-[10.5px]">· {list.length}</span>
              </div>
              <ul className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--bg)]">
                {list.map((item, i) => (
                  <li key={`${g}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex w-full items-center gap-3.5 border-b border-[var(--border)] px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--bg-elevated)]"
                    >
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: `color-mix(in oklch, ${m.tone} 14%, transparent)`,
                          color: m.tone,
                        }}
                      >
                        <Icon size={14} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-[var(--fg)]">
                          {item.name}
                        </div>
                        <div className="text-[10.5px] text-[var(--fg-subtle)]">
                          ความจุ: {item.cap}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </PanelShell>
  )
}
