'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, MapPin } from 'lucide-react'
import type { IncidentArea } from '@/types'

interface GeoOpt {
  id: number
  nameTh: string
}

interface Row {
  amphoeId: number | ''
  tambonId: number | ''
}

interface Props {
  /** จังหวัดของเหตุการณ์ (ทุกพื้นที่อยู่ในจังหวัดนี้) — '' = ยังไม่เลือก (national) */
  province: string
  value: IncidentArea[]
  onChange: (areas: IncidentArea[]) => void
}

const selectCls =
  'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[13px] outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--bg-sunken)] disabled:opacity-60'

export function AreaPicker({ province, value, onChange }: Props) {
  const [provinceId, setProvinceId] = useState<number | ''>('')
  const [districts, setDistricts] = useState<GeoOpt[]>([])
  const [subByDistrict, setSubByDistrict] = useState<Record<number, GeoOpt[]>>({})
  const [rows, setRows] = useState<Row[]>([{ amphoeId: '', tambonId: '' }])
  const hydratedRef = useRef(false)

  // resolve provinceId จากชื่อจังหวัด
  useEffect(() => {
    if (!province) { setProvinceId(''); setDistricts([]); return }
    fetch('/api/geo/provinces', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: GeoOpt[]) => {
        if (!Array.isArray(d)) return
        const p = d.find((o) => o.nameTh === province)
        setProvinceId(p?.id ?? '')
      })
      .catch(() => {})
  }, [province])

  // โหลดอำเภอของจังหวัด
  useEffect(() => {
    if (provinceId === '') { setDistricts([]); return }
    fetch(`/api/geo/districts?provinceId=${provinceId}`)
      .then((r) => r.json())
      .then((d: GeoOpt[]) => { if (Array.isArray(d)) setDistricts(d) })
      .catch(() => {})
  }, [provinceId])

  function loadSubdistricts(districtId: number) {
    if (subByDistrict[districtId]) return
    fetch(`/api/geo/subdistricts?districtId=${districtId}`)
      .then((r) => r.json())
      .then((d: GeoOpt[]) => { if (Array.isArray(d)) setSubByDistrict((m) => ({ ...m, [districtId]: d })) })
      .catch(() => {})
  }

  // hydrate rows จาก value เดิม (ตอนแก้ไขเหตุการณ์) — เมื่ออำเภอพร้อม
  useEffect(() => {
    if (hydratedRef.current || districts.length === 0) return
    if (value.length > 0) {
      const hydrated: Row[] = value.map((a) => {
        const d = districts.find((o) => o.nameTh === a.amphoe)
        if (d) loadSubdistricts(d.id)
        return { amphoeId: d?.id ?? '', tambonId: '', _tambonName: a.tambon } as Row & { _tambonName?: string | null }
      })
      setRows(hydrated)
    }
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts])

  // map ชื่อตำบลที่ hydrate ค้างไว้ → id เมื่อ subdistricts ของอำเภอนั้นโหลดเสร็จ
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => {
        const pending = (r as Row & { _tambonName?: string | null })._tambonName
        if (r.amphoeId === '' || r.tambonId !== '' || !pending) return r
        const subs = subByDistrict[r.amphoeId]
        if (!subs) return r
        const s = subs.find((o) => o.nameTh === pending)
        return { amphoeId: r.amphoeId, tambonId: s?.id ?? '' }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subByDistrict])

  // emit IncidentArea[] (ชื่อ) ทุกครั้งที่ rows/province เปลี่ยน
  const districtName = (id: number | '') => (id === '' ? null : districts.find((o) => o.id === id)?.nameTh ?? null)
  const subName = (aId: number | '', tId: number | '') =>
    aId === '' || tId === '' ? null : subByDistrict[aId]?.find((o) => o.id === tId)?.nameTh ?? null

  useEffect(() => {
    const areas: IncidentArea[] = rows
      .filter((r) => r.amphoeId !== '')
      .map((r) => ({ province: province || null, amphoe: districtName(r.amphoeId), tambon: subName(r.amphoeId, r.tambonId) }))
    onChange(areas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, province, districts, subByDistrict])

  function setRow(i: number, next: Row) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? next : r)))
  }
  function addRow() { setRows((prev) => [...prev, { amphoeId: '', tambonId: '' }]) }
  function removeRow(i: number) { setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))) }

  const disabled = provinceId === ''

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg-muted)]">
          <MapPin size={13} className="text-[var(--accent)]" /> พื้นที่ผลกระทบ
          <span className="font-normal text-[var(--fg-subtle)]">(เพิ่มได้หลายอำเภอ/ตำบล)</span>
        </span>
      </div>

      {rows.map((row, i) => {
        const subs = row.amphoeId === '' ? [] : subByDistrict[row.amphoeId] ?? []
        return (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <select
              className={selectCls}
              value={row.amphoeId === '' ? '' : String(row.amphoeId)}
              disabled={disabled}
              onChange={(e) => {
                const id = e.target.value === '' ? '' : Number(e.target.value)
                if (id !== '') loadSubdistricts(id)
                setRow(i, { amphoeId: id, tambonId: '' })
              }}
            >
              <option value="">{disabled ? 'เลือกจังหวัดก่อน' : '— เลือกอำเภอ —'}</option>
              {districts.map((d) => <option key={d.id} value={String(d.id)}>{d.nameTh}</option>)}
            </select>
            <select
              className={selectCls}
              value={row.tambonId === '' ? '' : String(row.tambonId)}
              disabled={row.amphoeId === ''}
              onChange={(e) => setRow(i, { ...row, tambonId: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              <option value="">{row.amphoeId === '' ? 'เลือกอำเภอก่อน' : 'ทั้งอำเภอ'}</option>
              {subs.map((s) => <option key={s.id} value={String(s.id)}>{s.nameTh}</option>)}
            </select>
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--fg-subtle)] hover:border-[var(--risk-flood)] hover:text-[var(--risk-flood)] disabled:opacity-40"
              title="ลบพื้นที่นี้"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addRow}
        disabled={disabled}
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        <Plus size={14} /> เพิ่มพื้นที่
      </button>
    </div>
  )
}
