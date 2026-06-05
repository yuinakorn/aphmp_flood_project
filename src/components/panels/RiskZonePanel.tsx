'use client'

import { useState } from 'react'
import { Pencil, Trash2, Undo2, X, Check, Crosshair, Users } from 'lucide-react'
import type { FloodRiskZone } from '@/types'
import { PanelShell } from './PanelShell'

export interface ZoneWithCount extends FloodRiskZone {
  count: number
}

interface Props {
  zones: ZoneWithCount[]
  canEdit: boolean
  drawing: boolean
  draftCount: number
  onStartDraw: () => void
  onUndoVertex: () => void
  onCancelDraw: () => void
  onSaveDraw: (name: string, priority: number) => Promise<boolean>
  onDelete: (id: string) => void
  onZoomZone: (z: FloodRiskZone) => void
  onClose: () => void
}

function priorityColor(priority: number): string {
  if (priority <= 1) return 'oklch(0.60 0.23 25)'
  if (priority === 2) return 'oklch(0.72 0.18 55)'
  return 'oklch(0.80 0.15 85)'
}

export function RiskZonePanel({
  zones, canEdit, drawing, draftCount,
  onStartDraw, onUndoVertex, onCancelDraw, onSaveDraw, onDelete, onZoomZone, onClose,
}: Props) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(1)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving || draftCount < 3 || !name.trim()) return
    setSaving(true)
    const ok = await onSaveDraw(name.trim(), priority)
    setSaving(false)
    if (ok) { setName(''); setPriority(1) }
  }

  const totalAtRisk = zones.reduce((s, z) => s + z.count, 0)

  return (
    <PanelShell
      title="โซนเสี่ยงน้ำท่วม"
      hint={`${zones.length} โซน · กลุ่มเปราะบางในโซน ${totalAtRisk} คน`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        {/* แผงวาด */}
        {canEdit && (
          drawing ? (
            <div className="rounded-lg border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_8%,transparent)] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--fg)]">
                <Crosshair className="size-3.5 text-[var(--risk-flood)]" />
                คลิกบนแผนที่เพื่อปักมุมโซน · ปักแล้ว <span className="font-mono">{draftCount}</span> จุด
              </p>
              <p className="mb-3 text-[11px] text-[var(--fg-muted)]">ต้องอย่างน้อย 3 จุด แล้วตั้งชื่อเพื่อบันทึก</p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อโซน เช่น ริมน้ำ บ.ท่าลี่ หมู่ 2"
                className="mb-2 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] outline-none focus:border-[var(--accent)]"
              />
              <label className="mb-3 flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                ลำดับการท่วม
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] outline-none focus:border-[var(--accent)]"
                >
                  <option value={1}>1 — ท่วมก่อน (เร่งด่วนสุด)</option>
                  <option value={2}>2 — ท่วมรอง</option>
                  <option value={3}>3 — ท่วมทีหลัง</option>
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={save} disabled={draftCount < 3 || !name.trim() || saving}
                  className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
                  <Check className="size-3.5" /> {saving ? 'กำลังบันทึก…' : 'บันทึกโซน'}
                </button>
                <button type="button" onClick={onUndoVertex} disabled={draftCount === 0}
                  className="gx-btn gx-btn-ghost gx-btn-sm disabled:opacity-50">
                  <Undo2 className="size-3.5" /> ลบจุดล่าสุด
                </button>
                <button type="button" onClick={onCancelDraw}
                  className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]">
                  <X className="size-3.5" /> ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={onStartDraw} className="gx-btn gx-btn-primary w-fit">
              <Pencil className="size-4" /> วาดโซนใหม่
            </button>
          )
        )}

        {/* รายการโซน */}
        {zones.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--fg-subtle)]">
            ยังไม่มีโซนเสี่ยงในจังหวัดนี้{canEdit ? ' — เริ่มวาดได้เลย' : ''}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
                <span className="size-3 shrink-0 rounded-sm" style={{ background: priorityColor(z.priority) }} />
                <button type="button" onClick={() => onZoomZone(z)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-medium text-[var(--fg)]">{z.name}</div>
                  <div className="mt-0.5 flex items-center gap-2.5 text-[11px] text-[var(--fg-muted)]">
                    <span>ลำดับ {z.priority}</span>
                    <span className="flex items-center gap-1 font-medium text-[var(--risk-flood)]">
                      <Users className="size-3" /> {z.count} คน
                    </span>
                  </div>
                </button>
                {canEdit && (
                  <button type="button" onClick={() => onDelete(z.id)} title="ลบโซน"
                    className="shrink-0 text-[var(--fg-subtle)] hover:text-[var(--risk-flood)]">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  )
}
