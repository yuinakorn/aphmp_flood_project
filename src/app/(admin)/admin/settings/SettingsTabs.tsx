'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserCog, Tent, ShieldAlert, Anchor, Building2, AlertTriangle } from 'lucide-react'

type Tab = { href: string; label: string; icon: typeof UserCog; show: boolean }

export function SettingsTabs({ canManageStaff, canTriage }: { canManageStaff: boolean; canTriage: boolean }) {
  const pathname = usePathname() ?? ''
  const tabs: Tab[] = [
    { href: '/admin/settings/staff', label: 'จัดการเจ้าหน้าที่', icon: UserCog, show: canManageStaff },
    { href: '/admin/settings/shelter-managers', label: 'ผู้ดูแลศูนย์พักพิง', icon: Tent, show: canManageStaff },
    { href: '/admin/settings/hazard-types', label: 'ชนิดภัย', icon: ShieldAlert, show: canManageStaff },
    { href: '/admin/settings/rescue-teams', label: 'ทีมกู้ภัย', icon: Anchor, show: canTriage },
    { href: '/admin/settings/facilities', label: 'สถานพยาบาล', icon: Building2, show: canManageStaff || canTriage },
    { href: '/admin/settings/incidents', label: 'เหตุการณ์ภัยพิบัติ', icon: AlertTriangle, show: canManageStaff || canTriage },
  ]

  return (
    <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
      {tabs
        .filter((t) => t.show)
        .map((t) => {
          const Icon = t.icon
          const on = pathname === t.href || pathname.startsWith(t.href + '/')
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                on
                  ? 'border-[var(--accent)] text-[var(--fg)]'
                  : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Icon size={16} strokeWidth={1.85} />
              {t.label}
            </Link>
          )
        })}
    </div>
  )
}
