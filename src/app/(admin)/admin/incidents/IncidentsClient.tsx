'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CircleDot, Archive, Siren, Crosshair, Check, Lock, ShieldAlert, MapPinned } from 'lucide-react'
import type { Incident, IncidentArea, IncidentType } from '@/types'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'
import { AreaPicker } from './AreaPicker'

interface IncidentsClientProps {
  canCreate: boolean
  province: string | null
  isNational: boolean
  provinceOptions: string[]
}

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

/** สรุปพื้นที่ผลกระทบ — รองรับหลายอำเภอ/ตำบล */
function summarizeAreas(inc: Incident): string {
  const areas = inc.areas ?? []
  if (areas.length === 0) {
    return [inc.tambon, inc.amphoe, inc.province].filter(Boolean).join(' · ')
  }
  const province = areas[0].province ?? inc.province ?? null
  const labels = areas.map((a) =>
    a.tambon ? `${a.amphoe ?? ''}/${a.tambon}` : a.amphoe ? `อ.${a.amphoe}` : 'ทั้งจังหวัด',
  )
  const head = labels.slice(0, 2).join(', ')
  const more = labels.length > 2 ? ` +${labels.length - 2}` : ''
  return [province, `${head}${more}`].filter(Boolean).join(' · ')
}

export function IncidentsClient({ canCreate, province: myProvince, isNational, provinceOptions }: IncidentsClientProps) {
  const router = useRouter()
  const scope = useIncidentScope()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState<IncidentType>('flood')
  // non-national: ล็อกเป็นจังหวัดสังกัด · national: เลือกเองจาก dropdown
  const [province, setProvince] = useState(isNational ? '' : (myProvince ?? ''))
  const [areas, setAreas] = useState<IncidentArea[]>([])
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
    const filledAreas = areas.filter((a) => a.amphoe || a.tambon)
    if (filledAreas.length === 0) { setError('ระบุพื้นที่ผลกระทบอย่างน้อย 1 อำเภอ'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, province, areas: filledAreas, description }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เปิดเหตุการณ์ไม่สำเร็จ')
      setName(''); setProvince(isNational ? '' : (myProvince ?? '')); setAreas([]); setDescription('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  // แก้ไขพื้นที่ผลกระทบของเหตุการณ์ที่มีอยู่ (ขยาย/ถอนพื้นที่)
  const [editAreasId, setEditAreasId] = useState<string | null>(null)
  const [editAreas, setEditAreas] = useState<IncidentArea[]>([])

  async function saveAreas(id: string, incProvince: string) {
    const filled = editAreas.filter((a) => a.amphoe || a.tambon)
    if (filled.length === 0) { setError('ต้องมีพื้นที่อย่างน้อย 1 อำเภอ'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areas: filled.map((a) => ({ ...a, province: incProvince })) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'บันทึกพื้นที่ไม่สำเร็จ')
      setEditAreasId(null)
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
        <div className="gx-banner-crisis mb-3 py-2 text-[13px]">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            <strong>โหมดวิกฤต</strong> · กำลังเกิด {activeCount} เหตุการณ์ — ข้อมูลภาคสนามใหม่ผูกกับเหตุการณ์ที่ active อัตโนมัติ
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="gx-title">เหตุการณ์ (Incidents)</h1>
          <p className="text-xs text-[var(--fg-subtle)]">เปิดเหตุการณ์เพื่อเข้าสู่โหมดวิกฤต</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="gx-badge gx-badge-flood"><span className="gx-badge-dot" />active {activeCount}</span>
          {monitoringCount > 0 && <span className="gx-badge gx-badge-near"><span className="gx-badge-dot" />monitoring {monitoringCount}</span>}
        </div>
      </div>

      {canCreate ? (
        <form onSubmit={create} className="gx-card mt-3 p-4" style={{ ['--tile' as string]: 'var(--risk-flood)' }}>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="gx-icon-tile size-9"><Siren size={16} strokeWidth={1.75} /></span>
            <div>
              <p className="text-sm font-semibold text-[var(--fg)]">เปิดเหตุการณ์ใหม่</p>
              <p className="text-xs text-[var(--fg-muted)]">กระตุ้นโหมดวิกฤตทันที ทุกระบบที่เกี่ยวข้องจะตอบสนอง</p>
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
            {isNational ? (
              <select className={inputCls} value={province} onChange={(e) => setProvince(e.target.value)} required>
                <option value="">— เลือกจังหวัด —</option>
                {provinceOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <div className={`${inputCls} flex items-center gap-2 !bg-[var(--bg-sunken)] text-[var(--fg-muted)]`} title="จังหวัดสังกัดของคุณ — ล็อกอัตโนมัติ">
                <Lock size={13} strokeWidth={1.75} className="shrink-0 text-[var(--fg-subtle)]" />
                <span className="truncate">{myProvince ?? 'ไม่พบจังหวัดสังกัด'}</span>
              </div>
            )}
            <div className="sm:col-span-2">
              <AreaPicker province={province} value={areas} onChange={setAreas} />
            </div>
            <input className={`${inputCls} sm:col-span-2`} placeholder="รายละเอียด (ไม่บังคับ)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={busy || !name.trim()} className="gx-btn gx-btn-primary disabled:opacity-50">
              <AlertTriangle size={16} strokeWidth={2} /> {busy ? 'กำลังเปิด...' : 'เปิดเหตุการณ์'}
            </button>
            {error && <span className="text-sm text-[var(--risk-flood)]">{error}</span>}
          </div>
        </form>
      ) : (
        <div className="gx-card mt-6 flex items-start gap-3 p-5">
          <span className="gx-icon-tile size-10"><ShieldAlert size={18} strokeWidth={1.75} /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">ดูได้อย่างเดียว</p>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              เฉพาะผู้บัญชาการ (EOC / ผู้ดูแลระบบ / ปภ.) เท่านั้นที่เปิดหรือปิดเหตุการณ์ได้
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-[var(--fg)]">เหตุการณ์ทั้งหมด <span className="ml-1.5 font-mono text-[var(--fg-subtle)]">{incidents.length}</span></h2>
      </div>

      <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {loading && <li className="px-4 py-8 text-center text-sm text-[var(--fg-subtle)]">กำลังโหลด…</li>}
        {!loading && incidents.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีเหตุการณ์ — เปิดเหตุการณ์แรกด้านบนเพื่อเริ่ม</li>
        )}
        {incidents.map((inc) => {
          const isActive = inc.status === 'active'
          const place = summarizeAreas(inc)
          return (
            <li key={inc.id} className="border-b border-[var(--border)] px-4 py-3.5 last:border-b-0">
              <div className="flex items-center gap-4">
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
              {canCreate && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (editAreasId === inc.id) { setEditAreasId(null); return }
                    setEditAreas(inc.areas ?? [])
                    setEditAreasId(inc.id)
                  }}
                  className={`gx-btn gx-btn-sm disabled:opacity-50 ${editAreasId === inc.id ? 'gx-btn-primary' : 'gx-btn-ghost hover:!border-[var(--accent)] hover:!text-[var(--accent)]'}`}
                  title="จัดการพื้นที่ผลกระทบ"
                >
                  <MapPinned size={13} /> พื้นที่ {inc.areas?.length ? `(${inc.areas.length})` : ''}
                </button>
              )}
              {canCreate && (isActive ? (
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
              ))}
              </div>

              {editAreasId === inc.id && (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-3.5">
                  <AreaPicker
                    province={inc.areas?.[0]?.province ?? inc.province ?? ''}
                    value={inc.areas ?? []}
                    onChange={setEditAreas}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveAreas(inc.id, inc.areas?.[0]?.province ?? inc.province ?? '')}
                      className="gx-btn gx-btn-primary gx-btn-sm disabled:opacity-50"
                    >
                      <Check size={13} /> บันทึกพื้นที่
                    </button>
                    <button type="button" onClick={() => setEditAreasId(null)} className="gx-btn gx-btn-ghost gx-btn-sm">
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
