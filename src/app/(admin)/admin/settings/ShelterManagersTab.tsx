'use client'

import { useEffect, useState } from 'react'
import { Tent, Loader2 } from 'lucide-react'
import { ShelterStaffPanel } from './ShelterStaffPanel'

interface ShelterOption {
  id: string
  name: string
  type: string
}

const TYPE_LABEL: Record<string, string> = {
  shelter: 'ศูนย์พักพิง',
  assembly: 'จุดรวมพล',
}

export function ShelterManagersTab() {
  const [shelters, setShelters] = useState<ShelterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/shelters', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'โหลดรายชื่อศูนย์ไม่สำเร็จ')
        if (cancelled) return
        const list = (json.data ?? []) as ShelterOption[]
        setShelters(list)
        if (list.length > 0) setSelected((prev) => prev || list[0].id)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="gx-card p-5" style={{ ['--tile' as string]: 'var(--accent)' }}>
        <div className="mb-4 flex items-center gap-3">
          <span className="gx-icon-tile size-10"><Tent size={18} strokeWidth={1.75} /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">ผู้ดูแลประจำศูนย์พักพิง</p>
            <p className="text-xs text-[var(--fg-muted)]">เลือกศูนย์เพื่อกำหนดเจ้าหน้าที่ผู้รับผิดชอบ — ผู้ที่เพิ่มจะจัดการ roster ได้เฉพาะศูนย์ที่ตนดูแล</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
            <Loader2 className="size-4 animate-spin" /> กำลังโหลดรายชื่อศูนย์…
          </div>
        ) : error ? (
          <p className="text-sm text-[var(--risk-flood)]">{error}</p>
        ) : shelters.length === 0 ? (
          <p className="text-sm text-[var(--fg-subtle)]">ยังไม่มีศูนย์พักพิงในระบบ</p>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--fg-muted)]">เลือกศูนย์</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
            >
              {shelters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.type !== 'shelter' ? ` · ${TYPE_LABEL[s.type] ?? s.type}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {selected && <ShelterStaffPanel shelterId={selected} />}
    </div>
  )
}
