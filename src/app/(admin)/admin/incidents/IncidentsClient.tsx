'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Plus, CircleDot, Archive } from 'lucide-react'
import type { Incident, IncidentType } from '@/types'

const TYPE_LABEL: Record<IncidentType, string> = {
  flood: 'น้ำท่วม',
  storm: 'พายุ',
  other: 'อื่นๆ',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'กำลังเกิด',
  monitoring: 'เฝ้าระวัง',
  closed: 'สิ้นสุดแล้ว',
}

function fmt(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function IncidentsClient() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState<IncidentType>('flood')
  const [province, setProvince] = useState('')
  const [amphoe, setAmphoe] = useState('')
  const [tambon, setTambon] = useState('')
  const [description, setDescription] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/incidents')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setIncidents(json.data as Incident[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 0) // defer initial fetch out of effect body
    return () => clearTimeout(t)
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, province, amphoe, tambon, description }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เปิดเหตุการณ์ไม่สำเร็จ')
      setName(''); setProvince(''); setAmphoe(''); setTambon(''); setDescription('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id: string, status: 'active' | 'closed') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'อัปเดตสถานะไม่สำเร็จ')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  const activeCount = incidents.filter((i) => i.status === 'active').length

  const inputCls =
    'h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)]'

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
          โหมดวิกฤต · เหตุการณ์ภัยพิบัติ
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">เหตุการณ์ (Incidents)</h1>
        <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
          เปิดเหตุการณ์เพื่อเข้าสู่โหมดวิกฤต — ข้อมูลภาคสนามใหม่จะถูกผูกกับเหตุการณ์ที่กำลังเกิด
          {activeCount > 0 && (
            <span className="ml-1 font-medium text-[var(--risk-flood)]">
              · กำลังเกิด {activeCount} เหตุการณ์
            </span>
          )}
        </p>
      </div>

      <form
        onSubmit={create}
        className="mt-6 rounded-lg border border-[var(--border)] p-4"
      >
        <h2 className="flex items-center gap-2 text-[12px] font-medium">
          <Plus size={14} strokeWidth={2} /> เปิดเหตุการณ์ใหม่
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className={`${inputCls} sm:col-span-2`}
            placeholder="ชื่อเหตุการณ์ เช่น น้ำท่วม ต.สันทราย ต.ค. 2568"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className={inputCls}
            value={type}
            onChange={(e) => setType(e.target.value as IncidentType)}
          >
            <option value="flood">น้ำท่วม</option>
            <option value="storm">พายุ</option>
            <option value="other">อื่นๆ</option>
          </select>
          <input className={inputCls} placeholder="จังหวัด" value={province} onChange={(e) => setProvince(e.target.value)} />
          <input className={inputCls} placeholder="อำเภอ" value={amphoe} onChange={(e) => setAmphoe(e.target.value)} />
          <input className={inputCls} placeholder="ตำบล" value={tambon} onChange={(e) => setTambon(e.target.value)} />
          <input className={`${inputCls} sm:col-span-2`} placeholder="รายละเอียด (ไม่บังคับ)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[12.5px] font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <AlertTriangle size={14} strokeWidth={2} /> เปิดเหตุการณ์
          </button>
          {error && <span className="text-[12px] text-[var(--risk-flood)]">{error}</span>}
        </div>
      </form>

      <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
        {loading && <li className="px-4 py-6 text-center text-[13px] text-[var(--fg-subtle)]">กำลังโหลด…</li>}
        {!loading && incidents.length === 0 && (
          <li className="px-4 py-6 text-center text-[13px] text-[var(--fg-subtle)]">ยังไม่มีเหตุการณ์</li>
        )}
        {incidents.map((inc) => {
          const isActive = inc.status === 'active'
          return (
            <li key={inc.id} className="flex items-center gap-4 px-4 py-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: isActive
                    ? 'color-mix(in oklch, var(--risk-flood) 14%, transparent)'
                    : 'var(--bg-elevated)',
                  color: isActive ? 'var(--risk-flood)' : 'var(--fg-subtle)',
                }}
              >
                {isActive ? <CircleDot size={15} strokeWidth={1.75} /> : <Archive size={15} strokeWidth={1.75} />}
              </span>
              <div className="flex-1">
                <div className="text-[14px] font-medium">{inc.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--fg-subtle)]">
                  <span>{TYPE_LABEL[inc.type] ?? inc.type}</span>
                  <span>{STATUS_LABEL[inc.status] ?? inc.status}</span>
                  {[inc.tambon, inc.amphoe, inc.province].filter(Boolean).length > 0 && (
                    <span>{[inc.tambon, inc.amphoe, inc.province].filter(Boolean).join(' · ')}</span>
                  )}
                  <span>เริ่ม {fmt(inc.startedAt)}</span>
                  {inc.endedAt && <span>สิ้นสุด {fmt(inc.endedAt)}</span>}
                </div>
              </div>
              {isActive ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(inc.id, 'closed')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[12px] text-[var(--fg-muted)] transition-colors hover:border-[var(--risk-flood)] hover:text-[var(--risk-flood)] disabled:opacity-50"
                >
                  ปิดเหตุการณ์
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(inc.id, 'active')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-[12px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                >
                  เปิดอีกครั้ง
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
