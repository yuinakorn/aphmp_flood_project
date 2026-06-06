'use client'

import { useState, useMemo } from 'react'
import { X, Home, Users, ChevronRight, Search } from 'lucide-react'
import type { VulnerableHousehold, HouseholdMember, VillageSummary } from '@/lib/family-folder'

const groupColor: Record<string, string> = {
  ผู้สูงอายุ: 'var(--risk-near)',
  เด็กเล็ก: 'oklch(0.72 0.14 350)',
  ผู้พิการ: 'oklch(0.62 0.18 305)',
  โรคเรื้อรัง: 'var(--risk-flood)',
  ทั่วไป: 'var(--fg-subtle)',
}

const groupBg: Record<string, string> = {
  ผู้สูงอายุ: 'oklch(0.96 0.04 80 / 0.15)',
  เด็กเล็ก: 'oklch(0.96 0.04 350 / 0.15)',
  ผู้พิการ: 'oklch(0.96 0.04 305 / 0.15)',
  โรคเรื้อรัง: 'oklch(0.96 0.04 25 / 0.15)',
  ทั่วไป: 'transparent',
}

interface Props {
  summary: VillageSummary[]
  initialHouseholds: VulnerableHousehold[]
  total: number
}

function MemberCard({ m }: { m: HouseholdMember }) {
  return (
    <div
      className="flex items-start gap-3 rounded-md border border-[var(--border)] px-3 py-2.5"
      style={{ background: groupBg[m.group] }}
    >
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)]">
        <span className="text-[10px] font-mono text-[var(--fg-muted)]">
          {m.sex === 'ชาย' ? '♂' : m.sex === 'หญิง' ? '♀' : '·'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium leading-tight">{m.name}</span>
          {m.isHead && (
            <span className="rounded bg-[var(--accent)] px-1.5 py-px text-[10px] font-medium text-[var(--accent-fg)]">
              หัวหน้า
            </span>
          )}
          <span
            className="rounded px-1.5 py-px text-[10px] font-medium"
            style={{ color: groupColor[m.group], background: groupBg[m.group] }}
          >
            {m.group}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-[var(--fg-muted)]">
          <span>{m.position}</span>
          <span className="font-mono">{m.age} ปี</span>
        </div>
        {(m.father || m.mother || m.mate) && (
          <div className="mt-1 flex flex-col gap-px text-[11px] text-[var(--fg-subtle)]">
            {m.father && <span>บิดา: {m.father}</span>}
            {m.mother && <span>มารดา: {m.mother}</span>}
            {m.mate && <span>คู่สมรส: {m.mate}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function HouseDrawer({
  house,
  onClose,
}: {
  house: VulnerableHousehold
  onClose: () => void
}) {
  const vulnerable = house.members.filter((m) => m.group !== 'ทั่วไป')
  const general = house.members.filter((m) => m.group === 'ทั่วไป')

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        aria-label="ปิด"
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4" style={{ ['--tile' as string]: 'var(--cat-folder)' }}>
          <span className="gx-icon-tile size-10"><Home size={18} strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-[var(--fg)]">บ้านเลขที่ {house.hno}</p>
            <p className="text-xs text-[var(--fg-muted)]">
              {house.villno ? `ม.${house.villno} ` : ''}{house.village}
              <span className="ml-2 font-mono text-[10.5px] text-[var(--fg-subtle)]">#{house.hcode}</span>
            </p>
          </div>
          <button
            aria-label="ปิด"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Stats ribbon */}
        <div className="grid grid-cols-4 divide-x divide-[var(--border)] border-b border-[var(--border)] bg-[var(--bg-sunken)]">
          {[
            { label: 'สมาชิก', value: house.members.length },
            { label: 'เปราะบาง', value: house.vulnerableCount, tone: 'var(--risk-flood)' },
            { label: 'สูงอายุ', value: house.members.filter((m) => m.group === 'ผู้สูงอายุ').length, tone: 'var(--risk-near)' },
            { label: 'เด็กเล็ก', value: house.members.filter((m) => m.group === 'เด็กเล็ก').length },
          ].map((s) => (
            <div key={s.label} className="py-3 text-center">
              <p className="font-mono text-[22px] font-semibold leading-tight" style={{ color: s.tone ?? 'var(--fg)' }}>{s.value}</p>
              <p className="text-[10.5px] uppercase tracking-wide text-[var(--fg-subtle)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Members */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {vulnerable.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                กลุ่มเปราะบาง
              </p>
              <div className="space-y-2">
                {vulnerable.map((m) => <MemberCard key={m.pid} m={m} />)}
              </div>
            </section>
          )}
          {general.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                สมาชิกทั่วไป
              </p>
              <div className="space-y-2">
                {general.map((m) => <MemberCard key={m.pid} m={m} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export function FamilyFolderClient({ summary, initialHouseholds, total }: Props) {
  const [households] = useState<VulnerableHousehold[]>(initialHouseholds)
  const [selectedVillcode, setSelectedVillcode] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedHouse, setSelectedHouse] = useState<VulnerableHousehold | null>(null)

  const filtered = useMemo(() => {
    let list = households
    if (selectedVillcode) {
      list = list.filter((h) => {
        const vname = summary.find((s) => s.vcode === selectedVillcode)?.vname
        return h.village === vname
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (h) =>
          h.hno.toLowerCase().includes(q) ||
          h.village.toLowerCase().includes(q) ||
          h.members.some((m) => m.name.toLowerCase().includes(q)),
      )
    }
    return list
  }, [households, selectedVillcode, search, summary])

  const totalVulnerable = summary.reduce((s, v) => s + v.elderly + v.children + v.disabled, 0)

  const ribbon = [
    { label: 'บ้านกลุ่มเปราะบาง', value: total, sub: 'หลัง', tone: 'var(--fg)' },
    { label: 'ผู้สูงอายุ', value: summary.reduce((s, v) => s + v.elderly, 0), sub: 'คน', tone: 'var(--risk-near)' },
    { label: 'เด็ก 0-5 ปี', value: summary.reduce((s, v) => s + v.children, 0), sub: 'คน', tone: 'oklch(0.65 0.14 350)' },
    { label: 'พิการ + เรื้อรัง', value: summary.reduce((s, v) => s + v.disabled + v.chronic, 0), sub: 'คน', tone: 'var(--risk-flood)' },
  ]

  return (
    <>
      {/* Status ribbon — numbers as typography */}
      <div className="flex flex-wrap items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {ribbon.map((s, i) => (
          <div key={s.label} className={`flex flex-col px-5 py-3 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">{s.label}</span>
            <span className="font-mono text-[26px] font-semibold leading-tight" style={{ color: s.tone }}>
              {s.value.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-[var(--fg-subtle)]">{s.sub}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Village filter + search */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <input
            type="search"
            placeholder="ค้นหาชื่อ, เลขที่บ้าน, หมู่บ้าน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedVillcode(null)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedVillcode === null
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            ทั้งหมด
          </button>
          {summary.map((v) => (
            <button
              key={v.vcode}
              onClick={() => setSelectedVillcode(v.vcode)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedVillcode === v.vcode
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              {v.villno ? `ม.${v.villno}` : v.vname ?? v.vcode}
            </button>
          ))}
        </div>
      </div>

      {/* Village summary table */}
      <div className="gx-card mt-4 overflow-hidden">
        <table className="gx-table">
          <thead>
            <tr>
              <th>หมู่บ้าน</th>
              <th className="font-mono !text-right">บ้านทั้งหมด</th>
              <th className="font-mono !text-right">บ้านเปราะบาง</th>
              <th className="font-mono !text-right">สูงอายุ</th>
              <th className="font-mono !text-right">เด็กเล็ก</th>
              <th className="font-mono !text-right">พิการ</th>
              <th className="font-mono !text-right">โรคเรื้อรัง</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((v) => (
              <tr
                key={v.vcode}
                onClick={() => setSelectedVillcode(selectedVillcode === v.vcode ? null : v.vcode)}
                className={`cursor-pointer ${selectedVillcode === v.vcode ? '[&>td]:!bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : ''}`}
              >
                <td className="gx-cell-strong">
                  <div className="flex items-center gap-2">
                    {selectedVillcode === v.vcode && <ChevronRight size={14} className="text-[var(--accent)]" />}
                    {v.villno ? `ม.${v.villno} ` : ''}{v.vname ?? '-'}
                  </div>
                </td>
                <td className="text-right font-mono">{v.totalHouses}</td>
                <td className="text-right font-mono font-semibold" style={{ color: 'var(--risk-flood)' }}>{v.vulnerableHouses}</td>
                <td className="text-right font-mono">{v.elderly}</td>
                <td className="text-right font-mono">{v.children}</td>
                <td className="text-right font-mono">{v.disabled}</td>
                <td className="text-right font-mono">{v.chronic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Household list */}
      <div className="mt-7">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--fg)]">รายการบ้าน <span className="ml-1.5 font-mono text-[var(--fg-subtle)]">{filtered.length}</span></h2>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((house) => {
            const vulGroups = [...new Set(house.members.filter((m) => m.group !== 'ทั่วไป').map((m) => m.group))]
            return (
              <button
                key={house.id}
                onClick={() => setSelectedHouse(house)}
                style={{ ['--tile' as string]: 'var(--cat-folder)' }}
                className="gx-card gx-card-interactive group flex items-start gap-3 p-3.5 text-left"
              >
                <span className="gx-icon-tile size-9"><Home size={16} strokeWidth={1.75} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--fg)]">บ้านเลขที่ {house.hno}</p>
                    <span className="shrink-0 font-mono text-xs text-[var(--fg-subtle)]">{house.members.length} คน</span>
                  </div>
                  <p className="truncate text-xs text-[var(--fg-muted)]">{house.villno ? `ม.${house.villno} ` : ''}{house.village}</p>
                  {vulGroups.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {vulGroups.map((g) => (
                        <span
                          key={g}
                          className="rounded px-1.5 py-px text-[10px] font-medium"
                          style={{ color: groupColor[g], background: groupBg[g] }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-center">
            <Users size={28} className="mx-auto mb-2 text-[var(--fg-subtle)]" />
            <p className="text-sm text-[var(--fg-muted)]">ไม่พบข้อมูล</p>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedHouse && (
        <HouseDrawer house={selectedHouse} onClose={() => setSelectedHouse(null)} />
      )}
    </>
  )
}
