'use client'

import { useMemo, useState } from 'react'
import { Pencil, Trash2, Undo2, X, Check, Crosshair, Users } from 'lucide-react'
import type { FloodRiskZone } from '@/types'
import {
  COLOR_PRESETS,
  FALLBACK_HAZARD,
  ZONE_CATEGORIES,
  type HazardTypeDef,
  type ZoneCategory,
} from '@/lib/risk-zone'
import { PanelShell } from './PanelShell'

export interface ZoneWithCount extends FloodRiskZone {
  count: number
}

export interface SaveZoneInput {
  name: string
  category: ZoneCategory
  hazardType: string
  priority: number
  color: string | null // null = ใช้สีตามชนิดภัย/ลำดับ
}

interface Props {
  zones: ZoneWithCount[]
  hazardTypes: HazardTypeDef[]
  canEdit: boolean
  drawing: boolean
  draftCount: number
  editingZone?: FloodRiskZone | null // null = วาดใหม่; มีค่า = แก้ไขโซนเดิม
  onStartDraw: () => void
  onStartEdit: (z: FloodRiskZone) => void
  onUndoVertex: () => void
  onCancelDraw: () => void
  onSaveDraw: (input: SaveZoneInput) => Promise<boolean>
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
  zones, hazardTypes, canEdit, drawing, draftCount, editingZone = null,
  onStartDraw, onStartEdit, onUndoVertex, onCancelDraw, onSaveDraw, onDelete, onZoomZone, onClose,
}: Props) {
  // ค่าตั้งต้นของฟอร์ม — panel ถูก remount ด้วย key เมื่อสลับ วาดใหม่ ↔ แก้ไข จึง prefill จาก editingZone ได้ตรงนี้
  const isEditing = !!editingZone
  const [name, setName] = useState(editingZone?.name ?? '')
  const [category, setCategory] = useState<ZoneCategory>(editingZone?.category ?? 'permanent')
  const [hazardChoice, setHazardChoice] = useState<string>(editingZone?.hazardType ?? '') // '' = ใช้ค่า default ของหมวด
  const [priority, setPriority] = useState(editingZone?.priority ?? 1)
  const [color, setColor] = useState<string | null>(editingZone?.color ?? null) // null = อัตโนมัติ (ตามชนิดภัย)
  const [saving, setSaving] = useState(false)

  // ชนิดภัยที่เปิดใช้งานในหมวดที่เลือก
  const hazardOptions = useMemo(
    () => hazardTypes.filter((h) => h.isActive && h.category === category),
    [hazardTypes, category],
  )

  // ชนิดภัยที่เลือกได้จริง — ถ้าค่าที่ผู้ใช้เลือกไม่อยู่ในหมวดปัจจุบัน ให้ fallback เป็นตัวแรก (derive ไม่ใช้ effect)
  const hazardType = hazardOptions.some((h) => h.code === hazardChoice)
    ? hazardChoice
    : (hazardOptions[0]?.code ?? '')

  async function save() {
    if (saving || draftCount < 3 || !name.trim() || !hazardType) return
    setSaving(true)
    const ok = await onSaveDraw({ name: name.trim(), category, hazardType, priority, color })
    setSaving(false)
    if (ok) { setName(''); setCategory('permanent'); setHazardChoice(''); setPriority(1); setColor(null) }
  }

  const totalAtRisk = zones.reduce((s, z) => s + z.count, 0)

  // จัดกลุ่ม: จังหวัด → ประเภท (ถาวร/ชั่วคราว) — เรียงในกลุ่มตาม priority แล้ว createdAt
  const grouped = useMemo(() => {
    const byProvince = new Map<string, ZoneWithCount[]>()
    for (const z of zones) {
      const arr = byProvince.get(z.province) ?? []
      arr.push(z)
      byProvince.set(z.province, arr)
    }
    return [...byProvince.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'th'))
      .map(([province, list]) => ({
        province,
        categories: ZONE_CATEGORIES
          .map((c) => ({
            category: c.value,
            label: c.label,
            zones: list
              .filter((z) => z.category === c.value)
              .sort((a, b) => a.priority - b.priority),
          }))
          .filter((g) => g.zones.length > 0),
      }))
  }, [zones])

  return (
    <PanelShell
      title="โซนพื้นที่เสี่ยงภัย"
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
                {isEditing ? 'แก้ไขโซน' : 'วาดโซนใหม่'} · {draftCount} จุด
              </p>
              <p className="mb-3 text-[11px] text-[var(--fg-muted)]">
                {isEditing
                  ? 'ลากจุดเพื่อย้าย · คลิกบนแผนที่เพื่อเพิ่มจุด · คลิกที่จุดเพื่อลบ (เหลืออย่างน้อย 3 จุด)'
                  : 'คลิกบนแผนที่เพื่อปักมุมโซน · ลากจุดเพื่อย้าย · ต้องอย่างน้อย 3 จุด แล้วตั้งชื่อเพื่อบันทึก'}
              </p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อโซน เช่น ริมน้ำ บ.ท่าลี่ หมู่ 2"
                className="mb-2 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] outline-none focus:border-[var(--accent)]"
              />

              {/* ประเภทสถานการณ์ — ถาวร/ชั่วคราว */}
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                {ZONE_CATEGORIES.map((c) => {
                  const active = category === c.value
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(c.value)}
                      title={c.hint}
                      className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[12.5px] transition-all ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)] font-semibold text-white shadow-sm ring-2 ring-[color-mix(in_oklch,var(--accent)_30%,transparent)]'
                          : 'border-[var(--border)] bg-[var(--bg)] font-medium text-[var(--fg-muted)] hover:border-[var(--fg-subtle)] hover:text-[var(--fg)]'
                      }`}
                    >
                      {active && <Check className="size-3.5 shrink-0" />}
                      {c.label}
                    </button>
                  )
                })}
              </div>

              {/* ชนิดภัย — กรองตาม category (ตั้งค่าได้ที่ /admin/settings/hazard-types) */}
              <label className="mb-2 flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                ชนิดภัย
                {hazardOptions.length === 0 ? (
                  <span className="flex-1 text-[11px] text-[var(--risk-flood)]">
                    ยังไม่มีชนิดภัยในหมวดนี้ — เพิ่มที่หน้าตั้งค่าชนิดภัย
                  </span>
                ) : (
                  <select
                    value={hazardType}
                    onChange={(e) => setHazardChoice(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] outline-none focus:border-[var(--accent)]"
                  >
                    {hazardOptions.map((h) => (
                      <option key={h.code} value={h.code}>{h.emoji} {h.label}</option>
                    ))}
                  </select>
                )}
              </label>

              <label className="mb-3 flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                ลำดับความเร่งด่วน
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] outline-none focus:border-[var(--accent)]"
                >
                  <option value={1}>1 — เร่งด่วนสุด</option>
                  <option value={2}>2 — รองลงมา</option>
                  <option value={3}>3 — ทีหลัง</option>
                </select>
              </label>

              {/* สีโซน — เลือกเองหรืออัตโนมัติตามชนิดภัย */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[var(--fg-muted)]">สีโซน</span>
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                    color === null
                      ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  อัตโนมัติ
                </button>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`สี ${c}`}
                    className={`size-6 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-[var(--fg)]' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={save} disabled={draftCount < 3 || !name.trim() || !hazardType || saving}
                  className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50">
                  <Check className="size-3.5" /> {saving ? 'กำลังบันทึก…' : isEditing ? 'บันทึกการแก้ไข' : 'บันทึกโซน'}
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

        {/* รายการโซน — จัดกลุ่ม จังหวัด → ประเภท */}
        {zones.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--fg-subtle)]">
            ยังไม่มีโซนเสี่ยงในพื้นที่นี้{canEdit ? ' — เริ่มวาดได้เลย' : ''}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((p) => (
              <section key={p.province} className="flex flex-col gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  จ.{p.province}
                </h3>
                {p.categories.map((g) => (
                  <div key={g.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 pl-0.5 text-[11px] font-medium text-[var(--fg-subtle)]">
                      <span className={`inline-block size-1.5 rounded-full ${g.category === 'permanent' ? 'bg-[var(--accent)]' : 'bg-[var(--risk-flood)]'}`} />
                      {g.label}
                      <span className="text-[var(--fg-subtle)]">· {g.zones.length}</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {g.zones.map((z) => {
                        const hzColor = z.hazardColor ?? FALLBACK_HAZARD.color
                        const hzLabel = z.hazardLabel ?? FALLBACK_HAZARD.label
                        const hzEmoji = z.hazardEmoji ?? FALLBACK_HAZARD.emoji
                        // สีที่แสดงบน swatch = สีโซนที่เลือกเอง ถ้าไม่มีใช้สีตามลำดับ (น้ำท่วม) / ชนิดภัย
                        const swatch = z.color ?? (z.hazardType === 'flood' ? priorityColor(z.priority) : hzColor)
                        return (
                          <li key={z.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
                            <span className="size-3 shrink-0 rounded-sm" style={{ background: swatch }} />
                            <button type="button" onClick={() => onZoomZone(z)} className="min-w-0 flex-1 text-left">
                              <div className="truncate text-[13px] font-medium text-[var(--fg)]">{z.name}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] text-[var(--fg-muted)]">
                                <span
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-px font-medium"
                                  style={{ background: `color-mix(in oklch, ${hzColor} 15%, transparent)`, color: hzColor }}
                                >
                                  {hzEmoji} {hzLabel}
                                </span>
                                <span>ลำดับ {z.priority}</span>
                                <span className="flex items-center gap-1 font-medium text-[var(--risk-flood)]">
                                  <Users className="size-3" /> {z.count} คน
                                </span>
                              </div>
                            </button>
                            {canEdit && (
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button type="button" onClick={() => onStartEdit(z)} title="แก้ไขโซน" disabled={drawing}
                                  className="text-[var(--fg-subtle)] hover:text-[var(--accent)] disabled:opacity-40">
                                  <Pencil className="size-4" />
                                </button>
                                <button type="button" onClick={() => onDelete(z.id)} title="ลบโซน" disabled={drawing}
                                  className="text-[var(--fg-subtle)] hover:text-[var(--risk-flood)] disabled:opacity-40">
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  )
}
