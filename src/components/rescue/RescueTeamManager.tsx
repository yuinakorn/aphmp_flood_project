'use client'

import { useState } from 'react'
import { Anchor, Plus, Pencil, Trash2, Check, X as XIcon } from 'lucide-react'
import type { RescueTeam, RescueTeamType } from '@/types'

export const teamTypeLabel: Record<RescueTeamType, string> = {
  rescue_boat: 'เรือกู้ภัยน้ำหลาก',
  gmc_truck: 'รถบรรทุกลุยน้ำ GMC',
  ems_medical: 'หน่วยแพทย์สนามฉุกเฉิน',
  mcat_psych: 'หน่วยสุขภาพจิต MCAT',
  volunteer_kitchen: 'ครัวพระราชทาน/อาหาร',
  other: 'อื่นๆ',
}
export const TEAM_TYPES = Object.keys(teamTypeLabel) as RescueTeamType[]

export const STATUS_META: Record<RescueTeam['status'], { label: string; cls: string }> = {
  active:  { label: 'พร้อม',    cls: 'gx-badge gx-badge-safe' },
  standby: { label: 'รอสั่งการ', cls: 'gx-badge gx-badge-near' },
  offline: { label: 'ออฟไลน์',  cls: 'gx-badge' },
}
export const STATUS_CYCLE: RescueTeam['status'][] = ['active', 'standby', 'offline']

type Mode = 'manage' | 'dispatch'

/**
 * ทะเบียน/จัดการทีมกู้ภัย — ใช้ร่วมกัน 2 บริบท
 *  - mode="manage"  : หน้าจัดการ (ข้อมูล & ระบบ) — ฟอร์มขึ้นทะเบียนถาวร + แก้ไข/ลบ
 *  - mode="dispatch": แท็บใน EOC — รายชื่อ + สลับสถานะ + "เพิ่มทีมด่วน" ผ่าน modal (CRUD เต็มไปทำที่หน้าจัดการ)
 */
export function RescueTeamManager({
  teams,
  canManage,
  onChange,
  mode = 'manage',
}: {
  teams: RescueTeam[]
  canManage: boolean
  onChange: () => void
  mode?: Mode
}) {
  const [name, setName] = useState('')
  const [teamType, setTeamType] = useState<RescueTeamType>('rescue_boat')
  const [contact, setContact] = useState('')
  const [zone, setZone] = useState('')
  const [saving, setSaving] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false) // เปิดฟอร์มเพิ่มด่วน (dispatch mode)

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<RescueTeamType>('rescue_boat')
  const [editContact, setEditContact] = useState('')
  const [editZone, setEditZone] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const allowEdit = mode === 'manage' // แก้ไข/ลบ ทำเฉพาะหน้าจัดการ

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/rescue-teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, teamType, contact, zone }),
    }).catch(() => {})
    setSaving(false)
    setName(''); setContact(''); setZone('')
    setQuickAdd(false)
    onChange()
  }

  function startEdit(t: RescueTeam) {
    setEditId(t.id)
    setEditName(t.name)
    setEditType(t.teamType)
    setEditContact(t.contact ?? '')
    setEditZone(t.zone ?? '')
  }

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return
    setEditSaving(true)
    await fetch(`/api/rescue-teams/${editId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editName, teamType: editType, contact: editContact, zone: editZone }),
    }).catch(() => {})
    setEditSaving(false)
    setEditId(null)
    onChange()
  }

  const cycleStatus = async (t: RescueTeam) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(t.status) + 1) % STATUS_CYCLE.length]
    await fetch(`/api/rescue-teams/${t.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    }).catch(() => {})
    onChange()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    await fetch(`/api/rescue-teams/${deleteId}`, { method: 'DELETE' }).catch(() => {})
    setDeleteId(null)
    onChange()
  }

  // ── ฟอร์มขึ้นทะเบียน (ใช้ทั้งแบบถาวรในหน้าจัดการ และในกล่องเพิ่มด่วน) ──
  const createForm = (
    <div className="grid grid-cols-2 gap-2.5 text-sm">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อหน่วยงาน" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5 outline-none focus:border-[var(--accent)]" />
      <select value={teamType} onChange={(e) => setTeamType(e.target.value as RescueTeamType)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5">
        {TEAM_TYPES.map((t) => <option key={t} value={t}>{teamTypeLabel[t]}</option>)}
      </select>
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="เบอร์ติดต่อ" className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5 outline-none focus:border-[var(--accent)]" />
      <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="โซนรับผิดชอบ" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5 outline-none focus:border-[var(--accent)]" />
    </div>
  )

  return (
    <div className="space-y-3">
      {/* ── ฟอร์มขึ้นทะเบียนถาวร (เฉพาะหน้าจัดการ) ── */}
      {mode === 'manage' && canManage && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ขึ้นทะเบียนทีมกู้ภัย / หน่วยเคลื่อนที่เร็ว</p>
          {createForm}
          <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm mt-3 w-full">
            <Plus size={14} /> {saving ? 'กำลังบันทึก...' : 'ขึ้นทะเบียน'}
          </button>
        </div>
      )}

      {/* ── หัวแท็บใน EOC: ปุ่มเพิ่มด่วน + ลิงก์ไปหน้าจัดการ ── */}
      {mode === 'dispatch' && canManage && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setQuickAdd(true)}
            className="gx-btn gx-btn-ghost gx-btn-sm"
          >
            <Plus size={14} /> เพิ่มทีมด่วน
          </button>
          <a href="/admin/settings/rescue-teams" className="text-xs text-[var(--fg-muted)] underline-offset-2 hover:text-[var(--fg)] hover:underline">
            จัดการทะเบียนทีม →
          </a>
        </div>
      )}

      <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {teams.map((t) => (
          <li key={t.id} className="border-b border-[var(--border)] last:border-b-0">
            {allowEdit && editId === t.id ? (
              /* ── inline edit ── */
              <div className="space-y-2 p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2 outline-none focus:border-[var(--accent)]" />
                  <select value={editType} onChange={(e) => setEditType(e.target.value as RescueTeamType)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2">
                    {TEAM_TYPES.map((ty) => <option key={ty} value={ty}>{teamTypeLabel[ty]}</option>)}
                  </select>
                  <input value={editContact} onChange={(e) => setEditContact(e.target.value)} placeholder="เบอร์ติดต่อ" className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2 outline-none focus:border-[var(--accent)]" />
                  <input value={editZone} onChange={(e) => setEditZone(e.target.value)} placeholder="โซนรับผิดชอบ" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2 outline-none focus:border-[var(--accent)]" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={saveEdit} disabled={editSaving} className="gx-btn gx-btn-primary gx-btn-sm flex-1 disabled:opacity-50">
                    <Check size={13} /> {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                  <button type="button" onClick={() => setEditId(null)} className="gx-btn gx-btn-ghost gx-btn-sm">
                    <XIcon size={13} /> ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              /* ── normal row ── */
              <div className="flex items-center gap-3 px-4 py-3" style={{ ['--tile' as string]: 'var(--signal-data)' }}>
                <span className="gx-icon-tile size-9 shrink-0"><Anchor size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--fg)]">{t.name}</p>
                  <p className="truncate text-xs text-[var(--fg-muted)]">{teamTypeLabel[t.teamType]}{t.zone ? ` · ${t.zone}` : ''}{t.contact ? ` · ${t.contact}` : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => canManage && cycleStatus(t)}
                  disabled={!canManage}
                  title={canManage ? 'คลิกเพื่อเปลี่ยนสถานะ' : undefined}
                  className={`shrink-0 ${canManage ? 'cursor-pointer' : 'cursor-default'} ${STATUS_META[t.status].cls}`}
                >
                  <span className="gx-badge-dot" />{STATUS_META[t.status].label}
                </button>
                {allowEdit && canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => startEdit(t)} className="gx-btn gx-btn-ghost gx-btn-sm" title="แก้ไข">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => setDeleteId(t.id)} className="gx-btn gx-btn-ghost gx-btn-sm text-[var(--risk-flood)] hover:!border-[var(--risk-flood)]" title="ลบ">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {teams.length === 0 && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีทีมขึ้นทะเบียน</li>}
      </ul>

      {/* ── เพิ่มทีมด่วน (dispatch mode) ── */}
      {quickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--fg)]">เพิ่มทีมด่วน</p>
              <button type="button" onClick={() => setQuickAdd(false)} className="gx-btn gx-btn-ghost gx-btn-sm" title="ปิด">
                <XIcon size={14} />
              </button>
            </div>
            {createForm}
            <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm mt-3 w-full">
              <Plus size={14} /> {saving ? 'กำลังบันทึก...' : 'เพิ่มทีม'}
            </button>
            <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
              แก้ไข/ลบ และจัดการรายละเอียดทั้งหมดทำได้ที่หน้า <a href="/admin/settings/rescue-teams" className="underline">จัดการทะเบียนทีม</a>
            </p>
          </div>
        </div>
      )}

      {/* ── confirm delete ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-2xl">
            <p className="text-sm font-semibold text-[var(--fg)]">ยืนยันการลบทีม</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              {teams.find((t) => t.id === deleteId)?.name} — ข้อมูลจะถูกลบถาวร
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={confirmDelete} className="gx-btn gx-btn-sm flex-1 border-[var(--risk-flood)] bg-[var(--risk-flood)] text-white hover:opacity-90">
                <Trash2 size={13} /> ลบ
              </button>
              <button type="button" onClick={() => setDeleteId(null)} className="gx-btn gx-btn-ghost gx-btn-sm flex-1">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
