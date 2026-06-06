'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Siren, Map, Users, Tent, Hospital } from 'lucide-react'

type Tab = {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
}

function buildTabs(canTriage: boolean): Tab[] {
  const tabs: Tab[] = [
    { href: '/admin/vulnerable', icon: Users, label: 'เปราะบาง' },
    { href: '/map', icon: Map, label: 'แผนที่' },
    { href: '/admin/eoc', icon: Siren, label: 'EOC' },
    { href: '/admin/shelters', icon: Tent, label: 'พักพิง' },
  ]
  if (canTriage) {
    tabs.push({ href: '/admin/referrals', icon: Hospital, label: 'ส่งต่อ' })
  }
  return tabs
}

/** Bottom tab bar สำหรับมือถือ — แสดงเฉพาะหน้า /admin/* (desktop ใช้ AppSidebar) */
export function MobileTabBar({ canTriage = false }: { canTriage?: boolean }) {
  const pathname = usePathname() ?? ''
  const tabs = buildTabs(canTriage)

  const isActive = (href: string) =>
    href === '/map' ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-[var(--border)] bg-[var(--bg)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const on = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={`group relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              on ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
            }`}
          >
            <span
              className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-150 ${
                on ? 'bg-[var(--accent)]/12 -translate-y-0.5' : 'bg-transparent'
              }`}
            >
              <Icon size={20} strokeWidth={on ? 2.25 : 1.75} />
            </span>
            <span
              className={`max-w-full truncate px-0.5 text-[9.5px] leading-none ${
                on ? 'font-bold' : 'font-medium'
              }`}
            >
              {tab.label}
            </span>
            {on && (
              <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--accent)]" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
