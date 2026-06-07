'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, X, Waves, AlertTriangle, ShieldCheck,
  Zap, Phone, Building2, MapPin, CalendarClock, Stethoscope, LifeBuoy, Pencil,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { FieldActionSheet, type FieldActionMode } from '@/components/forms/FieldActionSheet'
import { useIsMobile } from '@/hooks/use-is-mobile'
import type { Incident, RiskLevel } from '@/types'

interface PersonDetail {
  id: string
  name: string
  type: string
  label: string
  age: number | null
  cond: string | null
  equipment: string | null
  lifeSupport: string[] | null
  medicalPriority: string | null
  followUpStatus: string | null
  lastKnownStatus: string | null
  lastContactedAt: string | null
  lastVisitedAt: string | null
  caregiverPhone: string | null
  careUnit: string | null
  village: string | null
  tambon: string | null
  amphoe: string | null
  province: string | null
  lat: number | null
  lng: number | null
  risk: RiskLevel
  sourceSystem: string | null
  sourceUnit: string | null
  createdAt: string | null
  updatedAt: string | null
}

const RISK_META: Record<RiskLevel, { label: string; Icon: typeof Waves; color: string }> = {
  flood: { label: 'ในน้ำท่วม',     Icon: Waves,         color: 'var(--risk-flood)' },
  near:  { label: 'ใกล้เขตน้ำท่วม', Icon: AlertTriangle, color: 'var(--risk-near)' },
  safe:  { label: 'ปลอดภัย',        Icon: ShieldCheck,   color: 'var(--risk-safe)' },
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  A: { label: 'A · วิกฤต',    color: 'var(--risk-flood)' },
  B: { label: 'B · เร่งด่วน', color: 'var(--risk-near)' },
  C: { label: 'C · เฝ้าระวัง', color: 'var(--risk-safe)' },
}

const FOLLOW_UP_LABELS: Record<string, string> = {
  pending:     'รอดำเนินการ',
  contacted:   'ติดต่อแล้ว',
  needs_help:  'ต้องการความช่วยเหลือ',
  moved:       'ย้ายแล้ว',
  referred:    'ส่งต่อแล้ว',
  closed:      'ปิดเคส',
}

const LS_LABELS: Record<string, string> = {
  oxygen:        'ออกซิเจน',
  dialysis_capd: 'ฟอกไต (CAPD)',
  dialysis_hd:   'ฟอกไตเลือด (HD)',
  ventilator:    'เครื่องช่วยหายใจ',
  anti_seizure:  'ยากันชัก',
  feeding_tube:  'สายให้อาหาร',
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface Props {
  personId: string | null
  open: boolean
  onClose: () => void
  onEdit?: () => void
  canEdit?: boolean
  activeIncidents: Incident[]
}

export function VulnerableDetailSheet({ personId, open, onClose, onEdit, canEdit, activeIncidents }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [data, setData] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<{ mode: FieldActionMode } | null>(null)

  useEffect(() => {
    if (!open || !personId) return
    setData(null)
    setError(null)
    setLoading(true)
    fetch(`/api/vulnerable/${personId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) throw new Error('ไม่พบข้อมูล')
        setData(j.data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, personId])

  const risk = data?.risk ?? 'safe'
  const riskMeta = RISK_META[risk]
  const RiskIcon = riskMeta.Icon
  const address = [
    data?.village,
    data?.tambon ? `ต.${data.tambon}` : null,
    data?.amphoe ? `อ.${data.amphoe}` : null,
    data?.province,
  ].filter(Boolean).join(' ')

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className="w-full gap-0 sm:!w-[420px] sm:!max-w-none">
          <SheetHeader className="border-b border-[var(--border)]">
            <SheetTitle className="text-[15px]">
              {loading ? 'กำลังโหลด…' : (data?.name ?? 'รายละเอียด')}
            </SheetTitle>
            <SheetDescription className="sr-only">ข้อมูลกลุ่มเปราะบางรายบุคคล</SheetDescription>
          </SheetHeader>

          {loading && (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2 size={22} className="animate-spin text-[var(--fg-subtle)]" />
            </div>
          )}

          {error && (
            <div className="flex flex-1 items-center justify-center py-20">
              <p className="text-[13px] text-[var(--risk-flood)]">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <div className="flex flex-col gap-0 overflow-y-auto">

              {/* ── Hero strip ── */}
              <div
                className="flex items-start justify-between gap-3 px-5 py-4"
                style={{ background: `color-mix(in oklch, ${riskMeta.color} 6%, var(--bg-sunken))` }}
              >
                <div className="min-w-0">
                  <h2 className="text-[18px] font-bold leading-snug text-[var(--fg)]">{data.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {data.label && (
                      <span className="text-[13px] text-[var(--fg-muted)]">{data.label}</span>
                    )}
                    {data.age != null && (
                      <span className="font-mono text-[12px] text-[var(--fg-subtle)]">อายุ {data.age} ปี</span>
                    )}
                  </div>
                </div>
                {/* risk badge */}
                <span
                  className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: `color-mix(in oklch, ${riskMeta.color} 12%, transparent)`,
                    color: riskMeta.color,
                  }}
                >
                  <RiskIcon size={12} strokeWidth={2} />
                  {riskMeta.label}
                </span>
              </div>

              {/* ── Quick actions ── */}
              {canEdit && (
                <div className="flex gap-2 border-b border-[var(--border)] px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setAction({ mode: 'visit' })}
                    className="gx-btn gx-btn-ghost gx-btn-sm flex-1 hover:!border-[var(--accent)] hover:!text-[var(--accent)]"
                  >
                    <Stethoscope size={13} strokeWidth={1.75} /> เยี่ยม
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction({ mode: 'help' })}
                    className="gx-btn gx-btn-ghost gx-btn-sm flex-1 hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]"
                  >
                    <LifeBuoy size={13} strokeWidth={1.75} /> ขอช่วยเหลือ
                  </button>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--fg-muted)] hover:!text-[var(--fg)]"
                  >
                    <Pencil size={13} strokeWidth={1.75} /> แก้ไข
                  </button>
                </div>
              )}

              <div className="divide-y divide-[var(--border)]">

                {/* ── Medical ── */}
                <section className="px-5 py-4">
                  <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--fg-subtle)]">ข้อมูลทางการแพทย์</p>
                  <div className="space-y-2.5">
                    {data.medicalPriority && (() => {
                      const pm = PRIORITY_META[data.medicalPriority]
                      return (
                        <Row label="ความเร่งด่วน">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                            style={{ background: `color-mix(in oklch, ${pm?.color ?? 'var(--fg-subtle)'} 12%, transparent)`, color: pm?.color ?? 'var(--fg)' }}
                          >
                            {pm?.label ?? data.medicalPriority}
                          </span>
                        </Row>
                      )
                    })()}
                    {data.followUpStatus && (
                      <Row label="สถานะติดตาม">
                        <span className="text-[13px] text-[var(--fg)]">{FOLLOW_UP_LABELS[data.followUpStatus] ?? data.followUpStatus}</span>
                      </Row>
                    )}
                    {data.cond && (
                      <Row label="ภาวะ / อาการ">
                        <span className="text-[13px] text-[var(--fg)]">{data.cond}</span>
                      </Row>
                    )}
                    {data.lastKnownStatus && (
                      <Row label="สถานะล่าสุด">
                        <span className="text-[13px] text-[var(--fg)]">{data.lastKnownStatus}</span>
                      </Row>
                    )}
                    {data.lifeSupport && data.lifeSupport.length > 0 && (
                      <Row label="อุปกรณ์พยุงชีพ" align="start">
                        <div className="flex flex-wrap gap-1.5">
                          {data.lifeSupport.map((ls) => (
                            <span
                              key={ls}
                              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium"
                              style={{
                                background: 'color-mix(in oklch, var(--risk-flood) 10%, transparent)',
                                color: 'var(--risk-flood)',
                              }}
                            >
                              <Zap size={9} strokeWidth={2.5} />
                              {LS_LABELS[ls] ?? ls}
                            </span>
                          ))}
                        </div>
                      </Row>
                    )}
                    {data.equipment && (
                      <Row label="อุปกรณ์อื่น">
                        <span className="text-[13px] text-[var(--fg)]">{data.equipment}</span>
                      </Row>
                    )}
                  </div>
                </section>

                {/* ── Contact ── */}
                <section className="px-5 py-4">
                  <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--fg-subtle)]">การติดต่อ / ดูแล</p>
                  <div className="space-y-2.5">
                    {data.caregiverPhone && (
                      <Row label="เบอร์ผู้ดูแล">
                        <a
                          href={`tel:${data.caregiverPhone}`}
                          className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] hover:underline"
                        >
                          <Phone size={13} strokeWidth={1.75} />
                          {data.caregiverPhone}
                        </a>
                      </Row>
                    )}
                    {data.careUnit && (
                      <Row label="หน่วยบริการ">
                        <span className="flex items-center gap-1.5 text-[13px] text-[var(--fg)]">
                          <Building2 size={13} strokeWidth={1.75} className="text-[var(--fg-subtle)]" />
                          {data.careUnit}
                        </span>
                      </Row>
                    )}
                    {data.lastContactedAt && (
                      <Row label="ติดต่อล่าสุด">
                        <span className="flex items-center gap-1.5 text-[13px] text-[var(--fg)]">
                          <CalendarClock size={13} strokeWidth={1.75} className="text-[var(--fg-subtle)]" />
                          {fmtDate(data.lastContactedAt)}
                        </span>
                      </Row>
                    )}
                    {data.lastVisitedAt && (
                      <Row label="เยี่ยมล่าสุด">
                        <span className="flex items-center gap-1.5 text-[13px] text-[var(--fg)]">
                          <CalendarClock size={13} strokeWidth={1.75} className="text-[var(--fg-subtle)]" />
                          {fmtDate(data.lastVisitedAt)}
                        </span>
                      </Row>
                    )}
                  </div>
                </section>

                {/* ── Address ── */}
                {address && (
                  <section className="px-5 py-4">
                    <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--fg-subtle)]">ที่อยู่</p>
                    <div className="flex items-start gap-2">
                      <MapPin size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--fg-subtle)]" />
                      <span className="text-[13px] leading-relaxed text-[var(--fg)]">{address}</span>
                    </div>
                    {data.lat != null && data.lng != null && (
                      <p className="mt-1.5 font-mono text-[11px] text-[var(--fg-subtle)]">
                        {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
                      </p>
                    )}
                  </section>
                )}

                {/* ── Meta ── */}
                <section className="px-5 py-4">
                  <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--fg-subtle)]">ข้อมูลระบบ</p>
                  <div className="space-y-2">
                    {data.sourceSystem && (
                      <Row label="แหล่งที่มา">
                        <span className="rounded bg-[var(--bg-sunken)] px-2 py-0.5 font-mono text-[11.5px] text-[var(--fg-muted)]">{data.sourceSystem}</span>
                      </Row>
                    )}
                    {data.sourceUnit && (
                      <Row label="หน่วยต้นสังกัด">
                        <span className="text-[13px] text-[var(--fg-muted)]">{data.sourceUnit}</span>
                      </Row>
                    )}
                    {data.createdAt && (
                      <Row label="บันทึกเมื่อ">
                        <span className="text-[12px] text-[var(--fg-subtle)]">{fmtDate(data.createdAt)}</span>
                      </Row>
                    )}
                    {data.updatedAt && (
                      <Row label="แก้ไขล่าสุด">
                        <span className="text-[12px] text-[var(--fg-subtle)]">{fmtDate(data.updatedAt)}</span>
                      </Row>
                    )}
                  </div>
                </section>

              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {action && data && (
        <FieldActionSheet
          target={{ id: data.id, name: data.name }}
          mode={action.mode}
          activeIncidents={activeIncidents}
          currentLifeSupport={data.lifeSupport ?? []}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null)
            // refresh ข้อมูลใน sheet
            setData(null)
            setLoading(true)
            fetch(`/api/vulnerable/${data.id}`)
              .then((r) => r.json())
              .then((j) => j.data && setData(j.data))
              .catch(() => {})
              .finally(() => setLoading(false))
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function Row({ label, children, align = 'center' }: {
  label: string
  children: React.ReactNode
  align?: 'center' | 'start'
}) {
  return (
    <div className={`flex gap-3 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <span className="w-28 shrink-0 text-[12px] text-[var(--fg-subtle)]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
