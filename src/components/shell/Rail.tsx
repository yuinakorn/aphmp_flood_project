'use client'

import { Layers, Users, Route, Building2, SlidersHorizontal, Droplets } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type RailPanel = 'layers' | 'roster' | 'routes' | 'infra' | 'tune' | 'water' | null

const items: Array<{
  key: NonNullable<RailPanel>
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  shortcut: string
}> = [
  { key: 'layers', label: 'Layers', icon: Layers, shortcut: 'L' },
  { key: 'roster', label: 'รายชื่อเปราะบาง', icon: Users, shortcut: 'R' },
  { key: 'routes', label: 'เส้นทางอพยพ', icon: Route, shortcut: 'E' },
  { key: 'infra', label: 'สถานพยาบาล', icon: Building2, shortcut: 'I' },
  { key: 'tune', label: 'ปรับการแสดงผล', icon: SlidersHorizontal, shortcut: 'T' },
  { key: 'water', label: 'ระดับน้ำสถานี', icon: Droplets, shortcut: 'W' },
]

interface Props {
  active: RailPanel
  onSelect: (panel: RailPanel) => void
}

export function Rail({ active, onSelect }: Props) {
  return (
    <TooltipProvider delay={200}>
      <aside
        aria-label="แถบเครื่องมือ"
        className="flex w-[60px] shrink-0 flex-col items-center gap-1.5 border-r border-[var(--border)] bg-[var(--bg)] py-3"
      >
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-pressed={isActive}
                    onClick={() => onSelect(isActive ? null : item.key)}
                    className={`group relative flex size-10 items-center justify-center rounded-lg transition-colors ease-quart duration-150 ${
                      isActive
                        ? 'bg-[var(--bg-elevated)] text-[var(--accent)]'
                        : 'text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute -left-px top-2 bottom-2 w-px bg-[var(--accent)]"
                      />
                    )}
                  </button>
                }
              />
              <TooltipContent side="right" sideOffset={10} className="text-xs">
                {item.label}
                <span className="ml-2 font-mono text-[10px] text-[var(--fg-subtle)]">
                  {item.shortcut}
                </span>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </aside>
    </TooltipProvider>
  )
}
