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
  Sparkles,
  AlertCircle
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OverviewData, QueueHousehold } from '@/lib/overview'

const LS_LABEL: Record<string, string> = {
  oxygen: 'พึ่งออกซิเจน',
  ventilator: 'เครื่องช่วยหายใจ',
  dialysis_capd: 'ฟอกไต (CAPD)',
  dialysis_hd: 'ฟอกไตเลือด (HD)',
  anti_seizure: 'ยากันชัก',
  feeding_tube: 'สายให้อาหาร',
}

const PRIORITY: Record<string, { label: string; tone: string; soft: number; badgeColor: string }> = {
  P1: { label: 'วิกฤต', tone: 'var(--risk-flood)', soft: 14, badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50' },
  P2: { label: 'เร่งด่วน', tone: 'var(--risk-near)', soft: 14, badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50' },
  P3: { label: 'เฝ้าระวัง', tone: 'var(--risk-near)', soft: 9, badgeColor: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/50' },
  unknown: { label: 'ข้อมูลไม่ครบ', tone: 'var(--fg-subtle)', soft: 10, badgeColor: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800' },
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
  parts.push(`${h.memberCount} คน`)
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
    <article className={`border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-all ${open ? 'bg-sky-50/20 dark:bg-sky-950/5' : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'}`}>
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
        className="grid w-full cursor-pointer grid-cols-[46px_1fr_auto] items-center gap-4 px-5 py-3 text-left"
      >
        {/* score circle */}
        <span
          className="flex size-[44px] items-center justify-center rounded-2xl border font-mono text-[14px] font-bold shadow-xs transition-transform duration-200 group-hover:scale-105"
          style={{
            color: p.tone,
            background: `color-mix(in oklch, ${p.tone} ${p.soft}%, var(--bg-elevated))`,
            borderColor: `color-mix(in oklch, ${p.tone} 28%, transparent)`,
          }}
        >
          {h.priority === 'unknown' ? '?' : h.priority}
        </span>

        {/* identity info */}
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${p.badgeColor}`}>
              <span className="size-1.5 rounded-full bg-current" />
              {p.label}
            </span>
            <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200">
              บ้าน{h.members[0]?.name ?? 'ไม่ระบุชื่อ'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-light truncate">{houseLine(h)}</span>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {h.lifeSupport.map((c) => (
              <Tag key={c} tone="var(--risk-flood)" strong icon={c.startsWith('dialysis') ? Droplets : c === 'anti_seizure' ? Pill : Wind}>
                {LS_LABEL[c] ?? c}
              </Tag>
            ))}
            {dl && <Tag tone="var(--accent)" icon={Droplets}>{dl}</Tag>}
            {!h.hasCaregiver && <Tag tone="var(--risk-near)" icon={UserX}>ไม่มีผู้ดูแล</Tag>}
            {h.hoursSinceContact !== null ? (
              <Tag tone="var(--fg-subtle)" icon={Clock}>ติดต่อ {h.hoursSinceContact} ชม.ก่อน</Tag>
            ) : (
              <Tag tone="var(--fg-subtle)" icon={Clock}>ยังไม่ติดต่อ</Tag>
            )}
          </span>
        </span>

        {/* right actions */}
        <span className="flex items-center gap-3 shrink-0">
          {h.suggestedTeam && !dispatched && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Navigation className="size-3 text-emerald-500 animate-pulse" strokeWidth={2} />
              <span>เสนอ {h.suggestedTeam.name}</span>
            </span>
          )}
          <span className="flex items-center gap-2">
            {dispatched ? (
              <span
                title="คำขออพยพถูกส่งเข้าคิว EOC แล้ว — มอบหมายทีมกู้ภัยได้ที่แท็บคำร้อง"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-3.5 py-2 text-[12px] font-bold text-emerald-600 shadow-xs"
              >
                <Check className="size-3.5" strokeWidth={3} />ส่งเข้าคิวแล้ว <ArrowRight className="size-3" />
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dispatch() }}
                disabled={dispatching}
                className="gx-btn gx-btn-primary rounded-xl px-3.5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Navigation className="size-3.5" strokeWidth={1.75} />
                {dispatching ? 'กำลังส่ง...' : 'ขออพยพด่วน'}
              </button>
            )}
            {h.contactPhone ? (
              <a
                href={`tel:${h.contactPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center size-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-colors shadow-xs"
                title="โทรหาติดต่อกลับ"
              >
                <Phone className="size-3.5" strokeWidth={2} />
              </a>
            ) : (
              <span
                title="ไม่มีเบอร์โทรในทะเบียน"
                className="inline-flex items-center justify-center size-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-300"
              >
                <Phone className="size-3.5" strokeWidth={2} />
              </span>
            )}
            <ChevronRight className={`size-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} strokeWidth={2} />
          </span>
        </span>
      </div>

      {open && (
        <div className="animate-expand-y grid grid-cols-1 gap-5 px-5 pb-5 pl-[64px] border-t border-dashed border-slate-100 dark:border-slate-800/80 pt-4 md:grid-cols-2">
          {/* Household details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-sky-500" /> สมาชิกในครัวเรือน (อพยพพร้อมกัน)
            </h4>
            <div className="space-y-2">
              {h.members.map((m, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-900 pb-2 last:border-b-0 last:pb-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500">
                    {m.name.replace(/^.+\s/, '').slice(0, 2) || '–'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{m.name}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {m.age !== null ? `${m.age} ปี` : 'ไม่ระบุอายุ'}
                      {m.lifeSupport.length > 0 && ` · ${m.lifeSupport.map((c) => LS_LABEL[c] ?? c).join(', ')}`}
                    </div>
                  </div>
                  {m.lifeSupport.length > 0 && (
                    <span className="ml-auto rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      {factorTag(m.lifeSupport)}
                    </span>
                  )}
                  {m.lifeSupport.length === 0 && m.isCaregiver && (
                    <span className="ml-auto rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">ผู้ดูแล</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Life support kit requirements */}
          <div className="space-y-3">
            {bringList(h.lifeSupport).length > 0 && (
              <>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-rose-500 animate-pulse" /> สิ่งสำคัญที่ต้องอพยพไปด้วย
                </h4>
                <div className="rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
                  {bringList(h.lifeSupport).map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <b.icon className="size-4 shrink-0 text-rose-500" strokeWidth={2} />
                      {b.label}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-50 dark:border-slate-900">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">ความเชื่อมั่นพิกัด:</span>
                <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden inline-block">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${h.confidence * 100}%` }} />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">{Math.round(h.confidence * 100)}%</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-light">
                คะแนนลำดับความสำคัญคิว: {h.score.toFixed(2)}
              </p>
            </div>
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
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px]"
      style={{
        color: tone,
        background: `color-mix(in oklch, ${tone} ${strong ? 12 : 8}%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tone} ${strong ? 24 : 16}%, transparent)`,
        fontWeight: strong ? 600 : 500,
      }}
    >
      {Icon && <Icon className="size-[13px]" strokeWidth={2} />}
      {children}
    </span>
  )
}

function HChip({ children, tone, icon: Icon }: { children: React.ReactNode; tone: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold leading-none"
      style={{
        color: tone,
        borderColor: `color-mix(in oklch, ${tone} 22%, transparent)`,
        background: `color-mix(in oklch, ${tone} 8%, transparent)`
      }}
    >
      <Icon className="size-3" strokeWidth={2} />
      {children}
    </span>
  )
}

export function CommandQueue({ data }: { data: OverviewData }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.72fr_1fr]">
      
      <style>{`
        @keyframes expand-y {
          from { height: 0; opacity: 0; transform: translateY(-4px); }
          to { height: auto; opacity: 1; transform: translateY(0); }
        }
        .animate-expand-y {
          animation: expand-y 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      {/* Left panel: case queue list */}
      <section className="gx-card overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div>
            <div className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">เคสร้อน · คิวสั่งการ</div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-light">
              เรียงลำดับความเสี่ยงต่อชีวิตเชิงคณิตศาสตร์ (อุปกรณ์ช่วยชีพ × พิกัดแนวเขตน้ำ × การติดต่อ)
            </div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
            <span className="size-1.5 rounded-full bg-emerald-500 pulse-live" /> live
          </span>
        </header>

        {data.queue.length > 0 ? (
          <div className="divide-y divide-slate-50 dark:divide-slate-900">
            {data.queue.map((h) => <QueueRow key={h.key} h={h} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-500">
              <Check className="size-6" strokeWidth={2.5} />
            </span>
            <p className="text-[15px] font-bold text-slate-800">ไม่มีเคสวิกฤตค้างในคิว</p>
            <p className="text-[12px] text-slate-400 font-light">กลุ่มเปราะบางในแนวเขตอุทกภัยได้รับการตอบรับดูแลครบถ้วนแล้ว</p>
          </div>
        )}
      </section>

      {/* Right panel: statistics and shelters */}
      <div className="flex flex-col gap-4">
        {/* Vulnerable stats bars */}
        <section className="gx-card overflow-hidden">
          <header className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
            <div className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">ทะเบียนกลุ่มเปราะบาง</div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-light">เปรียบเทียบสัดส่วนกลุ่มเปราะบางรวม และในแนวพื้นที่อุทกภัย</div>
          </header>
          <div className="flex flex-col gap-4 p-5">
            {data.groups.map((g) => {
              const maxTotal = Math.max(...data.groups.map((x) => x.total), 1)
              return (
                <div key={g.type} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Activity className="size-3.5 text-slate-400" strokeWidth={2} />
                      {g.label}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <span>ยอดสะสม <b className="font-mono font-bold text-slate-700 dark:text-slate-350">{g.total}</b> ราย</span>
                      {g.inFlood > 0 && (
                        <span className="rounded-full bg-rose-50 border border-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                          {g.inFlood} ในเขตน้ำท่วม
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="flex h-full rounded-full" style={{ width: `${(g.total / maxTotal) * 100}%`, background: 'color-mix(in oklch, var(--accent) 38%, var(--bg-sunken))' }}>
                      <div className="h-full rounded-full bg-[var(--risk-flood)]" style={{ width: g.total > 0 ? `${(g.inFlood / g.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {data.groups.length === 0 && <p className="text-[12px] text-slate-400 text-center py-4">ยังไม่มีข้อมูลในระบบ</p>}
          </div>
        </section>

        {/* Shelters capacity bar listing */}
        <section className="gx-card overflow-hidden">
          <header className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
            <div className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">ศูนย์พักพิงใกล้เต็ม</div>
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-light">ความจุศูนย์พักพิงชั่วคราวและการจัดสรรเตียงแพทย์</div>
          </header>
          <div className="px-5 pb-5 pt-1.5">
            {data.sheltersNearFull.length > 0 ? data.sheltersNearFull.map((s) => (
              <div key={s.id} className="border-b border-slate-100 dark:border-slate-800 py-4 last:border-b-0 last:py-0 last:pt-4">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{s.name}</span>
                  <span className="ml-auto font-mono text-[13px] font-bold text-slate-700 dark:text-slate-350">
                    {s.occupancy}/{s.capacity ?? '–'}
                    <span className={`ml-1.5 text-[10px] font-bold rounded-md px-1 py-0.5 ${s.pct >= 90 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-600'}`}>{s.pct}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(s.pct, 100)}%`, background: s.pct >= 90 ? 'var(--risk-flood)' : 'var(--risk-near)' }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <HChip tone={s.bedriddenUsed >= (s.bedriddenCapacity ?? 0) && s.bedriddenCapacity ? 'var(--risk-near)' : 'var(--risk-safe)'} icon={Bed}>เตียงอัมพาต {s.bedriddenUsed}/{s.bedriddenCapacity ?? '–'}</HChip>
                  {s.oxygenSupport ? <HChip tone="var(--risk-safe)" icon={Wind}>มีออกซิเจน</HChip> : <HChip tone="var(--risk-flood)" icon={UserX}>ไม่มีเครื่องเติม O2</HChip>}
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <Bed className="mx-auto text-slate-300 dark:text-slate-800 mb-2" size={28} />
                <p className="text-[12px] text-slate-400 dark:text-slate-500 font-light">ยังไม่มีศูนย์พักพิงที่ความหนาแน่นเกิน 80%</p>
              </div>
            )}
          </div>
        </section>
      </div>

    </div>
  )
}
