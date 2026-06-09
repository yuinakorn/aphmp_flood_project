'use client'

import { useState } from 'react'
import { Lock, Check, Loader2, Eye, Info } from 'lucide-react'
import { ROLE_LABEL } from '@/lib/roles'
import type { UserRole } from '@/types'
import type { MenuSection } from '@/lib/menus'

interface MenuRow {
  key: string
  label: string
  section: MenuSection
}

interface Props {
  roles: UserRole[]
  menus: MenuRow[]
  sectionLabels: Record<MenuSection, string | null>
  matrix: Record<string, Record<string, boolean>>
  locked: Record<string, Record<string, boolean>>
}

const SECTION_ORDER: MenuSection[] = ['top', 'ops', 'system']

export function MenuAccessClient({ roles, menus, sectionLabels, matrix, locked }: Props) {
  const [state, setState] = useState(matrix)
  const [saving, setSaving] = useState<string | null>(null) // "role:menuKey" ที่กำลังบันทึก
  const [error, setError] = useState('')

  const toggle = async (role: UserRole, menuKey: string) => {
    if (locked[role]?.[menuKey]) return
    const cellId = `${role}:${menuKey}`
    const next = !state[role][menuKey]
    setError('')
    setSaving(cellId)
    // optimistic
    setState((s) => ({ ...s, [role]: { ...s[role], [menuKey]: next } }))
    try {
      const res = await fetch('/api/settings/menu-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, menuKey, visible: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'บันทึกไม่สำเร็จ')
      }
    } catch (e) {
      // revert
      setState((s) => ({ ...s, [role]: { ...s[role], [menuKey]: !next } }))
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(null)
    }
  }

  const menusBySection = SECTION_ORDER.map((sec) => ({
    section: sec,
    label: sectionLabels[sec],
    items: menus.filter((m) => m.section === sec),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
        <Info size={15} className="mt-px shrink-0 text-[var(--accent)]" strokeWidth={1.9} />
        <span>
          กำหนดว่าแต่ละบทบาทเห็นเมนูใดได้บ้าง — เมนูที่ปิดจะไม่แสดงใน sidebar และเข้าหน้านั้นโดยตรงไม่ได้
          (ถูก redirect กลับหน้าหลัก) <strong className="text-[var(--fg)]">สิทธิ์ระดับ API/ข้อมูลยังบังคับตามบทบาทจริงเสมอ</strong>
          แก้แล้วบันทึกอัตโนมัติ
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-md border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--risk-flood)]">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)]">
              <th className="sticky left-0 z-10 bg-[var(--bg-sunken)] px-3 py-2.5 text-left text-[11.5px] font-bold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                <span className="flex items-center gap-1.5"><Eye size={13} /> เมนู</span>
              </th>
              {roles.map((r) => (
                <th key={r} className="px-2 py-2.5 align-bottom">
                  <span className="block w-[64px] text-center text-[11px] font-semibold leading-tight text-[var(--fg-muted)]">
                    {ROLE_LABEL[r]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {menusBySection.map((group) => (
              <SectionRows
                key={group.section}
                label={group.label}
                colSpan={roles.length + 1}
                items={group.items}
                roles={roles}
                state={state}
                locked={locked}
                saving={saving}
                onToggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionRows({
  label,
  colSpan,
  items,
  roles,
  state,
  locked,
  saving,
  onToggle,
}: {
  label: string | null
  colSpan: number
  items: MenuRow[]
  roles: UserRole[]
  state: Record<string, Record<string, boolean>>
  locked: Record<string, Record<string, boolean>>
  saving: string | null
  onToggle: (role: UserRole, menuKey: string) => void
}) {
  return (
    <>
      {label && (
        <tr className="bg-[var(--bg-sunken)]/50">
          <td colSpan={colSpan} className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            {label}
          </td>
        </tr>
      )}
      {items.map((m) => (
        <tr key={m.key} className="border-t border-[var(--border)] hover:bg-[var(--bg-sunken)]/40">
          <td className="sticky left-0 z-10 bg-[var(--bg)] px-3 py-2 font-medium text-[var(--fg)]">
            {m.label}
          </td>
          {roles.map((r) => {
            const cellId = `${r}:${m.key}`
            const on = state[r][m.key]
            const isLocked = locked[r]?.[m.key]
            const isSaving = saving === cellId
            return (
              <td key={r} className="px-2 py-2 text-center">
                <button
                  type="button"
                  disabled={isLocked || isSaving}
                  onClick={() => onToggle(r, m.key)}
                  aria-pressed={on}
                  aria-label={`${m.label} · ${ROLE_LABEL[r]} · ${on ? 'เห็น' : 'ซ่อน'}`}
                  className={`grid size-6 place-items-center rounded-md border transition-colors ${
                    isLocked
                      ? 'cursor-not-allowed border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--fg-subtle)]'
                      : on
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90'
                        : 'border-[var(--border-strong)] bg-transparent text-transparent hover:border-[var(--accent)]'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 size={13} className="animate-spin text-[var(--fg-muted)]" />
                  ) : isLocked ? (
                    <Lock size={12} />
                  ) : on ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : null}
                </button>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
