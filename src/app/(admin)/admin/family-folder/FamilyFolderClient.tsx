'use client'

import { useState, useMemo } from 'react'
import {
  X, Home, Users, Search, MapPin, FolderHeart,
  Droplets, Tent, ChevronRight,
} from 'lucide-react'
import type { VulnerableHousehold, HouseholdMember, VillageSummary } from '@/lib/family-folder'
import type { RiskLevel } from '@/types'

const groupColor: Record<string, string> = {
  ผู้สูงอายุ: 'var(--risk-near)',
  เด็กเล็ก: 'oklch(0.65 0.16 350)',
  ผู้พิการ: 'oklch(0.58 0.18 305)',
  โรคเรื้อรัง: 'var(--risk-flood)',
  ทั่วไป: 'var(--fg-subtle)',
}
const groupBg: Record<string, string> = {
  ผู้สูงอายุ: 'oklch(0.95 0.05 80 / 0.5)',
  เด็กเล็ก: 'oklch(0.95 0.04 350 / 0.5)',
  ผู้พิการ: 'oklch(0.95 0.04 305 / 0.5)',
  โรคเรื้อรัง: 'oklch(0.95 0.04 25 / 0.5)',
  ทั่วไป: 'var(--bg-sunken)',
}

const RISK_META: Record<RiskLevel, { label: string; tone: string }> = {
  flood: { label: 'ในเขตน้ำท่วม', tone: 'var(--risk-flood)' },
  near: { label: 'ใกล้เขตน้ำท่วม', tone: 'var(--risk-near)' },
  safe: { label: 'นอกเขต', tone: 'var(--risk-safe)' },
}
const RISK_RANK: Record<RiskLevel, number> = { flood: 0, near: 1, safe: 2 }
const EVAC = 'oklch(0.55 0.13 250)' // น้ำเงิน "อพยพแล้ว" (ยังไม่มี token กลาง)

interface Props {
  summary: VillageSummary[]
  initialHouseholds: VulnerableHousehold[]
  total: number
  isCrisis: boolean
  incidentName: string | null
}

export function FamilyFolderClient({ summary, initialHouseholds, total, isCrisis, incidentName }: Props) {
  const [households] = useState<VulnerableHousehold[]>(initialHouseholds)
  const [selectedVcode, setSelectedVcode] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedHouse, setSelectedHouse] = useState<VulnerableHousehold | null>(null)

  const selectedVname = selectedVcode ? summary.find((s) => s.vcode === selectedVcode)?.vname : null

  // จำนวนบ้านเสี่ยงต่อหมู่บ้าน (โหมดวิกฤต) — derive จากชุดที่โหลดมา
  const floodByVillage = useMemo(() => {
    const m = new Map<string, number>()
    if (!isCrisis) return m
    for (const h of households) {
      if (h.floodRisk === 'flood') m.set(h.village, (m.get(h.village) ?? 0) + 1)
    }
    return m
  }, [households, isCrisis])

  const filtered = useMemo(() => {
    let list = households
    if (selectedVname) list = list.filter((h) => h.village === selectedVname)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (h) =>
          h.hno.toLowerCase().includes(q) ||
          h.village.toLowerCase().includes(q) ||
          h.members.some((m) => m.name.toLowerCase().includes(q)),
      )
    }
    // โหมดวิกฤต — บ้านเสี่ยง+ยังไม่อพยพ ขึ้นก่อน; ปกติ — คงลำดับ หมู่บ้าน→เลขที่บ้าน (server sort)
    if (isCrisis) {
      list = [...list].sort((a, b) => {
        const ra = RISK_RANK[a.floodRisk ?? 'safe'] * 2 + (a.evacuated ? 1 : 0)
        const rb = RISK_RANK[b.floodRisk ?? 'safe'] * 2 + (b.evacuated ? 1 : 0)
        return ra - rb
      })
    }
    return list
  }, [households, selectedVname, search, isCrisis])

  const ribbon: { label: string; value: number; sub: string; tone: string }[] = [
    { label: 'บ้านกลุ่มเปราะบาง', value: total, sub: 'หลัง', tone: 'var(--fg)' },
    { label: 'ผู้สูงอายุ', value: summary.reduce((s, v) => s + v.elderly, 0), sub: 'คน', tone: 'var(--risk-near)' },
    { label: 'เด็ก 0-5 ปี', value: summary.reduce((s, v) => s + v.children, 0), sub: 'คน', tone: 'oklch(0.62 0.16 350)' },
    { label: 'พิการ + เรื้อรัง', value: summary.reduce((s, v) => s + v.disabled + v.chronic, 0), sub: 'คน', tone: 'var(--risk-flood)' },
  ]
  if (isCrisis) {
    ribbon.push(
      { label: 'บ้านในเขตน้ำท่วม', value: households.filter((h) => h.floodRisk === 'flood').length, sub: 'หลัง', tone: 'var(--risk-flood)' },
      { label: 'อพยพแล้ว', value: households.filter((h) => h.evacuated).length, sub: 'หลัง', tone: EVAC },
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="gx-eyebrow">Family Folder{isCrisis && incidentName ? ` · ${incidentName}` : ''}</p>
          <h1 className="gx-title mt-1 flex items-center gap-2.5">
            <FolderHeart size={25} strokeWidth={1.75} className="text-[var(--cat-folder)]" />
            ครอบครัวกลุ่มเปราะบาง
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            ทะเบียนบ้านที่มีสมาชิกกลุ่มเปราะบาง — เลือกหมู่บ้านทางซ้าย หรือค้นหาเพื่อเปิดดูรายครัวเรือน
          </p>
        </div>
        {isCrisis && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--risk-flood)] bg-[var(--risk-flood)] px-3 py-1.5 text-sm font-medium text-white">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            โหมดวิกฤต · เรียงบ้านเสี่ยงขึ้นก่อน
          </span>
        )}
      </div>

      {/* ribbon — caseload ภาพรวม (ตัวเลขเป็น typography ไม่ใช่กล่อง) */}
      <div className="mt-4 flex flex-wrap items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {ribbon.map((s, i) => (
          <div key={s.label} className={`flex flex-col px-5 py-3 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">{s.label}</span>
            <span className="font-mono text-[26px] font-semibold leading-tight" style={{ color: s.tone }}>
              {s.value.toLocaleString('th-TH')}
              <span className="ml-1 text-xs font-normal text-[var(--fg-subtle)]">{s.sub}</span>
            </span>
          </div>
        ))}
      </div>

      {/* body — rail (หมู่บ้าน) + main (รายครัวเรือน) */}
      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        {/* ── RAIL: village navigator (desktop) ── */}
        <aside className="hidden lg:col-span-4 lg:block xl:col-span-3">
          <div className="lg:sticky lg:top-20">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              หมู่บ้าน <span className="font-mono">{summary.length}</span>
            </p>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              <VillageRow
                active={selectedVcode === null}
                onClick={() => setSelectedVcode(null)}
                name="ทุกหมู่บ้าน"
                count={total}
              />
              <div className="max-h-[62vh] overflow-y-auto">
                {summary.map((v) => (
                  <VillageRow
                    key={v.vcode}
                    active={selectedVcode === v.vcode}
                    onClick={() => setSelectedVcode(selectedVcode === v.vcode ? null : v.vcode)}
                    name={`${v.villno ? `ม.${v.villno} ` : ''}${v.vname}`}
                    count={v.vulnerableHouses}
                    mix={v}
                    floodCount={isCrisis ? floodByVillage.get(v.vname) ?? 0 : 0}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN: search + household worklist ── */}
        <main className="lg:col-span-8 xl:col-span-9">
          {/* mobile village select */}
          <select
            value={selectedVcode ?? ''}
            onChange={(e) => setSelectedVcode(e.target.value || null)}
            className="mb-2.5 block h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm outline-none focus:border-[var(--accent)] lg:hidden"
          >
            <option value="">ทุกหมู่บ้าน ({total} หลัง)</option>
            {summary.map((v) => (
              <option key={v.vcode} value={v.vcode}>
                {v.villno ? `ม.${v.villno} ` : ''}{v.vname} ({v.vulnerableHouses})
              </option>
            ))}
          </select>

          {/* search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
            <input
              type="search"
              placeholder="ค้นหาชื่อสมาชิก, เลขที่บ้าน, หมู่บ้าน…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* result context */}
          <div className="mb-2 mt-3 flex items-baseline justify-between gap-2 px-1">
            <p className="text-sm font-semibold text-[var(--fg)]">
              {selectedVname ? `${selectedVname}` : 'ทุกหมู่บ้าน'}
              <span className="ml-2 font-mono text-[var(--fg-subtle)]">{filtered.length} หลัง</span>
            </p>
            {selectedVcode && (
              <button onClick={() => setSelectedVcode(null)} className="text-xs text-[var(--fg-subtle)] hover:text-[var(--fg)]">
                ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* worklist */}
          {filtered.length > 0 ? (
            <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              {filtered.map((h) => (
                <HouseRow key={h.id} house={h} isCrisis={isCrisis} onClick={() => setSelectedHouse(h)} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-14 text-center">
              <Users size={26} className="mx-auto mb-2 text-[var(--fg-subtle)]" />
              <p className="text-sm font-medium text-[var(--fg-muted)]">
                {search.trim() ? `ไม่พบครัวเรือนที่ตรงกับ “${search.trim()}”` : 'หมู่บ้านนี้ยังไม่มีครัวเรือนกลุ่มเปราะบาง'}
              </p>
              {(search.trim() || selectedVcode) && (
                <button
                  onClick={() => { setSearch(''); setSelectedVcode(null) }}
                  className="mt-3 text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  ล้างการค้นหาและตัวกรอง
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {selectedHouse && (
        <HouseDrawer house={selectedHouse} isCrisis={isCrisis} onClose={() => setSelectedHouse(null)} />
      )}
    </div>
  )
}

// ── village navigator row ──
function VillageRow({
  active, onClick, name, count, mix, floodCount = 0,
}: {
  active: boolean
  onClick: () => void
  name: string
  count: number
  mix?: VillageSummary
  floodCount?: number
}) {
  const total = mix ? mix.elderly + mix.children + mix.disabled + mix.chronic : 0
  const seg = (n: number, color: string) =>
    n > 0 ? <span style={{ width: `${(n / total) * 100}%`, background: color }} /> : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-1.5 border-b border-[var(--border)] px-3.5 py-2.5 text-left transition-colors last:border-b-0 ${
        active ? 'bg-[color-mix(in_oklch,var(--accent)_9%,transparent)]' : 'hover:bg-[var(--bg-sunken)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`truncate text-[13.5px] ${active ? 'font-semibold text-[var(--fg)]' : 'font-medium text-[var(--fg)]'}`}>
          {name}
        </span>
        <span className="shrink-0 font-mono text-xs text-[var(--fg-subtle)]">
          {count.toLocaleString('th-TH')}
        </span>
      </div>
      {mix && total > 0 && (
        <div className="flex h-1 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
          {seg(mix.disabled, groupColor['ผู้พิการ'])}
          {seg(mix.chronic, groupColor['โรคเรื้อรัง'])}
          {seg(mix.elderly, groupColor['ผู้สูงอายุ'])}
          {seg(mix.children, groupColor['เด็กเล็ก'])}
        </div>
      )}
      {floodCount > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--risk-flood)]">
          <Droplets size={11} /> {floodCount} หลังในเขตน้ำท่วม
        </span>
      )}
    </button>
  )
}

// ── household worklist row ──
function HouseRow({ house: h, isCrisis, onClick }: { house: VulnerableHousehold; isCrisis: boolean; onClick: () => void }) {
  const groups = [...new Set(h.members.filter((m) => m.group !== 'ทั่วไป').map((m) => m.group))]
  const risk = h.floodRisk ?? 'safe'
  const showRisk = isCrisis && (risk === 'flood' || risk === 'near')

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--bg-sunken)]"
      >
        {/* leading: risk dot (crisis) / home tile (normal) */}
        {isCrisis ? (
          <span className="flex w-[18px] shrink-0 justify-center" title={RISK_META[risk].label}>
            <span className="size-2.5 rounded-full" style={{ background: RISK_META[risk].tone }} />
          </span>
        ) : (
          <span
            className="gx-icon-tile size-9 shrink-0"
            style={{ ['--tile' as string]: 'var(--cat-folder)' }}
          >
            <Home size={16} strokeWidth={1.75} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-[var(--fg)]">บ้านเลขที่ {h.hno}</span>
            <span className="truncate text-xs text-[var(--fg-muted)]">· {h.villno ? `ม.${h.villno} ` : ''}{h.village}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {showRisk && (
              <span
                className="rounded px-1.5 py-px text-[10.5px] font-semibold"
                style={{ color: RISK_META[risk].tone, background: `color-mix(in oklch, ${RISK_META[risk].tone} 14%, transparent)` }}
              >
                {RISK_META[risk].label}
              </span>
            )}
            {h.evacuated && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10.5px] font-medium" style={{ color: EVAC, background: `color-mix(in oklch, ${EVAC} 14%, transparent)` }}>
                <Tent size={10} /> อพยพแล้ว
              </span>
            )}
            {groups.map((g) => (
              <span key={g} className="rounded px-1.5 py-px text-[10.5px] font-medium" style={{ color: groupColor[g], background: groupBg[g] }}>
                {g}
              </span>
            ))}
          </div>
        </div>

        <span className="shrink-0 font-mono text-xs text-[var(--fg-subtle)]">{h.members.length} คน</span>
        <ChevronRight size={16} className="shrink-0 text-[var(--fg-subtle)]" />
      </button>
    </li>
  )
}

// ── member card (composition only — name/age/sex/group; ความสัมพันธ์ซ่อนจนกว่ามี input จริง) ──
function MemberCard({ m }: { m: HouseholdMember }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5" style={{ background: groupBg[m.group] }}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] font-mono text-[11px] text-[var(--fg-muted)]">
        {m.sex === 'ชาย' ? '♂' : m.sex === 'หญิง' ? '♀' : '·'}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium leading-tight text-[var(--fg)]">{m.name}</span>
        <span className="ml-2 font-mono text-[11.5px] text-[var(--fg-subtle)]">{m.age} ปี</span>
      </div>
      {m.group !== 'ทั่วไป' && (
        <span className="shrink-0 rounded px-1.5 py-px text-[10.5px] font-medium" style={{ color: groupColor[m.group], background: 'transparent' }}>
          {m.group}
        </span>
      )}
    </div>
  )
}

// ── detail drawer ──
function HouseDrawer({ house, isCrisis, onClose }: { house: VulnerableHousehold; isCrisis: boolean; onClose: () => void }) {
  const vulnerable = house.members.filter((m) => m.group !== 'ทั่วไป')
  const general = house.members.filter((m) => m.group === 'ทั่วไป')
  const risk = house.floodRisk ?? 'safe'
  const hasGeo = house.lat != null && house.lng != null

  return (
    <div className="fixed inset-0 z-50 flex">
      <button aria-label="ปิด" className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4" style={{ ['--tile' as string]: 'var(--cat-folder)' }}>
          <span className="gx-icon-tile size-10"><Home size={18} strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-[var(--fg)]">บ้านเลขที่ {house.hno}</p>
            <p className="truncate text-xs text-[var(--fg-muted)]">{house.villno ? `ม.${house.villno} ` : ''}{house.village}{house.tambon ? ` · ${house.tambon}` : ''}</p>
          </div>
          <button aria-label="ปิด" onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* crisis status strip */}
        {isCrisis && (risk === 'flood' || risk === 'near' || house.evacuated) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-2.5 text-sm">
            {(risk === 'flood' || risk === 'near') && (
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: RISK_META[risk].tone }}>
                <Droplets size={15} /> {RISK_META[risk].label}
              </span>
            )}
            {house.evacuated && (
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: EVAC }}>
                <Tent size={15} /> อพยพแล้ว{house.shelterName ? ` · ${house.shelterName}` : ''}
              </span>
            )}
          </div>
        )}

        {/* members count ribbon */}
        <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)] bg-[var(--bg-sunken)]">
          {[
            { label: 'สมาชิก', value: house.members.length, tone: 'var(--fg)' },
            { label: 'กลุ่มเปราะบาง', value: house.vulnerableCount, tone: 'var(--risk-flood)' },
            { label: 'สูงอายุ', value: house.members.filter((m) => m.group === 'ผู้สูงอายุ').length, tone: 'var(--risk-near)' },
          ].map((s) => (
            <div key={s.label} className="py-3 text-center">
              <p className="font-mono text-[22px] font-semibold leading-tight" style={{ color: s.tone }}>{s.value}</p>
              <p className="text-[10.5px] uppercase tracking-wide text-[var(--fg-subtle)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* members */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {vulnerable.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">กลุ่มเปราะบาง ({vulnerable.length})</p>
              <div className="space-y-2">{vulnerable.map((m) => <MemberCard key={m.pid} m={m} />)}</div>
            </section>
          )}
          {general.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">สมาชิกอื่นในบ้าน ({general.length})</p>
              <div className="space-y-2">{general.map((m) => <MemberCard key={m.pid} m={m} />)}</div>
            </section>
          )}
        </div>

        {/* actions */}
        {hasGeo && (
          <div className="border-t border-[var(--border)] p-4">
            <a
              href={`https://www.google.com/maps?q=${house.lat},${house.lng}`}
              target="_blank"
              rel="noreferrer"
              className="gx-btn gx-btn-ghost gx-btn-sm w-full justify-center"
            >
              <MapPin size={15} /> ดูตำแหน่งบนแผนที่
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
