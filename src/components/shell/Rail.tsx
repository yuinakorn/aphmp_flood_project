'use client'

import Link from 'next/link'
import { Layers, Users, Route, Building2, SlidersHorizontal, Droplets, Filter, Siren, Shapes } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type RailPanel = 'layers' | 'filter' | 'roster' | 'zones' | 'routes' | 'infra' | 'tune' | 'water' | 'crFloodRoster' | null

type RailItem = {
  key: string
  label: string
  short: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  shortcut?: string
} & ({ panel: NonNullable<RailPanel>; href?: never } | { href: string; panel?: never })

const items: RailItem[] = [
  { key: 'layers', panel: 'layers', label: 'Layers', short: 'เลเยอร์', icon: Layers, shortcut: 'L' },
  { key: 'filter', panel: 'filter', label: 'ตัวกรองหมุด', short: 'ตัวกรอง', icon: Filter, shortcut: 'F' },
  { key: 'roster', panel: 'roster', label: 'รายชื่อเปราะบาง', short: 'รายชื่อ', icon: Users, shortcut: 'R' },
  { key: 'zones', panel: 'zones', label: 'โซนเสี่ยงน้ำท่วม', short: 'โซนเสี่ยง', icon: Shapes, shortcut: 'Z' },
  { key: 'eoc', href: '/admin/eoc', label: 'ศูนย์บัญชาการ EOC', short: 'EOC', icon: Siren },
  { key: 'routes', panel: 'routes', label: 'เส้นทางอพยพ', short: 'เส้นทาง', icon: Route, shortcut: 'E' },
  { key: 'infra', panel: 'infra', label: 'สถานพยาบาล', short: 'สถานที่', icon: Building2, shortcut: 'I' },
  { key: 'tune', panel: 'tune', label: 'ปรับการแสดงผล', short: 'ปรับแต่ง', icon: SlidersHorizontal, shortcut: 'T' },
  { key: 'water', panel: 'water', label: 'ระดับน้ำสถานี', short: 'ระดับน้ำ', icon: Droplets, shortcut: 'W' },
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
          const isActive = item.panel !== undefined && active === item.panel
          const baseClass = `group relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ease-quart duration-150 md:size-10 md:flex-none md:gap-0 md:rounded-lg ${
            isActive
              ? 'text-[var(--accent)] md:bg-[var(--bg-elevated)]'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg)] md:hover:bg-[var(--bg-elevated)]'
          }`
          const inner = (
            <>
              <span
                className={`grid h-7 w-10 place-items-center rounded-full transition-all duration-150 md:h-auto md:w-auto md:translate-y-0 md:rounded-none md:bg-transparent ${
                  isActive ? '-translate-y-0.5 bg-[var(--accent)]/12' : 'bg-transparent'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
              </span>
              <span
                className={`max-w-full truncate px-0.5 text-[9.5px] leading-none md:hidden ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {item.short}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--accent)] md:inset-x-auto md:-left-px md:top-2 md:bottom-2 md:h-auto md:w-px md:rounded-none"
                />
              )}
            </>
          )
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger
                render={
                  item.href !== undefined ? (
                    <Link href={item.href} aria-label={item.label} className={baseClass}>
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-label={item.label}
                      aria-pressed={isActive}
                      onClick={() => onSelect(isActive ? null : item.panel)}
                      className={baseClass}
                    >
                      {inner}
                    </button>
                  )
                }
              />
              <TooltipContent side="right" sideOffset={10} className="hidden text-xs md:block">
                {item.label}
                {item.shortcut && (
                  <span className="ml-2 font-mono text-[10px] text-[var(--fg-subtle)]">
                    {item.shortcut}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </aside>
    </TooltipProvider>
  )
}
