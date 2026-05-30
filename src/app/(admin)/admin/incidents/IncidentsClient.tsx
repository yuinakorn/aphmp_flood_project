'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus, CircleDot, Archive, Siren, Crosshair, Check } from 'lucide-react'
import type { Incident, IncidentType } from '@/types'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'

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
  const router = useRouter()
  const scope = useIncidentScope()
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
  const monitoringCount = incidents.filter((i) => i.status === 'monitoring').length

  const inputCls =
    'h-10 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]'

  const statusBadge = (s: string) =>
    s === 'active' ? 'gx-badge gx-badge-flood' : s === 'monitoring' ? 'gx-badge gx-badge-near' : 'gx-badge'

  return (
    <div className="mx-auto max-w-5xl">
      {activeCount > 0 && (
        <div className="gx-banner-crisis mb-5">
          <AlertTriangle size={18} className="shrink-0" />
          <span>
            ระบบอยู่ใน <strong>โหมดวิกฤต</strong> · กำลังเกิด {activeCount} เหตุการณ์ ข้อมูลภาคสนามใหม่จะถูกผูกกับเหตุการณ์ที่ active โดยอัตโนมัติ
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">โหมดวิกฤต · เหตุการณ์ภัยพิบัติ</p>
          <h1 className="gx-title mt-1.5">เหตุการณ์ (Incidents)</h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            เปิดเหตุการณ์เพื่อเข้าสู่โหมดวิกฤต — ข้อมูลภาคสนามใหม่จะถูกผูกกับเหตุการณ์ที่กำลังเกิด
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="gx-badge gx-badge-flood"><span className="gx-badge-dot" />active {activeCount}</span>
          {monitoringCount > 0 && <span className="gx-badge gx-badge-near"><span className="gx-badge-dot" />monitoring {monitoringCount}</span>}
        </div>
      </div>

      <form onSubmit={create} className="gx-card mt-6 p-5" style={{ ['--tile' as string]: 'var(--risk-flood)' }}>
        <div className="mb-4 flex items-center gap-3">
          <span className="gx-icon-tile size-10"><Siren size={18} strokeWidth={1.75} /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">เปิดเหตุการณ์ใหม่</p>
            <p className="text-xs text-[var(--fg-muted)]">การเปิดเหตุการณ์จะกระตุ้นโหมดวิกฤตทันที ทุกระบบที่เกี่ยวข้องจะตอบสนอง</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className={`${inputCls} sm:col-span-2`}
            placeholder="ชื่อเหตุการณ์ เช่น น้ำท่วม ต.สันทราย ต.ค. 2568"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as IncidentType)}>
            <option value="flood">น้ำท่วม</option>
            <option value="storm">พายุ</option>
            <option value="other">อื่นๆ</option>
          </select>
          <input className={inputCls} placeholder="จังหวัด" value={province} onChange={(e) => setProvince(e.target.value)} />
          <input className={inputCls} placeholder="อำเภอ" value={amphoe} onChange={(e) => setAmphoe(e.target.value)} />
          <input className={inputCls} placeholder="ตำบล" value={tambon} onChange={(e) => setTambon(e.target.value)} />
          <input className={`${inputCls} sm:col-span-2`} placeholder="รายละเอียด (ไม่บังคับ)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={busy || !name.trim()} className="gx-btn gx-btn-primary disabled:opacity-50">
            <AlertTriangle size={16} strokeWidth={2} /> {busy ? 'กำลังเปิด...' : 'เปิดเหตุการณ์'}
          </button>
          {error && <span className="text-sm text-[var(--risk-flood)]">{error}</span>}
        </div>
      </form>

      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-[var(--fg)]">เหตุการณ์ทั้งหมด <span className="ml-1.5 font-mono text-[var(--fg-subtle)]">{incidents.length}</span></h2>
      </div>

      <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {loading && <li className="px-4 py-8 text-center text-sm text-[var(--fg-subtle)]">กำลังโหลด…</li>}
        {!loading && incidents.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีเหตุการณ์ — เปิดเหตุการณ์แรกด้านบนเพื่อเริ่ม</li>
        )}
        {incidents.map((inc) => {
          const isActive = inc.status === 'active'
          const place = [inc.tambon, inc.amphoe, inc.province].filter(Boolean).join(' · ')
          return (
            <li key={inc.id} className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 last:border-b-0">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: isActive ? 'color-mix(in oklch, var(--risk-flood) 14%, transparent)' : 'var(--bg-sunken)',
                  color: isActive ? 'var(--risk-flood)' : 'var(--fg-subtle)',
                }}
              >
                {isActive ? <CircleDot size={18} strokeWidth={1.75} /> : <Archive size={18} strokeWidth={1.75} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="truncate text-sm font-semibold text-[var(--fg)]">{inc.name}</span>
                  <span className={statusBadge(inc.status)}><span className="gx-badge-dot" />{STATUS_LABEL[inc.status] ?? inc.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-subtle)]">
                  <span>{TYPE_LABEL[inc.type] ?? inc.type}</span>
                  {place && <span>{place}</span>}
                  <span className="font-mono">เริ่ม {fmt(inc.startedAt)}</span>
                  {inc.endedAt && <span className="font-mono">สิ้นสุด {fmt(inc.endedAt)}</span>}
                </div>
              </div>
              {(() => {
                const isScoped = scope.active?.id === inc.id
                return (
                  <button
                    type="button"
                    disabled={scope.isSwitching || inc.status === 'closed'}
                    onClick={async () => { await scope.setScope(inc.id); router.push('/admin/eoc') }}
                    title={isScoped ? 'เหตุการณ์ปัจจุบัน — เปิด EOC' : 'ตั้งเป็นเหตุการณ์ที่กำลังจัดการ + เปิด EOC'}
                    className={
                      isScoped
                        ? 'gx-btn gx-btn-primary gx-btn-sm'
                        : 'gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)] disabled:opacity-50'
                    }
                  >
                    {isScoped ? <Check size={13} /> : <Crosshair size={13} />}
                    {isScoped ? 'กำลังจัดการ' : 'จัดการเหตุการณ์นี้'}
                  </button>
                )
              })()}
              {isActive ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(inc.id, 'closed')}
                  className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)] disabled:opacity-50"
                >
                  ปิดเหตุการณ์
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(inc.id, 'active')}
                  className="gx-btn gx-btn-ghost gx-btn-sm disabled:opacity-50"
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
