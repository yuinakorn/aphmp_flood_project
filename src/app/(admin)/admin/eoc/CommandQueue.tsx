'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Navigation,
  Phone,
  Wind,
  Droplets,
  Pill,
  Bed,
  Clock,
  UserX,
  Check,
  Activity,
  AlertCircle,
  Compass,
  Users,
  AlertTriangle,
  ChevronDown,
  UserCheck,
  Anchor,
  Truck,
  HeartPulse,
  Brain,
  Utensils,
  ShieldAlert
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OverviewData, QueueHousehold } from '@/lib/overview'
import type { RescueTeam } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const LS_LABEL: Record<string, string> = {
  oxygen: 'พึ่งออกซิเจน',
  ventilator: 'เครื่องช่วยหายใจ',
  dialysis_capd: 'ฟอกไต (CAPD)',
  dialysis_hd: 'ฟอกไตเลือด (HD)',
  anti_seizure: 'ยากันชัก',
  feeding_tube: 'สายให้อาหาร',
}

const TEAM_TYPE_ICON: Record<string, LucideIcon> = {
  rescue_boat: Anchor,
  gmc_truck: Truck,
  ems_medical: HeartPulse,
  mcat_psych: Brain,
  volunteer_kitchen: Utensils,
  other: ShieldAlert,
}

const TEAM_TYPE_LABEL: Record<string, string> = {
  rescue_boat: 'เรือกู้ภัย',
  gmc_truck: 'รถบรรทุก GMC',
  ems_medical: 'หน่วยแพทย์สนาม',
  mcat_psych: 'หน่วยสุขภาพจิต',
  volunteer_kitchen: 'ครัวสนาม',
  other: 'ทั่วไป',
}

function bringList(ls: string[]): { icon: LucideIcon; label: string }[] {
  const out: { icon: LucideIcon; label: string }[] = []
  if (ls.includes('oxygen') || ls.includes('ventilator')) out.push({ icon: Wind, label: 'ถัง O2 สำรอง' })
  if (ls.some((c) => c.startsWith('dialysis'))) out.push({ icon: Droplets, label: 'น้ำยาฟอกไต' })
  if (ls.includes('anti_seizure')) out.push({ icon: Pill, label: 'ยากันชัก' })
  if (ls.includes('feeding_tube')) out.push({ icon: Activity, label: 'สายให้อาหาร' })
  return out
}

function distLabel(m: number | null): string | null {
  if (m === null) return null
  return m < 2000 ? `ห่างน้ำ ${m} ม.` : `ห่างน้ำ ~${(m / 1000).toFixed(1)} กม.`
}

function CircularProgress({ percentage, className }: { percentage: number; className?: string }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg className="size-14 transform -rotate-90">
        <circle
          className="text-slate-100 dark:text-slate-800"
          strokeWidth="3.5"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="28"
          cy="28"
        />
        <circle
          className={percentage >= 90 ? "text-rose-500" : percentage >= 80 ? "text-amber-500" : "text-emerald-500"}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="28"
          cy="28"
        />
      </svg>
      <span className="absolute text-[12px] font-mono font-bold">{percentage}%</span>
    </div>
  )
}

function getHouseholdName(h: QueueHousehold): string {
  const firstMember = h.members[0]
  if (!firstMember) return 'ไม่ระบุ'
  const nameParts = firstMember.name.trim().split(/\s+/)
  const prefixes = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'คุณ', 'นพ.', 'พญ.', 'ดร.']
  if (nameParts.length > 1 && prefixes.includes(nameParts[0])) {
    return nameParts[1]
  }
  return nameParts[0]
}

function TriageCard({
  h,
  rescueTeams,
  onAssignTeam,
  onEvacuate,
  dispatching,
  dispatched,
  bulkMode,
  isSelected,
  onToggleSelect,
}: {
  h: QueueHousehold
  rescueTeams: RescueTeam[]
  onAssignTeam: (h: QueueHousehold, teamName: string) => void
  onEvacuate: (h: QueueHousehold) => void
  dispatching: boolean
  dispatched: boolean
  bulkMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (key: string) => void
}) {
  const dl = distLabel(h.distanceM)
  const oxygenDependent = h.lifeSupport.includes('oxygen') || h.lifeSupport.includes('ventilator')
  const standbyTeams = rescueTeams.filter(t => t.status === 'standby')
  const activeTeams = rescueTeams.filter(t => t.status === 'active')

  // Colors & Styles based on Priority
  let borderColor = 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
  let headerBg = 'bg-slate-50/50 dark:bg-slate-900/30'
  let cardBg = 'bg-white dark:bg-slate-950'
  let pulseDotColor = ''

  if (h.priority === 'P1') {
    borderColor = 'border-rose-200/80 dark:border-rose-900/50 hover:border-rose-400 dark:hover:border-rose-800 shadow-[0_2px_8px_-2px_rgba(244,63,94,0.08)]'
    headerBg = 'bg-rose-50/40 dark:bg-rose-950/25'
    cardBg = 'bg-white dark:bg-slate-950'
    pulseDotColor = 'bg-rose-500'
  } else if (h.priority === 'P2') {
    borderColor = 'border-amber-200/85 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-800 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.08)]'
    headerBg = 'bg-amber-50/40 dark:bg-amber-950/25'
    cardBg = 'bg-white dark:bg-slate-950'
    pulseDotColor = 'bg-amber-500'
  } else if (h.priority === 'P3') {
    borderColor = 'border-emerald-250/80 dark:border-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-800 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.08)]'
    headerBg = 'bg-emerald-50/40 dark:bg-emerald-950/25'
    cardBg = 'bg-white dark:bg-slate-950'
    pulseDotColor = 'bg-emerald-500'
  }

  return (
    <article className={`flex flex-col rounded-xl border ${cardBg} shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${borderColor}`}>
      {/* Header section of the card */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-900 rounded-t-xl ${headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          {bulkMode && !dispatched && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect?.(h.key)}
              disabled={dispatching}
              className="size-4 rounded border-slate-300 dark:border-slate-800 text-sky-655 focus:ring-sky-500 cursor-pointer mr-0.5"
            />
          )}
          {pulseDotColor && (
            <span className="relative flex size-2 shrink-0">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${pulseDotColor}`} />
              <span className={`relative inline-flex rounded-full size-2 ${pulseDotColor}`} />
            </span>
          )}
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
            บ้าน{getHouseholdName(h)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">
            Score {h.score.toFixed(2)}
          </span>
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">
            Conf {Math.round(h.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Details Area */}
      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Household size and addresses */}
          <div className="flex justify-between items-baseline text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
              <Users className="size-4" />
              <span>อพยพ {h.memberCount} คน</span>
            </span>
            <span className="truncate max-w-[150px] text-xs font-medium text-slate-500 dark:text-slate-400">
              {[h.hno, h.villno ? `ม.${h.villno}` : '', h.tambon].filter(Boolean).join(' · ')}
            </span>
          </div>

          {/* Members detail snippet */}
          <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-lg p-2.5 space-y-2 border border-slate-100/50 dark:border-slate-900/35">
            {h.members.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs leading-normal">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                  {idx + 1}. {m.name}
                </span>
                <span className="text-slate-550 dark:text-slate-405 shrink-0 text-[11px] font-mono font-medium">
                  {m.age !== null ? `${m.age} ปี` : 'ไม่ระบุอายุ'}
                  {m.isCaregiver && ' (ผู้ดูแล)'}
                </span>
              </div>
            ))}
          </div>

          {/* Clinical Alert Tags */}
          {h.lifeSupport.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {h.lifeSupport.map((c) => {
                const isO2 = c === 'oxygen' || c === 'ventilator'
                return (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-bold ${
                      isO2
                        ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50'
                        : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                    }`}
                  >
                    {isO2 ? <Wind className="size-2.5 animate-pulse" /> : <Droplets className="size-2.5" />}
                    {LS_LABEL[c] ?? c}
                  </span>
                )
              })}
            </div>
          )}

          {/* Bring List items */}
          {bringList(h.lifeSupport).length > 0 && (
            <div className="text-xs border-t border-slate-100 dark:border-slate-900 pt-2.5">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                อุปกรณ์ที่ต้องนำไปด้วย
              </span>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-slate-700 dark:text-slate-300">
                {bringList(h.lifeSupport).map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <b.icon className="size-3.5 text-rose-500" />
                    <span>{b.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom section: Water Meter & Actions */}
        <div className="space-y-3 pt-3.5 border-t border-slate-100 dark:border-slate-900 mt-auto">
          {/* Water proximity progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11.5px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-semibold">
                <Compass className="size-3.5 text-sky-500" />
                {dl ? dl : 'ไม่ระบุระยะห่าง'}
              </span>
              {!h.hasCaregiver && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-bold">
                  <UserX className="size-3.5" />
                  ไม่มีผู้ดูแล
                </span>
              )}
            </div>
            {h.distanceM !== null && (
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    h.distanceM < 500
                      ? 'bg-rose-500'
                      : h.distanceM < 2000
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(10, (3000 - h.distanceM) / 30))}%` }}
                />
              </div>
            )}
          </div>

          {/* Contact timing metadata */}
          <div className="flex items-center justify-between text-xs text-slate-450 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {h.hoursSinceContact !== null ? `ติดต่อ ${h.hoursSinceContact} ชม.ก่อน` : 'ยังไม่ติดต่อ'}
            </span>
            {h.suggestedTeam && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Navigation className="size-3 shrink-0" />
                แนะนำ: {h.suggestedTeam.name}
              </span>
            )}
          </div>

          {/* Quick Action Row */}
          <div className="flex items-center gap-2 pt-1">
            {dispatched ? (
              <div className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 py-2 text-sm font-bold text-emerald-600 shadow-sm">
                <Check className="size-4" strokeWidth={2.5} />
                <span>ส่งคิวสั่งการแล้ว</span>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-lg py-2 h-auto cursor-pointer shadow-sm transition-colors"
                      disabled={dispatching}
                    >
                      <Navigation className="size-3.5 mr-1" />
                      {dispatching ? 'กำลังบันทึก...' : 'มอบหมายกู้ภัย'}
                      <ChevronDown className="size-3.5 ml-1 opacity-70" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-450">
                      เลือกทีมปฏิบัติการในพื้นที่
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {activeTeams.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide bg-emerald-50/50 dark:bg-emerald-950/20">
                          ทีมพร้อมปฏิบัติการ (Active)
                        </div>
                        {activeTeams.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onClick={() => onAssignTeam(h, t.name)}
                            className="text-sm py-2 cursor-pointer flex items-center justify-between"
                          >
                            <span className="font-bold text-slate-850 dark:text-slate-200">{t.name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">({TEAM_TYPE_LABEL[t.teamType]})</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    {standbyTeams.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide bg-amber-50/50 dark:bg-amber-950/20 mt-1">
                          ทีมพร้อมสั่งการ (Standby)
                        </div>
                        {standbyTeams.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onClick={() => onAssignTeam(h, t.name)}
                            className="text-sm py-2 cursor-pointer flex items-center justify-between"
                          >
                            <span className="font-bold text-slate-850 dark:text-slate-200">{t.name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">({TEAM_TYPE_LABEL[t.teamType]})</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    {activeTeams.length === 0 && standbyTeams.length === 0 && (
                      <div className="px-2 py-3 text-center text-sm text-slate-400">
                        ไม่พบทีมกู้ภัยออนแอร์ในระบบ
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onEvacuate(h)}
                      className="text-sm py-2 font-semibold text-sky-600 hover:text-sky-700 cursor-pointer focus:bg-sky-50 dark:focus:bg-sky-950/20"
                    >
                      ส่งเข้าคิวกลาง (ไม่ระบุทีม)
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {h.contactPhone ? (
              <a
                href={`tel:${h.contactPhone}`}
                className="inline-flex items-center justify-center size-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shadow-sm shrink-0"
                title="โทรหาติดต่อกลับ"
              >
                <Phone className="size-4" strokeWidth={2} />
              </a>
            ) : (
              <span
                className="inline-flex items-center justify-center size-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-700 shrink-0 cursor-not-allowed"
                title="ไม่มีเบอร์โทรในทะเบียน"
              >
                <Phone className="size-4" strokeWidth={2} />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function CommandQueue({ data, rescueTeams = [] }: { data: OverviewData; rescueTeams?: RescueTeam[] }) {
  const router = useRouter()
  const [dispatching, setDispatching] = useState<Record<string, boolean>>({})
  const [dispatchedState, setDispatchedState] = useState<Record<string, boolean>>({})
  const [mobileTab, setMobileTab] = useState<'P1' | 'P2' | 'P3'>('P1')
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [autoAllocating, setAutoAllocating] = useState(false)
  const [autoAllocModal, setAutoAllocModal] = useState(false)
  const [allocProgress, setAllocProgress] = useState<{ current: number; total: number } | null>(null)
  const [batchDispatching, setBatchDispatching] = useState(false)

  const allocatableCases = data.queue.filter(
    (h) => !h.openRequest && !dispatchedState[h.key] && h.suggestedTeam
  )

  async function runAutoAllocation() {
    setAutoAllocating(true)
    setAllocProgress({ current: 0, total: allocatableCases.length })
    
    const promises = allocatableCases.map(async (h) => {
      try {
        const res = await fetch('/api/help-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: h.headMemberId,
            requestType: 'evacuation',
            priority: h.priority === 'P1' ? 'critical' : h.priority === 'P2' ? 'high' : 'normal',
            description: `มอบหมายด่วน (ระบบอัตโนมัติ) · ทีมกู้ภัย: ${h.suggestedTeam!.name}`,
            incidentId: data.incident?.id,
          }),
        })
        if (res.ok) {
          setDispatchedState((prev) => ({ ...prev, [h.key]: true }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setAllocProgress((prev) => prev ? { ...prev, current: prev.current + 1 } : null)
      }
    })

    await Promise.all(promises)
    setAutoAllocating(false)
    setAutoAllocModal(false)
    setAllocProgress(null)
    router.refresh()
  }

  async function handleBatchAssign(teamName: string) {
    if (selectedKeys.size === 0 || batchDispatching) return
    setBatchDispatching(true)
    
    const selectedCases = data.queue.filter(h => selectedKeys.has(h.key) && !h.openRequest && !dispatchedState[h.key])
    
    const promises = selectedCases.map(async (h) => {
      try {
        const res = await fetch('/api/help-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: h.headMemberId,
            requestType: 'evacuation',
            priority: h.priority === 'P1' ? 'critical' : h.priority === 'P2' ? 'high' : 'normal',
            description: `มอบหมายกลุ่ม · ทีมกู้ภัย: ${teamName}`,
            incidentId: data.incident?.id,
          }),
        })
        if (res.ok) {
          setDispatchedState((prev) => ({ ...prev, [h.key]: true }))
        }
      } catch (err) {
        console.error(err)
      }
    })

    await Promise.all(promises)
    setBatchDispatching(false)
    setSelectedKeys(new Set())
    router.refresh()
  }

  async function handleBatchEvacuate() {
    if (selectedKeys.size === 0 || batchDispatching) return
    setBatchDispatching(true)
    
    const selectedCases = data.queue.filter(h => selectedKeys.has(h.key) && !h.openRequest && !dispatchedState[h.key])
    
    const promises = selectedCases.map(async (h) => {
      try {
        const res = await fetch('/api/help-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: h.headMemberId,
            requestType: 'evacuation',
            priority: h.priority === 'P1' ? 'critical' : h.priority === 'P2' ? 'high' : 'normal',
            description: `ขออพยพด่วนกลุ่ม (ไม่ระบุทีม)`,
            incidentId: data.incident?.id,
          }),
        })
        if (res.ok) {
          setDispatchedState((prev) => ({ ...prev, [h.key]: true }))
        }
      } catch (err) {
        console.error(err)
      }
    })

    await Promise.all(promises)
    setBatchDispatching(false)
    setSelectedKeys(new Set())
    router.refresh()
  }

  async function handleAssignTeam(h: QueueHousehold, teamName: string) {
    if (dispatching[h.key] || dispatchedState[h.key] || h.openRequest) return
    setDispatching((prev) => ({ ...prev, [h.key]: true }))
    try {
      const res = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: h.headMemberId,
          requestType: 'evacuation',
          priority: 'critical',
          description: `ขออพยพด่วนจากคิวสั่งการ · มอบหมายทีม ${teamName}`,
          incidentId: data.incident?.id,
        }),
      })
      if (res.ok) {
        setDispatchedState((prev) => ({ ...prev, [h.key]: true }))
        router.refresh()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDispatching((prev) => ({ ...prev, [h.key]: false }))
    }
  }

  async function handleRequestEvac(h: QueueHousehold) {
    if (dispatching[h.key] || dispatchedState[h.key] || h.openRequest) return
    setDispatching((prev) => ({ ...prev, [h.key]: true }))
    try {
      const res = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: h.headMemberId,
          requestType: 'evacuation',
          priority: 'critical',
          description: `ขออพยพด่วนจากคิวสั่งการ${h.suggestedTeam?.name ? ` · เสนอทีม ${h.suggestedTeam.name}` : ''}`,
          incidentId: data.incident?.id,
        }),
      })
      if (res.ok) {
        setDispatchedState((prev) => ({ ...prev, [h.key]: true }))
        router.refresh()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDispatching((prev) => ({ ...prev, [h.key]: false }))
    }
  }

  // Grouping households into columns
  const p1Cases = data.queue.filter((h) => h.priority === 'P1')
  const p2Cases = data.queue.filter((h) => h.priority === 'P2')
  const p3Cases = data.queue.filter((h) => h.priority === 'P3' || h.priority === 'unknown')

  const activeOrStandbyTeams = rescueTeams.filter((t) => t.status !== 'offline')

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
      
      {/* 3-Column Triage Grid (Desktop: Left 75% width) */}
      <section className="lg:col-span-9 space-y-4">
        {/* Board Header Status Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 shadow-xs">
          <div>
            <div className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-200">
              บอร์ดบัญชาการ Triage ร่วมศูนย์ EOC
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              จัดลำดับตามความเร่งด่วนทางสุขภาพ ระยะแนวระบายน้ำ และการติดตามสถานะ
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto Allocate Button */}
            {allocatableCases.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setAutoAllocModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg py-2 px-3 h-auto cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Activity className="size-3.5 animate-pulse" />
                จัดสรรกู้ภัยอัตโนมัติ ({allocatableCases.length})
              </Button>
            )}

            {/* Bulk Mode Toggle */}
            <Button
              variant={bulkMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setBulkMode(!bulkMode)
                setSelectedKeys(new Set())
              }}
              className={`font-bold text-xs rounded-lg py-2 px-3 h-auto cursor-pointer shadow-sm transition-colors flex items-center gap-1.5 ${
                bulkMode
                  ? "bg-sky-600 hover:bg-sky-700 text-white border-sky-600"
                  : "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              <Users className="size-3.5" />
              {bulkMode ? 'ยกเลิกจัดสรรกลุ่ม' : 'จัดสรรกลุ่ม (Bulk Dispatch)'}
            </Button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 uppercase tracking-wide">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-live" /> live console
            </span>
          </div>
        </div>

        {/* Mobile View selector controls */}
        <div className="flex lg:hidden bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1">
          <button
            onClick={() => setMobileTab('P1')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === 'P1'
                ? 'bg-white dark:bg-slate-950 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="size-1.5 rounded-full bg-rose-500" />
            วิกฤต P1 ({p1Cases.length})
          </button>
          <button
            onClick={() => setMobileTab('P2')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === 'P2'
                ? 'bg-white dark:bg-slate-950 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="size-1.5 rounded-full bg-amber-500" />
            เร่งด่วน P2 ({p2Cases.length})
          </button>
          <button
            onClick={() => setMobileTab('P3')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === 'P3'
                ? 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-350 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            เฝ้าระวัง P3 ({p3Cases.length})
          </button>
        </div>

        {/* The 3 Columns Grid for Desktop (shown selectively on mobile based on active tab) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* COLUMN 1: P1 Critical (Red) */}
          <div className={`flex flex-col gap-3.5 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-3.5 ${
            mobileTab === 'P1' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2 mb-1">
              <div className="flex items-center gap-1.5">
                {bulkMode && p1Cases.length > 0 && (
                  <input
                    type="checkbox"
                    checked={p1Cases.every(c => c.openRequest || dispatchedState[c.key] || selectedKeys.has(c.key))}
                    onChange={(e) => {
                      const next = new Set(selectedKeys)
                      p1Cases.forEach(c => {
                        if (c.openRequest || dispatchedState[c.key]) return
                        if (e.target.checked) next.add(c.key)
                        else next.delete(c.key)
                      })
                      setSelectedKeys(next)
                    }}
                    className="size-4 rounded border-slate-300 dark:border-slate-800 text-sky-600 focus:ring-sky-500 cursor-pointer mr-1"
                  />
                )}
                <span className="size-2.5 rounded-full bg-rose-500" />
                <span className="text-sm font-bold text-slate-805 dark:text-slate-200">
                  คิวสีแดง (Critical P1)
                </span>
              </div>
              <Badge variant="destructive" className="bg-rose-500 text-white font-semibold">
                {p1Cases.length} รายการ
              </Badge>
            </div>
            
            <div className="flex flex-col gap-3 max-h-[640px] overflow-y-auto pr-1">
              {p1Cases.length > 0 ? (
                p1Cases.map((h) => (
                  <TriageCard
                    key={h.key}
                    h={h}
                    rescueTeams={rescueTeams}
                    onAssignTeam={handleAssignTeam}
                    onEvacuate={handleRequestEvac}
                    dispatching={!!dispatching[h.key]}
                    dispatched={h.openRequest || !!dispatchedState[h.key]}
                    bulkMode={bulkMode}
                    isSelected={selectedKeys.has(h.key)}
                    onToggleSelect={(key) => {
                      const next = new Set(selectedKeys)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      setSelectedKeys(next)
                    }}
                  />
                ))
              ) : (
                <div className="text-center py-12 px-4 border border-dashed border-emerald-200/60 dark:border-emerald-900/30 rounded-xl bg-emerald-50/5 dark:bg-emerald-950/2 shadow-xs">
                  <div className="grid place-items-center size-9 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 mx-auto mb-2">
                    <Check className="size-5" strokeWidth={3} />
                  </div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">ไม่มีเคสวิกฤต P1 คงค้าง</p>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: P2 Urgent (Orange) */}
          <div className={`flex flex-col gap-3.5 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-3.5 ${
            mobileTab === 'P2' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2 mb-1">
              <div className="flex items-center gap-1.5">
                {bulkMode && p2Cases.length > 0 && (
                  <input
                    type="checkbox"
                    checked={p2Cases.every(c => c.openRequest || dispatchedState[c.key] || selectedKeys.has(c.key))}
                    onChange={(e) => {
                      const next = new Set(selectedKeys)
                      p2Cases.forEach(c => {
                        if (c.openRequest || dispatchedState[c.key]) return
                        if (e.target.checked) next.add(c.key)
                        else next.delete(c.key)
                      })
                      setSelectedKeys(next)
                    }}
                    className="size-4 rounded border-slate-300 dark:border-slate-800 text-sky-600 focus:ring-sky-500 cursor-pointer mr-1"
                  />
                )}
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="text-sm font-bold text-slate-805 dark:text-slate-200">
                  คิวสีส้ม (Urgent P2)
                </span>
              </div>
              <Badge className="bg-amber-500 text-white font-semibold">
                {p2Cases.length} รายการ
              </Badge>
            </div>

            <div className="flex flex-col gap-3 max-h-[640px] overflow-y-auto pr-1">
              {p2Cases.length > 0 ? (
                p2Cases.map((h) => (
                  <TriageCard
                    key={h.key}
                    h={h}
                    rescueTeams={rescueTeams}
                    onAssignTeam={handleAssignTeam}
                    onEvacuate={handleRequestEvac}
                    dispatching={!!dispatching[h.key]}
                    dispatched={h.openRequest || !!dispatchedState[h.key]}
                    bulkMode={bulkMode}
                    isSelected={selectedKeys.has(h.key)}
                    onToggleSelect={(key) => {
                      const next = new Set(selectedKeys)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      setSelectedKeys(next)
                    }}
                  />
                ))
              ) : (
                <div className="text-center py-12 px-4 border border-dashed border-slate-250 dark:border-slate-800/40 rounded-xl bg-slate-50/5 dark:bg-slate-900/2 shadow-xs">
                  <div className="grid place-items-center size-9 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-850/30 mx-auto mb-2">
                    <Check className="size-5" strokeWidth={2.5} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-350">ไม่มีเคสเร่งด่วน P2 คงค้าง</p>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: P3 & Unknown Watch (Slate/Green) */}
          <div className={`flex flex-col gap-3.5 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-3.5 ${
            mobileTab === 'P3' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-2 mb-1">
              <div className="flex items-center gap-1.5">
                {bulkMode && p3Cases.length > 0 && (
                  <input
                    type="checkbox"
                    checked={p3Cases.every(c => c.openRequest || dispatchedState[c.key] || selectedKeys.has(c.key))}
                    onChange={(e) => {
                      const next = new Set(selectedKeys)
                      p3Cases.forEach(c => {
                        if (c.openRequest || dispatchedState[c.key]) return
                        if (e.target.checked) next.add(c.key)
                        else next.delete(c.key)
                      })
                      setSelectedKeys(next)
                    }}
                    className="size-4 rounded border-slate-300 dark:border-slate-800 text-sky-600 focus:ring-sky-500 cursor-pointer mr-1"
                  />
                )}
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-slate-850 dark:text-slate-200">
                  คิวสีเขียว (Watch P3)
                </span>
              </div>
              <Badge className="bg-emerald-500 text-white font-semibold">
                {p3Cases.length} รายการ
              </Badge>
            </div>

            <div className="flex flex-col gap-3 max-h-[640px] overflow-y-auto pr-1">
              {p3Cases.length > 0 ? (
                p3Cases.map((h) => (
                  <TriageCard
                    key={h.key}
                    h={h}
                    rescueTeams={rescueTeams}
                    onAssignTeam={handleAssignTeam}
                    onEvacuate={handleRequestEvac}
                    dispatching={!!dispatching[h.key]}
                    dispatched={h.openRequest || !!dispatchedState[h.key]}
                    bulkMode={bulkMode}
                    isSelected={selectedKeys.has(h.key)}
                    onToggleSelect={(key) => {
                      const next = new Set(selectedKeys)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      setSelectedKeys(next)
                    }}
                  />
                ))
              ) : (
                <div className="text-center py-12 px-4 border border-dashed border-slate-250 dark:border-slate-800/40 rounded-xl bg-slate-50/5 dark:bg-slate-900/2 shadow-xs">
                  <div className="grid place-items-center size-9 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-850/30 mx-auto mb-2">
                    <Check className="size-5" strokeWidth={2.5} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-350">ไม่มีเคสเฝ้าระวัง P3 คงค้าง</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Live Resource Sidebar (Desktop: Right 25% width, Mobile: stacks under) */}
      <div className="lg:col-span-3 flex flex-col gap-5">
        
        {/* 1. Live Rescue Teams Standby Status */}
        <section className="gx-card overflow-hidden border border-slate-200 dark:border-slate-800">
          <header className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">กำลังพล & ยานพาหนะ EOC</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">รายชื่อทีมกู้ภัยออนแอร์เวลานี้</div>
            </div>
            <span className="text-xs bg-sky-50 dark:bg-sky-950/40 text-sky-600 px-2 py-0.5 rounded font-mono font-bold">
              {activeOrStandbyTeams.length} ทีม
            </span>
          </header>
          <div className="p-3.5 space-y-3">
            {activeOrStandbyTeams.length > 0 ? (
              activeOrStandbyTeams.map((t) => {
                const IconComponent = TEAM_TYPE_ICON[t.teamType] || Anchor
                const isActive = t.status === 'active'
                return (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-900 pb-3 last:border-b-0 last:pb-0"
                  >
                    <span className={`grid size-8 place-items-center rounded-lg ${
                      isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                    }`}>
                      <IconComponent className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-sm font-semibold text-slate-850 dark:text-slate-200 truncate">{t.name}</span>
                        <span className="relative flex size-1.5 shrink-0">
                          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                            isActive ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                          <span className={`relative inline-flex rounded-full size-1.5 ${
                            isActive ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 font-medium">
                        <span>{TEAM_TYPE_LABEL[t.teamType]}</span>
                        {t.zone && <span className="truncate">· {t.zone}</span>}
                      </div>
                      {t.contact && (
                        <a
                          href={`tel:${t.contact}`}
                          className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-mono mt-1 font-semibold"
                        >
                          <Phone className="size-2.5" />
                          {t.contact}
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200/80 dark:border-slate-800/40 rounded-xl bg-slate-50/30 dark:bg-slate-900/10">
                <ShieldAlert className="mx-auto text-slate-300 dark:text-slate-700 size-6 mb-2" />
                <p className="text-sm font-bold text-slate-705 dark:text-slate-300">สแตนด์บายเวชภัณฑ์ / เตรียมทีม</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-normal font-medium">
                  ไม่มีทีมกู้ภัยออนแอร์ในระบบเวลานี้ <br />
                  <a href="/admin/settings/rescue-teams" className="text-sky-600 hover:text-sky-700 underline font-medium mt-1 inline-block">ขึ้นทะเบียนทีมกู้ภัยเพิ่มเติม</a>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 2. Shelters Capacity Live radial/bar Gauges */}
        <section className="gx-card overflow-hidden border border-slate-200 dark:border-slate-800">
          <header className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">สถานะศูนย์พักพิง EOC</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">ความหนาแน่นรวมและทรัพยากรเตียงติดเตียงแพทย์</div>
          </header>
          <div className="p-3.5 space-y-4">
            {data.sheltersNearFull.length > 0 ? (
              data.sheltersNearFull.map((s) => (
                <div key={s.id} className="flex flex-col gap-2.5 border-b border-slate-100 dark:border-slate-900 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{s.name}</div>
                      <div className="text-xs text-slate-550 dark:text-slate-405 mt-0.5 font-mono font-medium">
                        {s.occupancy}/{s.capacity ?? 'ไม่จำกัด'} เตียง
                      </div>
                    </div>
                    <CircularProgress percentage={s.pct} className="shrink-0" />
                  </div>
                  
                  {/* Bedridden beds status details */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-slate-100/50 dark:border-slate-900/30 text-xs text-slate-650 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Bed className="size-3 text-slate-400" />
                      <span>เตียงติดเตียง:</span>
                    </span>
                    <span className="font-semibold font-mono">
                      {s.bedriddenUsed}/{s.bedriddenCapacity ?? '—'}
                    </span>
                  </div>
                  
                  {/* Health readiness badge indicator */}
                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    {s.oxygenSupport ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                        <Wind className="size-2.5" /> มีเครื่องผลิต O2
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="size-2.5" /> ไม่มีถัง O2 เสริม
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200/80 dark:border-slate-800/40 rounded-xl bg-slate-50/30 dark:bg-slate-900/10">
                <Bed className="mx-auto text-slate-300 dark:text-slate-700 size-6 mb-2" />
                <p className="text-sm font-bold text-slate-705 dark:text-slate-300">ศูนย์พักพิงพร้อมให้บริการ</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-normal font-medium">
                  ไม่มีศูนย์ใดที่มีความหนาแน่นเกิน 80% <br />
                  รองรับอัตราว่างเตียงติดเตียงและถังออกซิเจนเสรี
                </p>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* Bulk Mode Floating Bottom Control Bar */}
      {bulkMode && selectedKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4.5 shadow-xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="text-sm font-medium">
            เลือกแล้ว <span className="font-bold text-sky-600 dark:text-sky-400 text-base font-mono">{selectedKeys.size}</span> เคส
          </div>
          
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Action trigger dropdown or button group */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="default"
                  size="sm"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg py-2 px-3 h-auto cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                  disabled={batchDispatching}
                >
                  <Navigation className="size-3.5" />
                  {batchDispatching ? 'กำลังมอบหมาย...' : 'มอบหมายกู้ภัยกลุ่ม'}
                  <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  เลือกทีมเพื่อมอบหมายร่วมกัน
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeOrStandbyTeams.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => handleBatchAssign(t.name)}
                    className="text-xs py-2 cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-350">{t.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({TEAM_TYPE_LABEL[t.teamType]})</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchEvacuate}
            className="text-sky-600 dark:text-sky-400 border-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-xs font-bold rounded-lg py-2 px-3 h-auto cursor-pointer"
            disabled={batchDispatching}
          >
            ส่งเข้าคิวกลางกลุ่ม
          </Button>

          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer transition-colors"
          >
            ล้างการเลือก
          </button>
        </div>
      )}

      {/* Auto-Allocation Confirmation/Progress Dialog */}
      {autoAllocModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-900">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Activity className="size-4 text-emerald-600 animate-pulse" />
                จัดสรรคิวช่วยเหลืออัตโนมัติ (Auto-Allocation)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                ระบบสแกนหาผู้ประสบภัยที่มีทีมแนะนำเพื่อมอบหมายปฏิบัติการพร้อมกันทันที
              </p>
            </header>

            <div className="p-6 space-y-4">
              {allocProgress ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>กำลังส่งข้อมูลสั่งการเข้าระบบ...</span>
                    <span className="font-mono text-emerald-600 font-bold">
                      {allocProgress.current} / {allocProgress.total} เคส
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(allocProgress.current / allocProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-xl p-4 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                    ระบบวิเคราะห์และคัดกรองพบผู้ประสบภัยที่พร้อมจับคู่กับทีมกู้ภัยกู้ชีพในพื้นที่จำนวน <strong className="text-sm font-bold font-mono">{allocatableCases.length} รายการ</strong>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      สรุปสัดส่วนการจับคู่กู้ภัยกลุ่ม
                    </div>
                    {(() => {
                      const counts: Record<string, number> = {}
                      allocatableCases.forEach(c => {
                        if (c.suggestedTeam) {
                          counts[c.suggestedTeam.name] = (counts[c.suggestedTeam.name] || 0) + 1
                        }
                      })
                      return Object.entries(counts).map(([teamName, count]) => (
                        <div key={teamName} className="flex justify-between items-center text-xs py-2 border-b border-slate-100 dark:border-slate-900 last:border-0">
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{teamName}</span>
                          <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-bold">
                            {count} เคส
                          </span>
                        </div>
                      ))
                    })()}
                  </div>
                </>
              )}
            </div>

            <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-900 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setAutoAllocModal(false)}
                disabled={autoAllocating}
                className="text-xs font-bold"
              >
                ยกเลิก
              </Button>
              <Button
                variant="default"
                onClick={runAutoAllocation}
                disabled={autoAllocating || allocatableCases.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                {autoAllocating ? 'กำลังมอบหมายกู้ภัย...' : 'ยืนยันมอบหมายทั้งหมด'}
              </Button>
            </footer>
          </div>
        </div>
      )}
      
    </div>
  )
}
