'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Navigation,
  Phone,
  ChevronRight,
  Wind,
  Droplets,
  Pill,
  Bed,
  Clock,
  UserX,
  Check,
  Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OverviewData, QueueHousehold } from '@/lib/overview'

// คิวสั่งการ (โหมดวิกฤต) — port จากหน้า Overview เดิม: hero คิว survivability + rail (กลุ่มเปราะบาง + ศูนย์ใกล้เต็ม)
// โดนัท "สถานะการอพยพ" ตัดออก เพราะ disposition funnel ที่ header แทนแล้ว

const LS_LABEL: Record<string, string> = {
  oxygen: 'พึ่งออกซิเจน',
  ventilator: 'เครื่องช่วยหายใจ',
  dialysis_capd: 'ฟอกไต (CAPD)',
  dialysis_hd: 'ฟอกไตเลือด (HD)',
  anti_seizure: 'ยากันชัก',
  feeding_tube: 'สายให้อาหาร',
}

const PRIORITY: Record<string, { label: string; tone: string; soft: number }> = {
  P1: { label: 'วิกฤต', tone: 'var(--risk-flood)', soft: 15 },
  P2: { label: 'เร่งด่วน', tone: 'var(--risk-near)', soft: 16 },
  P3: { label: 'เฝ้าระวัง', tone: 'var(--risk-near)', soft: 11 },
  unknown: { label: 'ข้อมูลไม่ครบ', tone: 'var(--fg-subtle)', soft: 12 },
}

function factorTag(ls: string[]): string {
  if (ls.includes('oxygen') || ls.includes('ventilator')) return 'O2'
  if (ls.some((c) => c.startsWith('dialysis'))) return 'ฟอกไต'
  if (ls.includes('anti_seizure')) return 'ยา'
  if (ls.includes('feeding_tube')) return 'สาย'
  return 'เฝ้า'
}

function bringList(ls: string[]): { icon: LucideIcon; label: string }[] {
  const out: { icon: LucideIcon; label: string }[] = []
  if (ls.includes('oxygen') || ls.includes('ventilator')) out.push({ icon: Wind, label: 'ถัง O2 สำรอง' })
  if (ls.some((c) => c.startsWith('dialysis'))) out.push({ icon: Droplets, label: 'น้ำยาฟอกไต' })
  if (ls.includes('anti_seizure')) out.push({ icon: Pill, label: 'ยากันชัก' })
  if (ls.includes('feeding_tube')) out.push({ icon: Activity, label: 'สายให้อาหาร' })
  return out
}

function houseLine(h: QueueHousehold): string {
  const parts: string[] = []
  if (h.hno) parts.push(`บ้านเลขที่ ${h.hno}`)
  if (h.villno) parts.push(`ม.${h.villno}`)
  if (h.tambon) parts.push(`ต.${h.tambon}`)
  parts.push(`${h.memberCount} คนในบ้าน`)
  return parts.join(' · ')
}

function distLabel(m: number | null): string | null {
  if (m === null) return null
  return m < 2000 ? `ห่างน้ำ ${m} ม.` : `ห่างน้ำ ~${(m / 1000).toFixed(1)} กม.`
}

function QueueRow({ h }: { h: QueueHousehold }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  // เริ่มจาก openRequest ของจริง — มีคำขออพยพค้างอยู่แล้วหรือยัง (คงสถานะหลัง reload)
  const [dispatched, setDispatched] = useState(h.openRequest)
  const p = PRIORITY[h.priority]
  const dl = distLabel(h.distanceM)

  async function dispatch() {
    if (dispatching || dispatched) return
    setDispatching(true)
    try {
      const res = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: h.headMemberId,
          requestType: 'evacuation',
          priority: 'critical',
          description: `ขออพยพด่วนจากคิวสั่งการ${h.suggestedTeam?.name ? ` · เสนอทีม ${h.suggestedTeam.name}` : ''}`,
        }),
      })
      if (res.ok) {
        setDispatched(true)
        router.refresh()
      }
    } finally {
      setDispatching(false)
    }
  }

  return (
    <article className={`border-b border-[var(--border)] last:border-b-0 transition-colors ${open ? 'bg-[color-mix(in_oklch,var(--accent)_6%,var(--bg-elevated))]' : 'hover:bg-[color-mix(in_oklch,var(--accent)_4%,var(--bg-elevated))]'}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        aria-expanded={open}
        className="grid w-full cursor-pointer grid-cols-[44px_1fr_auto] items-center gap-3.5 px-[18px] py-2.5 text-left"
      >
        {/* score */}
        <span
          className="flex size-[44px] items-center justify-center rounded-xl border"
          style={{
            color: p.tone,
            background: `color-mix(in oklch, ${p.tone} ${p.soft}%, var(--bg-elevated))`,
            borderColor: `color-mix(in oklch, ${p.tone} 35%, transparent)`,
          }}
        >
          <b className="font-mono text-[15px] font-bold leading-none">{h.priority === 'unknown' ? '?' : h.priority}</b>
        </span>
        {/* identity */}
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: p.tone }}>
              <span className="size-2 rounded-full" style={{ background: p.tone }} />
              {p.label}
            </span>
            <span className="text-[14.5px] font-semibold tracking-tight text-[var(--fg)]">
              บ้าน{h.members[0]?.name ?? 'ไม่ระบุชื่อ'}
            </span>
            <span className="text-xs text-[var(--fg-subtle)]">{houseLine(h)}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {h.lifeSupport.map((c) => (
              <Tag key={c} tone="var(--risk-flood)" strong icon={c.startsWith('dialysis') ? Droplets : c === 'anti_seizure' ? Pill : Wind}>
                {LS_LABEL[c] ?? c}
              </Tag>
            ))}
            {dl && <Tag tone="var(--fg-muted)" icon={Droplets}>{dl}</Tag>}
            {!h.hasCaregiver && <Tag tone="var(--risk-near)" icon={UserX}>ไม่มีผู้ดูแลในทะเบียน</Tag>}
            {h.hoursSinceContact !== null && (
              <Tag tone="var(--fg-subtle)" icon={Clock}>ติดต่อล่าสุด {h.hoursSinceContact} ชม.</Tag>
            )}
            {h.hoursSinceContact === null && <Tag tone="var(--fg-subtle)" icon={Clock}>ยังไม่บันทึกติดต่อ</Tag>}
          </span>
        </span>
        {/* right */}
        <span className="flex flex-col items-end gap-2">
          {h.suggestedTeam ? (
            <span className="inline-flex max-w-[210px] items-center gap-1 text-[11px] text-[var(--fg-subtle)]">
              <Navigation className="size-3 shrink-0 text-[var(--risk-safe)]" strokeWidth={1.75} />
              <span className="truncate">
                เสนอ <b className="font-medium text-[var(--fg-muted)]">{h.suggestedTeam.name}</b>
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-subtle)]">
              <Clock className="size-3 shrink-0" strokeWidth={1.75} />ยังไม่ส่งคำขอ
            </span>
          )}
          <span className="flex items-center gap-1.5">
            {dispatched ? (
              <span
                title="คำขออพยพถูกส่งเข้าคิว EOC แล้ว — ไปมอบหมายทีมที่แท็บคำร้อง"
                className="inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_oklch,var(--risk-safe)_15%,var(--bg-elevated))] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--risk-safe)] shadow-[var(--shadow-sm)]"
              >
                <Check className="size-3.5" strokeWidth={2} />ส่งเข้าคิว EOC แล้ว
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dispatch() }}
                disabled={dispatching}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--accent-fg)] shadow-[var(--shadow-sm)] transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-70"
              >
                <Navigation className="size-3.5" strokeWidth={1.75} />
                {dispatching ? 'กำลังส่ง…' : 'ขออพยพด่วน'}
              </button>
            )}
            {h.contactPhone ? (
              <a
                href={`tel:${h.contactPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
              >
                <Phone className="size-3.5" strokeWidth={1.75} />โทร
              </a>
            ) : (
              <span
                title="ไม่มีเบอร์ติดต่อในทะเบียน"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--fg-subtle)]"
              >
                <Phone className="size-3.5" strokeWidth={1.75} />โทร
              </span>
            )}
            <ChevronRight className={`size-4 text-[var(--fg-subtle)] transition-transform ${open ? 'rotate-90' : ''}`} strokeWidth={1.75} />
          </span>
        </span>
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-4 px-[18px] pb-5 pl-[58px] md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">สมาชิกในครัวเรือน (อพยพพร้อมกัน)</h4>
            {h.members.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 border-b border-dashed border-[var(--border)] py-2 last:border-b-0">
                <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-[var(--bg-sunken)] text-xs font-semibold text-[var(--fg-muted)]">
                  {m.name.replace(/^.+\s/, '').slice(0, 2) || '–'}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{m.name}</div>
                  <div className="text-[11.5px] text-[var(--fg-subtle)]">
                    {m.age !== null ? `${m.age} ปี` : 'ไม่ระบุอายุ'}
                    {m.lifeSupport.length > 0 && ` · ${m.lifeSupport.map((c) => LS_LABEL[c] ?? c).join(', ')}`}
                  </div>
                </div>
                {m.lifeSupport.length > 0 && (
                  <span className="ml-auto rounded-full bg-[color-mix(in_oklch,var(--risk-flood)_13%,transparent)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--risk-flood)]">
                    {factorTag(m.lifeSupport)}
                  </span>
                )}
                {m.lifeSupport.length === 0 && m.isCaregiver && (
                  <span className="ml-auto rounded-full bg-[color-mix(in_oklch,var(--risk-safe)_13%,transparent)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--risk-safe)]">ผู้ดูแล</span>
                )}
              </div>
            ))}
          </div>
          <div>
            {bringList(h.lifeSupport).length > 0 && (
              <>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">รายการต้องนำติดตัวเมื่ออพยพ</h4>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-3.5">
                  {bringList(h.lifeSupport).map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1 text-[12.5px] text-[var(--fg-muted)]">
                      <b.icon className="size-4 shrink-0 text-[var(--risk-flood)]" strokeWidth={1.75} />
                      {b.label}
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
              ความเชื่อมั่นข้อมูล {Math.round(h.confidence * 100)}% · คะแนน {h.score.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </article>
  )
}

function Tag({
  children,
  tone,
  strong,
  icon: Icon,
}: {
  children: React.ReactNode
  tone: string
  strong?: boolean
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] leading-none"
      style={{
        color: tone,
        background: `color-mix(in oklch, ${tone} ${strong ? 13 : 9}%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tone} ${strong ? 26 : 18}%, transparent)`,
        fontWeight: strong ? 600 : 500,
      }}
    >
      {Icon && <Icon className="size-[13px]" strokeWidth={1.75} />}
      {children}
    </span>
  )
}

function HChip({ children, tone, icon: Icon }: { children: React.ReactNode; tone: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10.5px] font-medium leading-none" style={{ color: tone, borderColor: `color-mix(in oklch, ${tone} 25%, transparent)`, background: `color-mix(in oklch, ${tone} 8%, transparent)` }}>
      <Icon className="size-3" strokeWidth={1.75} />
      {children}
    </span>
  )
}

export function CommandQueue({ data }: { data: OverviewData }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1.72fr_1fr]">
      {/* hero — คิวสั่งการ */}
      <section className="gx-card overflow-hidden">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-[18px] py-3.5">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">เคสร้อน · คิวสั่งการ</div>
            <div className="mt-px text-[11.5px] text-[var(--fg-subtle)]">
              เรียงตามความเสี่ยงถึงชีวิต (อุปกรณ์ × ระยะน้ำ × เวลาติดต่อ × ผู้ดูแล)
            </div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" />live
          </span>
        </header>

        {data.queue.length > 0 ? (
          <div>{data.queue.map((h) => <QueueRow key={h.key} h={h} />)}</div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-[color-mix(in_oklch,var(--risk-safe)_12%,transparent)] text-[var(--risk-safe)]">
              <Check className="size-6" strokeWidth={2} />
            </span>
            <p className="text-[15px] font-semibold">ไม่มีเคสวิกฤตในคิว</p>
            <p className="text-[13px] text-[var(--fg-muted)]">กลุ่มเปราะบางในเขตเสี่ยงได้รับการอพยพ/ดูแลแล้ว</p>
          </div>
        )}
      </section>

      {/* rail */}
      <div className="flex flex-col gap-3">
        {/* bars — กลุ่มเปราะบาง */}
        <section className="gx-card overflow-hidden">
          <header className="border-b border-[var(--border)] px-[18px] py-3.5">
            <div className="text-[15px] font-semibold tracking-tight">กลุ่มเปราะบาง</div>
            <div className="mt-px text-[11.5px] text-[var(--fg-subtle)]">แถบแดง = อยู่ในเขตน้ำท่วม</div>
          </header>
          <div className="flex flex-col gap-3 p-[18px]">
            {data.groups.map((g) => {
              const maxTotal = Math.max(...data.groups.map((x) => x.total), 1)
              return (
                <div key={g.type}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--fg-muted)]"><Activity className="size-3.5 text-[var(--fg-subtle)]" strokeWidth={1.75} />{g.label}</span>
                    <span className="text-[11.5px] text-[var(--fg-subtle)]"><b className="font-mono text-[var(--fg)]">{g.total}</b>{g.inFlood > 0 && <span className="ml-1.5 font-mono font-semibold text-[var(--risk-flood)]">{g.inFlood} ในเขตน้ำ</span>}</span>
                  </div>
                  <div className="h-[9px] overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                    <div className="flex h-full rounded-full" style={{ width: `${(g.total / maxTotal) * 100}%`, background: 'color-mix(in oklch, var(--accent) 38%, var(--bg-sunken))' }}>
                      <div className="h-full rounded-full bg-[var(--risk-flood)]" style={{ width: g.total > 0 ? `${(g.inFlood / g.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {data.groups.length === 0 && <p className="text-[13px] text-[var(--fg-subtle)]">ยังไม่มีข้อมูล</p>}
          </div>
        </section>

        {/* shelters — ศูนย์พักพิงใกล้เต็ม */}
        <section className="gx-card overflow-hidden">
          <header className="border-b border-[var(--border)] px-[18px] py-3.5">
            <div className="text-[15px] font-semibold tracking-tight">ศูนย์พักพิงใกล้เต็ม</div>
            <div className="mt-px text-[11.5px] text-[var(--fg-subtle)]">ความจุ + ความพร้อมด้านสุขภาพ</div>
          </header>
          <div className="px-[18px] pb-4 pt-1.5">
            {data.sheltersNearFull.length > 0 ? data.sheltersNearFull.map((s) => (
              <div key={s.id} className="border-b border-[var(--border)] py-3.5 last:border-b-0">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[13.5px] font-semibold tracking-tight">{s.name}</span>
                  <span className="ml-auto font-mono text-[13px] font-semibold">{s.occupancy}/{s.capacity ?? '–'}<span className="ml-1.5 text-[11px] text-[var(--fg-subtle)]">{s.pct}%</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(s.pct, 100)}%`, background: s.pct >= 90 ? 'var(--risk-flood)' : 'var(--risk-near)' }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <HChip tone={s.bedriddenUsed >= (s.bedriddenCapacity ?? 0) && s.bedriddenCapacity ? 'var(--risk-near)' : 'var(--risk-safe)'} icon={Bed}>เตียงพยาบาล {s.bedriddenUsed}/{s.bedriddenCapacity ?? '–'}</HChip>
                  {s.oxygenSupport ? <HChip tone="var(--risk-safe)" icon={Wind}>มีออกซิเจน</HChip> : <HChip tone="var(--risk-flood)" icon={UserX}>ไม่มีออกซิเจน</HChip>}
                </div>
              </div>
            )) : <p className="py-8 text-center text-[13px] text-[var(--fg-subtle)]">ไม่มีศูนย์ที่ใกล้เต็ม</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
