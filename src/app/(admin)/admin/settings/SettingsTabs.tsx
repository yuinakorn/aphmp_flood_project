'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserCog, Tent, ShieldAlert, Anchor, Building2, AlertTriangle, ListChecks } from 'lucide-react'

type Tab = {
  href: string
  label: string
  icon: typeof UserCog
  show: boolean
}

export function SettingsTabs({ canManageStaff, canTriage }: { canManageStaff: boolean; canTriage: boolean }) {
  const pathname = usePathname() ?? ''
  const tabs: Tab[] = [
    { href: '/admin/settings/staff', label: 'จัดการเจ้าหน้าที่', icon: UserCog, show: canManageStaff },
    { href: '/admin/settings/menus', label: 'สิทธิ์การเห็นเมนู', icon: ListChecks, show: canManageStaff },
    { href: '/admin/settings/shelter-managers', label: 'ผู้ดูแลศูนย์พักพิง', icon: Tent, show: canManageStaff },
    { href: '/admin/settings/hazard-types', label: 'ชนิดภัย', icon: ShieldAlert, show: canManageStaff },
    { href: '/admin/settings/rescue-teams', label: 'ทีมกู้ภัย', icon: Anchor, show: canTriage },
    { href: '/admin/settings/facilities', label: 'สถานพยาบาล', icon: Building2, show: canManageStaff || canTriage },
    { href: '/admin/settings/incidents', label: 'เหตุการณ์ภัยพิบัติ', icon: AlertTriangle, show: canManageStaff || canTriage },
  ]

  const activeTabs = tabs.filter((t) => t.show)

  return (
    <div className="relative w-full">
      {/* Left Fade Indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--bg)] to-transparent pointer-events-none z-10" />
      {/* Right Fade Indicator */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg)] to-transparent pointer-events-none z-10" />

      <div className="flex gap-1 overflow-x-auto scrollbar-none p-1 bg-[var(--bg-sunken)] rounded-xl border border-[var(--border)]">
        {activeTabs.map((t) => {
          const Icon = t.icon
          const on = pathname === t.href || pathname.startsWith(t.href + '/')
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 px-4.5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 border ${
                on
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent)] shadow-xs border-[var(--border)]'
                  : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_oklch,var(--accent)_5%,var(--bg-elevated))]'
              }`}
            >
              <Icon size={15} strokeWidth={1.85} />
              <span>{t.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}


