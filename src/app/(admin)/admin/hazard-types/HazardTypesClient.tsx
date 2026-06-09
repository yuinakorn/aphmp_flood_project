'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, Pencil, Trash2, Check, X, Lock } from 'lucide-react'
import { COLOR_PRESETS, ZONE_CATEGORIES, zoneCategoryLabel, type HazardTypeDef, type ZoneCategory } from '@/lib/risk-zone'

interface DraftFields {
  label: string
  category: ZoneCategory
  emoji: string
  color: string
  sortOrder: number
}

function emptyDraft(): DraftFields {
  return { label: '', category: 'temporary', emoji: '⚠️', color: COLOR_PRESETS[0], sortOrder: 50 }
}

export function HazardTypesClient({ items, canManage }: { items: HazardTypeDef[]; canManage: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error ?? `ทำรายการไม่สำเร็จ (${res.status})`)
        return false
      }
      router.refresh()
      return true
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="gx-icon-tile size-9 shrink-0" style={{ ['--tile' as string]: 'var(--signal-data)' }}>
          <AlertTriangle size={16} />
        </span>
        <div className="min-w-0">
          <p className="gx-eyebrow">ทะเบียนตั้งค่า</p>
          <h1 className="gx-title text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)]">
            ชนิดภัย (สำหรับวาดโซนพื้นที่เสี่ยง)
          </h1>
        </div>
      </div>
      <p className="mb-4 text-sm text-[var(--fg-muted)]">
        จัดการชนิดภัยที่ใช้ตอนวาดโซนบนแผนที่ — แบ่งเป็น <b>โซนถาวร</b> (เช่น น้ำท่วม) และ <b>โซนชั่วคราว</b> (เช่น แผ่นดินไหว โรคระบาด)
        · ชนิดภัยหลักของระบบ <Lock className="inline size-3" /> ลบไม่ได้ แต่ปรับชื่อ/สี/ไอคอนได้
      </p>

      {!canManage && (
        <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--fg-muted)]">
          คุณมีสิทธิ์ดูอย่างเดียว — การเพิ่ม/แก้ไขทำได้โดยผู้ดูแลระบบ
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_8%,transparent)] px-4 py-2.5 text-sm text-[var(--risk-flood)]">
          {error}
        </p>
      )}

      {/* เพิ่มชนิดภัยใหม่ */}
      {canManage && (
        adding ? (
          <HazardForm
            title="เพิ่มชนิดภัยใหม่"
            initial={emptyDraft()}
            busy={busy}
            onCancel={() => setAdding(false)}
            onSubmit={async (d) => {
              const ok = await call('/api/hazard-types', 'POST', d)
              if (ok) setAdding(false)
            }}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="gx-btn gx-btn-primary mb-4 w-fit">
            <Plus className="size-4" /> เพิ่มชนิดภัย
          </button>
        )
      )}

      {/* รายการ จัดกลุ่มตามหมวด */}
      <div className="flex flex-col gap-5">
        {ZONE_CATEGORIES.map((c) => {
          const group = items.filter((h) => h.category === c.value)
          return (
            <section key={c.value} className="flex flex-col gap-2">
              <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                {c.label} <span className="text-[var(--fg-subtle)]">· {group.length}</span>
              </h2>
              {group.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-[12.5px] text-[var(--fg-subtle)]">
                  ยังไม่มีชนิดภัยในหมวดนี้
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {group.map((h) =>
                    editingId === h.id ? (
                      <li key={h.id}>
                        <HazardForm
                          title={`แก้ไข: ${h.label}`}
                          initial={{ label: h.label, category: h.category, emoji: h.emoji, color: h.color, sortOrder: h.sortOrder }}
                          busy={busy}
                          onCancel={() => setEditingId(null)}
                          onSubmit={async (d) => {
                            const ok = await call(`/api/hazard-types/${h.id}`, 'PATCH', d)
                            if (ok) setEditingId(null)
                          }}
                        />
                      </li>
                    ) : (
                      <li
                        key={h.id}
                        className={`flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 ${h.isActive ? '' : 'opacity-55'}`}
                      >
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-md text-base"
                          style={{ background: `color-mix(in oklch, ${h.color} 18%, transparent)` }}
                        >
                          {h.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--fg)]">
                            {h.label}
                            {h.isSystem && <Lock className="size-3 text-[var(--fg-subtle)]" />}
                            {!h.isActive && <span className="rounded bg-[var(--bg)] px-1.5 py-px text-[10.5px] text-[var(--fg-subtle)]">ปิดใช้งาน</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                            <code className="rounded bg-[var(--bg)] px-1 py-px">{h.code}</code>
                            <span>· {zoneCategoryLabel(h.category)}</span>
                            <span>· ลำดับ {h.sortOrder}</span>
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => call(`/api/hazard-types/${h.id}`, 'PATCH', { isActive: !h.isActive })}
                              title={h.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                              className="rounded px-2 py-1 text-[11.5px] font-medium text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)] disabled:opacity-50"
                            >
                              {h.isActive ? 'ปิด' : 'เปิด'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(h.id)}
                              title="แก้ไข"
                              className="text-[var(--fg-subtle)] hover:text-[var(--accent)]"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy || h.isSystem}
                              onClick={() => {
                                if (confirm(`ลบชนิดภัย "${h.label}" ?`)) call(`/api/hazard-types/${h.id}`, 'DELETE')
                              }}
                              title={h.isSystem ? 'ชนิดภัยหลักของระบบ ลบไม่ได้' : 'ลบ'}
                              className="text-[var(--fg-subtle)] hover:text-[var(--risk-flood)] disabled:opacity-30 disabled:hover:text-[var(--fg-subtle)]"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function HazardForm({
  title, initial, busy, onSubmit, onCancel,
}: {
  title: string
  initial: DraftFields
  busy: boolean
  onSubmit: (d: DraftFields) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<DraftFields>(initial)
  const set = <K extends keyof DraftFields>(k: K, v: DraftFields[K]) => setD((p) => ({ ...p, [k]: v }))

  return (
    <div className="mb-4 rounded-lg border border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-4">
      <p className="mb-3 text-[13px] font-semibold text-[var(--fg)]">{title}</p>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <input
          value={d.emoji}
          onChange={(e) => set('emoji', e.target.value)}
          maxLength={4}
          placeholder="🌊"
          aria-label="ไอคอน emoji"
          className="h-9 w-14 rounded-md border border-[var(--border)] bg-[var(--bg)] text-center text-base outline-none focus:border-[var(--accent)]"
        />
        <input
          value={d.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="ชื่อชนิดภัย เช่น ดินถล่ม"
          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
          หมวด
          <select
            value={d.category}
            onChange={(e) => set('category', e.target.value as ZoneCategory)}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] outline-none focus:border-[var(--accent)]"
          >
            {ZONE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
          ลำดับ
          <input
            type="number"
            value={d.sortOrder}
            onChange={(e) => set('sortOrder', Number(e.target.value))}
            className="h-8 w-20 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] outline-none focus:border-[var(--accent)]"
          />
        </label>
      </div>

      {/* สี */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[12px] text-[var(--fg-muted)]">สี</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set('color', c)}
              aria-label={c}
              className={`size-6 rounded-full border-2 ${d.color === c ? 'border-[var(--fg)]' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || !d.label.trim()}
          onClick={() => onSubmit({ ...d, label: d.label.trim() })}
          className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50"
        >
          <Check className="size-3.5" /> {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        <button type="button" onClick={onCancel} className="gx-btn gx-btn-ghost gx-btn-sm">
          <X className="size-3.5" /> ยกเลิก
        </button>
      </div>
    </div>
  )
}
