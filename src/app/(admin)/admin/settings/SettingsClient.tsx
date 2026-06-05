'use client'

import { useState } from 'react'
import { UserCog, Tent } from 'lucide-react'
import { StaffClient } from '../staff/StaffClient'
import { ShelterManagersTab } from './ShelterManagersTab'

interface Props {
  isNational: boolean
  province: string | null
  provinceOptions: string[]
}

type TabKey = 'staff' | 'shelter-managers'

const TABS: { key: TabKey; label: string; icon: typeof UserCog }[] = [
  { key: 'staff', label: 'จัดการเจ้าหน้าที่', icon: UserCog },
  { key: 'shelter-managers', label: 'ผู้ดูแลประจำศูนย์พักพิง', icon: Tent },
]

export function SettingsClient({ isNational, province, provinceOptions }: Props) {
  const [tab, setTab] = useState<TabKey>('staff')

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="gx-eyebrow">ตั้งค่าระบบ</p>
        <h1 className="gx-title mt-1.5">ตั้งค่า</h1>
      </div>

      <div className="mt-5 flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => {
          const Icon = t.icon
          const on = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={on ? 'page' : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                on
                  ? 'border-[var(--accent)] text-[var(--fg)]'
                  : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Icon size={16} strokeWidth={1.85} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {tab === 'staff' ? (
          <StaffClient isNational={isNational} province={province} provinceOptions={provinceOptions} />
        ) : (
          <ShelterManagersTab />
        )}
      </div>
    </div>
  )
}
