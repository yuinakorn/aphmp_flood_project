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
  short: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  shortcut: string
}> = [
  { key: 'layers', label: 'Layers', short: 'เลเยอร์', icon: Layers, shortcut: 'L' },
  { key: 'roster', label: 'รายชื่อเปราะบาง', short: 'รายชื่อ', icon: Users, shortcut: 'R' },
  { key: 'routes', label: 'เส้นทางอพยพ', short: 'เส้นทาง', icon: Route, shortcut: 'E' },
  { key: 'infra', label: 'สถานพยาบาล', short: 'สถานที่', icon: Building2, shortcut: 'I' },
  { key: 'tune', label: 'ปรับการแสดงผล', short: 'ปรับแต่ง', icon: SlidersHorizontal, shortcut: 'T' },
  { key: 'water', label: 'ระดับน้ำสถานี', short: 'ระดับน้ำ', icon: Droplets, shortcut: 'W' },
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
        className="
          fixed inset-x-0 bottom-0 z-[500] flex h-14 w-full shrink-0 flex-row items-stretch
          justify-around gap-0 border-t border-[var(--border)] bg-[var(--bg)] px-1
          md:static md:h-full md:w-[60px] md:flex-col md:items-center md:justify-start
          md:gap-1.5 md:border-r md:border-t-0 md:px-0 md:py-3
        "
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
                    className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors ease-quart duration-150 md:size-10 md:flex-none md:gap-0 ${
                      isActive
                        ? 'bg-[var(--bg-elevated)] text-[var(--accent)]'
                        : 'text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    <span className="max-w-full truncate px-0.5 text-[9.5px] font-medium leading-none md:hidden">
                      {item.short}
                    </span>
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 -top-px h-px bg-[var(--accent)] md:inset-x-auto md:-left-px md:top-2 md:bottom-2 md:h-auto md:w-px"
                      />
                    )}
                  </button>
                }
              />
              <TooltipContent side="right" sideOffset={10} className="hidden text-xs md:block">
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
