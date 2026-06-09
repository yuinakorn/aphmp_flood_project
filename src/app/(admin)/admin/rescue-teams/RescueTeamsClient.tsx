'use client'

import { useRouter } from 'next/navigation'
import { Anchor } from 'lucide-react'
import { RescueTeamManager } from '@/components/rescue/RescueTeamManager'
import type { RescueTeam } from '@/types'

export function RescueTeamsClient({
  teams,
  canManage,
  scopedToIncident,
  incidentName,
}: {
  teams: RescueTeam[]
  canManage: boolean
  scopedToIncident: boolean
  incidentName: string | null
}) {
  const router = useRouter()
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="gx-icon-tile size-9 shrink-0" style={{ ['--tile' as string]: 'var(--signal-data)' }}>
          <Anchor size={16} />
        </span>
        <div className="min-w-0">
          <p className="gx-eyebrow">ทะเบียนทรัพยากร</p>
          <h1 className="gx-title text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)]">
            จัดการทีมกู้ภัย / หน่วยเคลื่อนที่เร็ว
          </h1>
        </div>
      </div>
      <p className="mb-4 text-sm text-[var(--fg-muted)]">
        ขึ้นทะเบียน แก้ไข และดูสถานะของหน่วยกู้ภัย
        {scopedToIncident && incidentName ? (
          <> · กำลังแสดงทีมของเหตุการณ์ <span className="font-medium text-[var(--fg)]">{incidentName}</span></>
        ) : (
          <> · แสดงทีมทั้งหมด</>
        )}
        {' '}— ส่วนสั่งการระหว่างเหตุการณ์อยู่ที่ <a href="/admin/eoc" className="underline">ศูนย์บัญชาการ EOC</a>
      </p>

      {!canManage && (
        <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--fg-muted)]">
          คุณมีสิทธิ์ดูอย่างเดียว — การขึ้นทะเบียน/แก้ไขทำได้โดยเจ้าหน้าที่บัญชาการ
        </p>
      )}

      <RescueTeamManager
        teams={teams}
        canManage={canManage}
        mode="manage"
        onChange={() => router.refresh()}
      />
    </div>
  )
}
