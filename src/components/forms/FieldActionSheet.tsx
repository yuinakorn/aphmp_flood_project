'use client'

import { useState } from 'react'
import { AlertTriangle, Stethoscope, LifeBuoy } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/use-is-mobile'
import type {
  HelpRequestPriority,
  HelpRequestType,
  Incident,
  PersonFieldStatus,
  VisitStatus,
} from '@/types'

export type FieldActionMode = 'visit' | 'help'

export interface FieldActionTarget {
  id: string
  name: string
}

interface Props {
  target: FieldActionTarget
  mode: FieldActionMode
  activeIncidents: Incident[]
  /** อุปกรณ์พยุงชีพปัจจุบันของคนนี้ — prefill checkbox (กันเขียนทับเป็นค่าว่าง) */
  currentLifeSupport?: string[]
  onClose: () => void
  onDone: () => void
}

const VISIT_STATUS: { value: VisitStatus; label: string }[] = [
  { value: 'completed', label: 'เยี่ยมแล้ว' },
  { value: 'unreachable', label: 'ติดต่อไม่ได้' },
  { value: 'needs_follow_up', label: 'ต้องติดตามต่อ' },
  { value: 'pending', label: 'รอดำเนินการ' },
]

const PERSON_STATUS: { value: PersonFieldStatus; label: string }[] = [
  { value: 'safe', label: 'ปลอดภัย' },
  { value: 'needs_help', label: 'ต้องการความช่วยเหลือ' },
  { value: 'evacuated', label: 'อพยพแล้ว' },
  { value: 'referred', label: 'ส่งต่อ รพ.' },
  { value: 'unknown', label: 'ไม่ทราบ' },
]

const HELP_TYPE: { value: string; label: string }[] = [
  { value: 'medicine', label: 'ยา/เวชภัณฑ์' },
  { value: 'transport', label: 'รับ-ส่ง' },
  { value: 'evacuation', label: 'อพยพ' },
  { value: 'food_water', label: 'อาหาร/น้ำ' },
  { value: 'other', label: 'อื่นๆ' },
]

const REQUEST_TYPE: { value: HelpRequestType; label: string }[] = [
  { value: 'medical', label: 'การแพทย์' },
  { value: 'evacuation', label: 'อพยพ' },
  { value: 'supplies', label: 'เครื่องอุปโภคบริโภค' },
  { value: 'rescue', label: 'กู้ภัย' },
  { value: 'shelter', label: 'ที่พักพิง' },
  { value: 'other', label: 'อื่นๆ' },
]

const PRIORITY: { value: HelpRequestPriority; label: string }[] = [
  { value: 'normal', label: 'ปกติ' },
  { value: 'high', label: 'สูง' },
  { value: 'critical', label: 'วิกฤต' },
  { value: 'low', label: 'ต่ำ' },
]

const LIFE_SUPPORT: { value: string; label: string }[] = [
  { value: 'oxygen', label: 'ออกซิเจน' },
  { value: 'dialysis_capd', label: 'ฟอกไต (CAPD)' },
  { value: 'dialysis_hd', label: 'ฟอกไตเลือด (HD)' },
  { value: 'ventilator', label: 'เครื่องช่วยหายใจ' },
  { value: 'anti_seizure', label: 'ยากันชัก' },
  { value: 'feeding_tube', label: 'สายให้อาหาร' },
]

const selectCls =
  'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] outline-none focus:border-[var(--accent)]'

export function FieldActionSheet({ target, mode, activeIncidents, currentLifeSupport, onClose, onDone }: Props) {
  const isMobile = useIsMobile()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // visit fields
  const [visitStatus, setVisitStatus] = useState<VisitStatus>('completed')
  const [personStatus, setPersonStatus] = useState<PersonFieldStatus>('safe')
  const [needsHelp, setNeedsHelp] = useState(false)
  const [helpTypeVisit, setHelpTypeVisit] = useState('medicine')
  const [notes, setNotes] = useState('')
  const [lifeSupport, setLifeSupport] = useState<string[]>(currentLifeSupport ?? [])
  const toggleLS = (code: string) =>
    setLifeSupport((v) => (v.includes(code) ? v.filter((x) => x !== code) : [...v, code]))

  // help fields
  const [requestType, setRequestType] = useState<HelpRequestType>('medical')
  const [priority, setPriority] = useState<HelpRequestPriority>('normal')
  const [description, setDescription] = useState('')

  const incidentLine =
    activeIncidents.length === 1
      ? `จะผูกกับเหตุการณ์: ${activeIncidents[0].name}`
      : activeIncidents.length > 1
        ? `มี ${activeIncidents.length} เหตุการณ์กำลังเกิด — ระบบจะไม่ผูกอัตโนมัติ`
        : 'ไม่ได้อยู่ในโหมดวิกฤต (บันทึกแบบไม่ผูกเหตุการณ์)'

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const endpoint = mode === 'visit' ? '/api/health-visits' : '/api/help-requests'
      const body =
        mode === 'visit'
          ? {
              memberId: target.id,
              visitStatus,
              personStatus,
              needsHelp,
              helpType: needsHelp ? helpTypeVisit : null,
              notes: notes.trim() || null,
            }
          : {
              memberId: target.id,
              requestType,
              priority,
              description: description.trim() || null,
            }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')

      // อัปเดตอุปกรณ์พยุงชีพของคน (เฉพาะตอนเยี่ยม + เมื่อมีการเปลี่ยน)
      if (mode === 'visit') {
        const a = [...lifeSupport].sort().join(',')
        const b = [...(currentLifeSupport ?? [])].sort().join(',')
        if (a !== b) {
          await fetch(`/api/vulnerable/${target.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lifeSupport }),
          }).catch(() => {})
        }
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-[var(--border)]">
          <SheetTitle className="flex items-center gap-2">
            {mode === 'visit' ? <Stethoscope size={16} /> : <LifeBuoy size={16} />}
            {mode === 'visit' ? 'บันทึกการเยี่ยม' : 'ขอความช่วยเหลือ'}
          </SheetTitle>
          <SheetDescription>{target.name}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px]"
            style={{
              background: activeIncidents.length === 1
                ? 'color-mix(in oklch, var(--risk-flood) 10%, transparent)'
                : 'var(--bg-elevated)',
              color: activeIncidents.length === 1 ? 'var(--risk-flood)' : 'var(--fg-muted)',
            }}
          >
            <AlertTriangle size={13} className="shrink-0" />
            {incidentLine}
          </div>

          {mode === 'visit' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>สถานะการเยี่ยม</Label>
                <select className={selectCls} value={visitStatus} onChange={(e) => setVisitStatus(e.target.value as VisitStatus)}>
                  {VISIT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>สถานะผู้ป่วย</Label>
                <select className={selectCls} value={personStatus} onChange={(e) => setPersonStatus(e.target.value as PersonFieldStatus)}>
                  {PERSON_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>อุปกรณ์พยุงชีพที่ต้องใช้ <span className="font-normal text-[var(--fg-subtle)]">(สำคัญต่อการอพยพ)</span></Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {LIFE_SUPPORT.map((o) => {
                    const on = lifeSupport.includes(o.value)
                    return (
                      <label
                        key={o.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors ${
                          on
                            ? 'border-[color-mix(in_oklch,var(--risk-flood)_45%,transparent)] bg-[color-mix(in_oklch,var(--risk-flood)_10%,transparent)] font-medium text-[var(--risk-flood)]'
                            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleLS(o.value)}
                          className="accent-[var(--risk-flood)]"
                        />
                        {o.label}
                      </label>
                    )
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={needsHelp} onChange={(e) => setNeedsHelp(e.target.checked)} />
                ต้องการความช่วยเหลือ
              </label>
              {needsHelp && (
                <div className="flex flex-col gap-1.5">
                  <Label>ประเภทความช่วยเหลือ</Label>
                  <select className={selectCls} value={helpTypeVisit} onChange={(e) => setHelpTypeVisit(e.target.value)}>
                    {HELP_TYPE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>บันทึกเพิ่มเติม</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="อาการ/รายละเอียด (ไม่บังคับ)" />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>ประเภทคำขอ</Label>
                <select className={selectCls} value={requestType} onChange={(e) => setRequestType(e.target.value as HelpRequestType)}>
                  {REQUEST_TYPE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>ระดับความเร่งด่วน</Label>
                <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value as HelpRequestPriority)}>
                  {PRIORITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>รายละเอียด</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดคำขอ (ไม่บังคับ)" />
              </div>
            </>
          )}

          {error && <p className="text-[12px] text-[var(--risk-flood)]">{error}</p>}
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="button" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
