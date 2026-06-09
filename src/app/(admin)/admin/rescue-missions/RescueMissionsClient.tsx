'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Anchor,
  Navigation,
  Check,
  CheckCircle2,
  AlertTriangle,
  Users,
  Tent,
  Hospital,
  Activity,
  Phone,
  MapPin,
  Clock,
  Plus,
  Search,
  X,
  Map,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { RescueTeam, Incident } from '@/types'

interface ClientRequest {
  id: string
  requestType: string
  priority: string
  status: string
  description: string
  observedAt: string
  memberId: string
  memberName: string
  memberPhone: string
  memberAge: number | null
  memberCond: string
  memberLifeSupport: string[]
  memberHno: string
  memberVillage: string
  memberVillno: string
  memberTambon: string
  memberAmphoe: string
  lat: number | null
  lng: number | null
  assignmentId: string | null
  rescueTeamId: string | null
  assignedTeam: string
  assignmentStatus: string
  notes: string
}

interface ClientVulnerable {
  id: string
  name: string
  phone: string
  age: number | null
  cond: string
  lifeSupport: string[]
  village: string
  tambon: string
  amphoe: string
  province: string
  type: string
  lat: number | null
  lng: number | null
}

interface Shelter {
  id: string
  name: string
  capacity: number | null
  occupancy: number
  province: string | null
}

const TYPE_LABELS: Record<string, string> = {
  medical: 'การแพทย์',
  evacuation: 'อพยพ',
  rescue: 'กู้ภัย',
  supplies: 'สิ่งของบรรเทาทุกข์',
  shelter: 'ที่พักพิง',
  other: 'อื่นๆ',
}

const LS_LABEL: Record<string, string> = {
  oxygen: 'ออกซิเจน',
  dialysis_capd: 'ฟอกไต (CAPD)',
  dialysis_hd: 'ฟอกไตเลือด (HD)',
  ventilator: 'ช่วยหายใจ',
  anti_seizure: 'ยากันชัก',
  feeding_tube: 'สายอาหาร',
}

export function RescueMissionsClient({
  teams,
  shelters,
  requests,
  vulnerablePersons,
  activeIncidents,
  incidentId,
  role,
}: {
  teams: RescueTeam[]
  shelters: Shelter[]
  requests: ClientRequest[]
  vulnerablePersons: ClientVulnerable[]
  activeIncidents: Incident[]
  incidentId: string | null
  role: string
}) {
  const router = useRouter()
  const [activeTeamId, setActiveTeamId] = useState<string>('')
  const [tab, setTab] = useState<'assigned' | 'active' | 'completed' | 'unassigned'>('assigned')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  // Delivery Sheet states
  const [deliveryRequest, setDeliveryRequest] = useState<ClientRequest | null>(null)
  const [destType, setDestType] = useState<'shelter' | 'hospital' | 'other'>('shelter')
  const [selectedShelterId, setSelectedShelterId] = useState<string>('')
  const [customDestText, setCustomDestText] = useState<string>('')
  const [deliveryNotes, setDeliveryNotes] = useState<string>('')

  // On-Site Rescue Sheet states
  const [onSiteModal, setOnSiteModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVulnerable, setSelectedVulnerable] = useState<ClientVulnerable | null>(null)
  const [onSiteDestType, setOnSiteDestType] = useState<'shelter' | 'hospital' | 'other'>('shelter')
  const [onSiteShelterId, setOnSiteShelterId] = useState<string>('')
  const [onSiteCustomDest, setOnSiteCustomDest] = useState<string>('')
  const [onSiteNotes, setOnSiteNotes] = useState<string>('')

  // Persistence of selected team in Local Storage
  useEffect(() => {
    const saved = localStorage.getItem('rescue_active_team_id')
    if (saved && teams.some(t => t.id === saved)) {
      setActiveTeamId(saved)
    } else if (teams.length > 0) {
      setActiveTeamId(teams[0].id)
      localStorage.setItem('rescue_active_team_id', teams[0].id)
    }
  }, [teams])

  const activeTeam = useMemo(() => teams.find(t => t.id === activeTeamId), [teams, activeTeamId])

  const selectTeam = (id: string) => {
    setActiveTeamId(id)
    localStorage.setItem('rescue_active_team_id', id)
  }

  // Filter requests based on tab and active team
  const filteredRequests = useMemo(() => {
    if (!activeTeamId) return []
    return requests.filter(r => {
      if (tab === 'unassigned') {
        return r.rescueTeamId === null && r.status !== 'resolved' && r.status !== 'cancelled'
      }
      
      const isMyTeam = r.rescueTeamId === activeTeamId
      if (!isMyTeam) return false

      if (tab === 'assigned') return r.status === 'assigned' || r.status === 'new'
      if (tab === 'active') return r.status === 'en_route' || r.status === 'arrived'
      if (tab === 'completed') return r.status === 'resolved'
      return false
    })
  }, [requests, tab, activeTeamId])

  // Filter vulnerable people list for search
  const filteredVulnerables = useMemo(() => {
    if (searchQuery.trim().length === 0) return []
    const q = searchQuery.toLowerCase()
    return vulnerablePersons.filter(
      p => p.name.toLowerCase().includes(q) || p.village.toLowerCase().includes(q)
    )
  }, [vulnerablePersons, searchQuery])

  // Call status update API
  const handleUpdateStatus = async (requestId: string, status: string) => {
    if (loadingId) return
    setLoadingId(requestId)
    try {
      const res = await fetch(`/api/help-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rescueTeamId: activeTeamId, incidentId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'บันทึกสถานะล้มเหลว')
      }
    } catch (e) {
      console.error(e)
      alert('เกิดข้อผิดพลาดในการอัปเดต')
    } finally {
      setLoadingId(null)
    }
  }

  // Claim unassigned task
  const handleClaimRequest = async (requestId: string) => {
    if (loadingId || !activeTeam) return
    setLoadingId(requestId)
    try {
      const res = await fetch(`/api/help-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'assigned',
          rescueTeamId: activeTeamId,
          assignedTeam: activeTeam.name,
          incidentId,
        }),
      })
      if (res.ok) {
        setTab('assigned')
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'รับงานล้มเหลว')
      }
    } catch (e) {
      console.error(e)
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoadingId(null)
    }
  }

  // Handle Delivery Submission
  const handleDeliverySubmit = async () => {
    if (!deliveryRequest || loadingId) return
    setLoadingId(deliveryRequest.id)
    try {
      const selectedShelter = shelters.find(s => s.id === selectedShelterId)
      const destinationText =
        destType === 'shelter'
          ? `ศูนย์พักพิง: ${selectedShelter?.name || 'ไม่ระบุ'}`
          : destType === 'hospital'
            ? 'สถานพยาบาล/ส่งต่อ รพ.'
            : customDestText || 'จุดปลอดภัยอื่นๆ'

      // 1. PATCH help-request to resolved
      const patchRes = await fetch(`/api/help-requests/${deliveryRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          rescueTeamId: activeTeamId,
          assignedTeam: activeTeam?.name,
          notes: `${destinationText} · หมายเหตุ: ${deliveryNotes.trim()}` || undefined,
          incidentId,
        }),
      })

      if (!patchRes.ok) {
        const json = await patchRes.json().catch(() => ({}))
        throw new Error(json.error || 'อัปเดตงานล้มเหลว')
      }

      // 2. If destination is shelter, POST admission
      if (destType === 'shelter' && selectedShelterId) {
        const admissionRes = await fetch(`/api/shelters/${selectedShelterId}/admissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: deliveryRequest.memberId,
            intakePoint: `กู้ภัยนำส่ง (${activeTeam?.name || 'ไม่ระบุทีม'})`,
            broughtByTeamId: activeTeamId,
            notes: deliveryNotes.trim() || null,
          }),
        })

        if (!admissionRes.ok) {
          console.warn('Shelter admission logging failed, but request status was updated.')
        }
      }

      setDeliveryRequest(null)
      setTab('completed')
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoadingId(null)
    }
  }

  // Handle On-Site Rescue Submission
  const handleOnSiteSubmit = async () => {
    if (!selectedVulnerable || loadingId || !activeTeam) return
    setLoadingId(selectedVulnerable.id)
    try {
      const selectedShelter = shelters.find(s => s.id === onSiteShelterId)
      const destinationText =
        onSiteDestType === 'shelter'
          ? `ศูนย์พักพิง: ${selectedShelter?.name || 'ไม่ระบุ'}`
          : onSiteDestType === 'hospital'
            ? 'สถานพยาบาล/ส่งต่อ รพ.'
            : onSiteCustomDest || 'จุดปลอดภัยอื่นๆ'

      const descText = `กู้ภัยรับเคสหน้างาน · พิกัด อสม. [${selectedVulnerable.lat ?? '-'}, ${selectedVulnerable.lng ?? '-'}] · นำส่ง ${destinationText}`

      // 1. Create a help-request
      const reqRes = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedVulnerable.id,
          requestType: 'evacuation',
          priority: 'critical',
          description: descText,
          incidentId,
          lat: selectedVulnerable.lat,
          lng: selectedVulnerable.lng,
        }),
      })

      const reqJson = await reqRes.json().catch(() => ({}))
      if (!reqRes.ok) {
        throw new Error(reqJson.error || 'สร้างคำร้องล้มเหลว')
      }

      const newRequestId = reqJson.data?.id
      if (!newRequestId) throw new Error('ไม่สามารถตรวจสอบ ID คำร้องใหม่ได้')

      // 2. Resolve it immediately and assign to team
      const patchRes = await fetch(`/api/help-requests/${newRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          rescueTeamId: activeTeamId,
          assignedTeam: activeTeam.name,
          notes: onSiteNotes.trim() || undefined,
          incidentId,
        }),
      })

      if (!patchRes.ok) {
        throw new Error('อัปเดตงานให้เสร็จสิ้นล้มเหลว')
      }

      // 3. Post admission if shelter selected
      if (onSiteDestType === 'shelter' && onSiteShelterId) {
        await fetch(`/api/shelters/${onSiteShelterId}/admissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: selectedVulnerable.id,
            intakePoint: `กู้ภัยรับเคสหน้างาน (${activeTeam.name})`,
            broughtByTeamId: activeTeamId,
            notes: onSiteNotes.trim() || null,
          }),
        }).catch(err => console.warn('Shelter admission fail:', err))
      }

      setOnSiteModal(false)
      setSelectedVulnerable(null)
      setSearchQuery('')
      setTab('completed')
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-lg min-h-screen pb-20 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 px-4 pt-4">
      {/* Top operational banner */}
      <div className="mb-4 bg-slate-900 dark:bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-800">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="size-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
            <Compass className="size-5 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-widest">
              ปฏิบัติการกู้ชีพกู้ภัยภาคสนาม
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              จัดการภารกิจและข้อมูลในพื้นที่ระดับหน้างาน
            </p>
          </div>
        </div>

        <div className="relative bg-slate-850 dark:bg-slate-800/80 rounded-xl border border-slate-700/50 px-3 py-2 flex items-center gap-2">
          <Users size={14} className="text-slate-400 shrink-0" />
          <select
            value={activeTeamId}
            onChange={(e) => selectTeam(e.target.value)}
            className="flex-1 bg-transparent border-0 font-bold text-sm outline-none focus:ring-0 text-white p-0 pr-6 cursor-pointer select-none appearance-none"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id} className="text-slate-900 bg-white">
                {t.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 pointer-events-none text-slate-400 text-[10px]">▼</div>
        </div>
      </div>

      {/* Tabs list selector */}
      <div className="grid grid-cols-4 gap-1 bg-slate-200/60 dark:bg-slate-900/60 rounded-xl p-1 mb-4 text-xs font-semibold text-slate-500 border border-slate-200/50 dark:border-slate-800/40">
        <button
          onClick={() => setTab('assigned')}
          className={`py-2 rounded-lg text-center transition-all ${
            tab === 'assigned'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold shadow-sm'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          งานมอบหมาย
        </button>
        <button
          onClick={() => setTab('active')}
          className={`py-2 rounded-lg text-center transition-all ${
            tab === 'active'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold shadow-sm'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          ดำเนินการ
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`py-2 rounded-lg text-center transition-all ${
            tab === 'completed'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold shadow-sm'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          ประวัติงาน
        </button>
        <button
          onClick={() => setTab('unassigned')}
          className={`py-2 rounded-lg text-center transition-all relative ${
            tab === 'unassigned'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-bold shadow-sm'
              : 'hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          คิวรวม
          {requests.filter(r => r.rescueTeamId === null && r.status !== 'resolved' && r.status !== 'cancelled').length > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 border border-white dark:border-slate-900 animate-pulse" />
          )}
        </button>
      </div>

      {/* Task list container */}
      <div className="space-y-3">
        {filteredRequests.map((r) => {
          const isCritical = r.priority === 'critical'
          const formattedTime = r.observedAt
            ? new Date(r.observedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
            : ''
          const formattedDate = r.observedAt
            ? new Date(r.observedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
            : ''
          const locationText = [r.memberHno ? `บ้านเลขที่ ${r.memberHno}` : null, r.memberVillage, r.memberTambon].filter(Boolean).join(' ')

          return (
            <div
              key={r.id}
              className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm relative overflow-hidden transition-all duration-200 ${
                isCritical
                  ? 'border-l-4 border-l-rose-500 border-slate-200 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Header: Date + Priority */}
              <div className="flex items-center justify-between gap-2 mb-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {formattedDate} {formattedTime}
                </span>

                {isCritical && (
                  <span className="bg-rose-50 dark:bg-rose-950/20 text-rose-500 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase flex items-center gap-1">
                    <span className="size-1.5 bg-rose-500 rounded-full animate-ping" />
                    วิกฤต P1
                  </span>
                )}
              </div>

              {/* Patient details */}
              <div className="mb-3">
                <h4 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{r.memberName}</span>
                  {r.memberPhone && (
                    <a
                      href={`tel:${r.memberPhone}`}
                      className="text-sky-500 hover:text-sky-600 size-8 bg-sky-50 dark:bg-sky-950/20 rounded-full flex items-center justify-center transition-colors"
                    >
                      <Phone size={14} />
                    </a>
                  )}
                </h4>
                {r.memberAge && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">อายุ: {r.memberAge} ปี</p>
                )}

                {/* Medical flags */}
                {r.memberLifeSupport.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.memberLifeSupport.map((code) => (
                      <span
                        key={code}
                        className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-200/50 dark:border-red-900/40"
                      >
                        {LS_LABEL[code] || code}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Address detail */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800/80 mb-4 text-xs space-y-1">
                <div className="flex items-start gap-1.5">
                  <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 leading-normal">{locationText}</span>
                </div>
                {r.description && (
                  <div className="flex items-start gap-1.5 border-t border-slate-100 dark:border-slate-800/50 pt-1.5 mt-1.5 text-slate-600 dark:text-slate-400 italic">
                    <Activity size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    <span>{r.description}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Unassigned Claim */}
                {tab === 'unassigned' && (
                  <Button
                    onClick={() => handleClaimRequest(r.id)}
                    disabled={loadingId !== null}
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/10"
                  >
                    <Anchor size={14} />
                    รับภารกิจนี้
                  </Button>
                )}

                {/* Assigned setoff */}
                {tab === 'assigned' && (
                  <Button
                    onClick={() => handleUpdateStatus(r.id, 'en_route')}
                    disabled={loadingId !== null}
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/10"
                  >
                    <Navigation size={14} />
                    ออกเดินทาง (En Route)
                  </Button>
                )}

                {/* In progress triggers */}
                {tab === 'active' && r.status === 'en_route' && (
                  <Button
                    onClick={() => handleUpdateStatus(r.id, 'arrived')}
                    disabled={loadingId !== null}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10"
                  >
                    <Map size={14} />
                    ถึงจุดหมาย/รับตัวแล้ว (Arrived)
                  </Button>
                )}

                {tab === 'active' && (r.status === 'arrived' || r.status === 'en_route') && (
                  <Button
                    onClick={() => {
                      setDeliveryRequest(r)
                      setSelectedShelterId(shelters[0]?.id || '')
                      setCustomDestText('')
                      setDeliveryNotes('')
                      setDestType('shelter')
                    }}
                    disabled={loadingId !== null}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <CheckCircle2 size={14} />
                    นำส่งเสร็จสิ้น
                  </Button>
                )}

                {/* Map routing buttons */}
                {r.lat !== null && r.lng !== null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-slate-200 dark:border-slate-800 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 shrink-0 size-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
                    title="เปิดนำทาง GPS"
                  >
                    <Compass size={16} />
                  </a>
                )}
              </div>
            </div>
          )
        })}

        {filteredRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-350 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            <div className="rounded-full bg-slate-100 dark:bg-slate-900 p-3 mb-2.5 text-slate-400">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
              {tab === 'assigned'
                ? 'ไม่มีงานมอบหมายค้างอยู่'
                : tab === 'active'
                  ? 'ไม่มีงานกำลังปฏิบัติหน้าที่'
                  : tab === 'completed'
                    ? 'ไม่มีประวัติงานที่สำเร็จ'
                    : 'ไม่มีคำร้องรวมในขณะนี้'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-normal">
              {tab === 'unassigned'
                ? 'คำขอจากฟอร์มรายงานประชาชนหรือ อสม. ที่จัดทีมสำเร็จจะมาแสดงให้เลือกรับงานที่นี่'
                : 'ข้อมูลภารกิจจะไหลมาเรียลไทม์จากระบบศูนย์บัญชาการ EOC ส่วนกลาง'}
            </p>
          </div>
        )}
      </div>

      {/* DELIVERY DETAILS SHEET */}
      <Sheet open={!!deliveryRequest} onOpenChange={(o) => { if (!o) setDeliveryRequest(null) }}>
        <SheetContent side="bottom" className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-0 flex flex-col max-h-[85vh]">
          <SheetHeader className="border-b border-slate-100 dark:border-slate-900 p-4 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm text-slate-900 dark:text-white">
              <CheckCircle2 size={16} className="text-emerald-500" />
              บันทึกผลการกู้ภัย / นำส่งเรียบร้อย
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              เคสผู้ประสบภัย: {deliveryRequest?.memberName}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Destination Type Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">สถานที่ปลายทาง</label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 text-xs border border-slate-200/50 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setDestType('shelter')}
                  className={`py-2 rounded-lg text-center font-bold transition-all ${
                    destType === 'shelter' ? 'bg-white dark:bg-slate-800 text-sky-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Tent size={12} className="inline mr-1" />
                  ศูนย์พักพิง
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('hospital')}
                  className={`py-2 rounded-lg text-center font-bold transition-all ${
                    destType === 'hospital' ? 'bg-white dark:bg-slate-800 text-sky-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Hospital size={12} className="inline mr-1" />
                  โรงพยาบาล
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('other')}
                  className={`py-2 rounded-lg text-center font-bold transition-all ${
                    destType === 'other' ? 'bg-white dark:bg-slate-800 text-sky-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <MapPin size={12} className="inline mr-1" />
                  จุดปลอดภัย
                </button>
              </div>
            </div>

            {/* Conditional input fields */}
            {destType === 'shelter' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เลือกศูนย์พักพิงเป้าหมาย</label>
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none text-slate-900 dark:text-white"
                  value={selectedShelterId}
                  onChange={(e) => setSelectedShelterId(e.target.value)}
                >
                  {shelters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (พักแล้ว {s.occupancy}/{s.capacity || 'ไม่ระบุ'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destType === 'other' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ระบุรายละเอียดจุดส่งตัว</label>
                <input
                  type="text"
                  placeholder="เช่น ศาลาเอนกประสงค์บ้านท่าล้อ"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none text-slate-900 dark:text-white"
                  value={customDestText}
                  onChange={(e) => setCustomDestText(e.target.value)}
                />
              </div>
            )}

            {/* Resolution Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">บันทึกอาการ/หมายเหตุการกู้ภัย</label>
              <textarea
                rows={3}
                placeholder="ระบุอาการของผู้ประสบภัย หรือของติดตัวที่นำมาด้วย (ไม่บังคับ)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-[13px] outline-none text-slate-900 dark:text-white"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-900 p-4 shrink-0">
            <Button
              variant="outline"
              onClick={() => setDeliveryRequest(null)}
              disabled={loadingId !== null}
              className="flex-1 rounded-xl h-10 text-xs font-bold"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDeliverySubmit}
              disabled={loadingId !== null}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl text-xs"
            >
              {loadingId ? 'กำลังบันทึก...' : 'บันทึกอพยพสำเร็จ'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ON-SITE FIELD RESCUE SHEET */}
      <Sheet open={onSiteModal} onOpenChange={(o) => { if (!o) setOnSiteModal(false) }}>
        <SheetContent side="bottom" className="w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-0 flex flex-col max-h-[85vh]">
          <SheetHeader className="border-b border-slate-100 dark:border-slate-900 p-4 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm text-slate-900 dark:text-white">
              <Plus size={16} className="text-sky-500" />
              บันทึกช่วยเหลือ/รับเคสหน้างาน (On-Site)
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              บันทึกรับเคสผู้ป่วยกรณีออกตรวจภาคสนามและพบผู้ประสบภัย
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Search vulnerable person */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ค้นหารายชื่อผู้ประสบภัยในระบบ</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาชื่อ หรือ หมู่บ้าน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 text-[13px] outline-none text-slate-900 dark:text-white"
                />
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              </div>

              {/* Vulnerables list search results */}
              {searchQuery.trim().length > 0 && !selectedVulnerable && (
                <ul className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  {filteredVulnerables.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => {
                        setSelectedVulnerable(p)
                        setSearchQuery(p.name)
                      }}
                      className="p-3 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-[10px] text-slate-500">{p.village || 'ไม่ระบุหมู่บ้าน'} · {p.tambon}</span>
                    </li>
                  ))}
                  {filteredVulnerables.length === 0 && (
                    <li className="p-3 text-center text-xs text-slate-400">ไม่พบข้อมูลรายชื่อ</li>
                  )}
                </ul>
              )}
            </div>

            {/* Display Selected vulnerable person card info */}
            {selectedVulnerable && (
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex justify-between items-start">
                <div className="text-xs">
                  <p className="font-bold text-sky-600 dark:text-sky-400">{selectedVulnerable.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">หมู่บ้าน: {selectedVulnerable.village || '-'}</p>
                  {selectedVulnerable.lifeSupport.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedVulnerable.lifeSupport.map((ls) => (
                        <span key={ls} className="bg-red-50 dark:bg-red-950/20 text-red-600 text-[9px] px-1 rounded font-bold">
                          {LS_LABEL[ls] || ls}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedVulnerable(null)
                    setSearchQuery('')
                  }}
                  className="text-slate-400 hover:text-slate-600 size-6 rounded-full hover:bg-slate-200/50 flex items-center justify-center transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Destination Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">สถานที่นำส่ง</label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 text-xs border border-slate-200/50 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setOnSiteDestType('shelter')}
                  className={`py-2 rounded-lg text-center font-bold transition-all ${
                    onSiteDestType === 'shelter' ? 'bg-white dark:bg-slate-800 text-sky-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Tent size={12} className="inline mr-1" />
                  ศูนย์พักพิง
                </button>
                <button
                  type="button"
                  onClick={() => setOnSiteDestType('hospital')}
                  className={`py-2 rounded-lg text-center font-bold transition-all ${
                    onSiteDestType === 'hospital' ? 'bg-white dark:bg-slate-800 text-sky-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Hospital size={12} className="inline mr-1" />
                  โรงพยาบาล
                </button>
                <button
                  type="button"
                  onClick={() => setOnSiteDestType('other')}
                  className={`py-2 rounded-lg text-center font-bold transition-all ${
                    onSiteDestType === 'other' ? 'bg-white dark:bg-slate-800 text-sky-500 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <MapPin size={12} className="inline mr-1" />
                  จุดปลอดภัย
                </button>
              </div>
            </div>

            {onSiteDestType === 'shelter' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">เลือกศูนย์พักพิงเป้าหมาย</label>
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none text-slate-900 dark:text-white"
                  value={onSiteShelterId}
                  onChange={(e) => setOnSiteShelterId(e.target.value)}
                >
                  {shelters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (พักแล้ว {s.occupancy}/{s.capacity || 'ไม่ระบุ'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onSiteDestType === 'other' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ระบุรายละเอียดจุดส่งตัว</label>
                <input
                  type="text"
                  placeholder="เช่น ศาลาเอนกประสงค์บ้านท่าล้อ"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-[13px] outline-none text-slate-900 dark:text-white"
                  value={onSiteCustomDest}
                  onChange={(e) => setOnSiteCustomDest(e.target.value)}
                />
              </div>
            )}

            {/* Resolution Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">บันทึกผลการกู้ภัย / หมายเหตุ</label>
              <textarea
                rows={3}
                placeholder="ระบุอาการ/หมายเหตุการรับเข้าช่วยงานหน้างาน"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-[13px] outline-none text-slate-900 dark:text-white"
                value={onSiteNotes}
                onChange={(e) => setOnSiteNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-900 p-4 shrink-0">
            <Button
              variant="outline"
              onClick={() => setOnSiteModal(false)}
              disabled={loadingId !== null}
              className="flex-1 rounded-xl h-10 text-xs font-bold"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleOnSiteSubmit}
              disabled={loadingId !== null || !selectedVulnerable}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl text-xs"
            >
              {loadingId ? 'กำลังบันทึก...' : 'บันทึกอพยพสำเร็จ'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating Action Button (FAB) for On-Site Help on Mobile */}
      <button
        onClick={() => {
          setSelectedVulnerable(null)
          setSearchQuery('')
          setOnSiteNotes('')
          setOnSiteShelterId(shelters[0]?.id || '')
          setOnSiteModal(true)
        }}
        className="fixed bottom-20 right-4 z-40 bg-sky-500 hover:bg-sky-600 active:scale-95 transition-all text-white text-xs font-bold rounded-full px-4 h-12 flex items-center gap-1.5 shadow-lg shadow-sky-500/35 border border-sky-400/20"
      >
        <Plus size={16} strokeWidth={2.5} />
        ช่วยเหลือหน้างาน
      </button>
    </div>
  )
}
