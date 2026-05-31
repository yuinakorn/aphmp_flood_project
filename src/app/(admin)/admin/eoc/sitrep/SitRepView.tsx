'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Pencil, X, Loader2, Home, AlertTriangle } from 'lucide-react'
import type { Incident, IncidentType, SitRepAuto, SitRepManual, SitReport } from '@/types'

interface Props {
  incident: Incident
  auto: SitRepAuto
  report: SitReport | null
  canEdit: boolean
}

const INCIDENT_LABEL: Record<IncidentType, string> = {
  flood: 'อุทกภัย',
  storm: 'วาตภัย',
  other: 'สาธารณภัย',
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function thaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00+07:00`)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

const fmt = (n: number) => n.toLocaleString('th-TH')

export function SitRepView({ incident, auto, report, canEdit }: Props) {
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reportDate, setReportDate] = useState(report?.reportDate ?? today)
  const [reportTime, setReportTime] = useState(report?.reportTime ?? '')
  const [manual, setManual] = useState<SitRepManual>(report?.manual ?? {})
  const [measures, setMeasures] = useState(report?.measures ?? '')
  const [planNote, setPlanNote] = useState(report?.planNote ?? '')

  const m = report?.manual ?? {}
  const tambonCount = m.affectedTambonCount ?? auto.affectedTambons.length

  async function save(status: 'draft' | 'published') {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${incident.id}/sitrep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportDate, reportTime, manual, measures, planNote, status }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `บันทึกไม่สำเร็จ (${res.status})`)
      }
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const teams = m.teams ?? {}
  const services = m.services ?? {}
  const reportLabel = report ? `${thaiDate(report.reportDate)}${report.reportTime ? ` เวลา ${report.reportTime}` : ''}` : 'ยังไม่มีข้อมูลรายงาน — กรอกเพื่อสร้าง'

  return (
    <div className="mx-auto max-w-5xl">
      <style>{`@media print {
        .sitrep-noprint { display: none !important; }
        .sitrep-sheet { box-shadow: none !important; border: none !important; }
        body { background: #fff !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }`}</style>

      {/* toolbar */}
      <div className="sitrep-noprint mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/eoc" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
          <ArrowLeft size={15} /> กลับ EOC
        </Link>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => { setEditing((v) => !v); setError(null) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)]"
            >
              {editing ? <X size={14} /> : <Pencil size={14} />} {editing ? 'ปิดการแก้ไข' : 'แก้ไขข้อมูลรายงาน'}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)]"
          >
            <Printer size={14} /> พิมพ์ / บันทึก PDF
          </button>
        </div>
      </div>

      {error && (
        <p className="sitrep-noprint mb-4 rounded-lg border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_8%,transparent)] px-3 py-2 text-sm text-[var(--risk-flood)]">
          {error}
        </p>
      )}

      {/* ── EDIT PANEL ── */}
      {editing && (
        <EditPanel
          reportDate={reportDate} setReportDate={setReportDate}
          reportTime={reportTime} setReportTime={setReportTime}
          manual={manual} setManual={setManual}
          measures={measures} setMeasures={setMeasures}
          planNote={planNote} setPlanNote={setPlanNote}
          auto={auto} saving={saving} onSave={save}
        />
      )}

      {/* ── REPORT SHEET ── */}
      <div className="sitrep-sheet overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        {/* header */}
        <div className="bg-gradient-to-r from-[oklch(0.45_0.13_240)] to-[oklch(0.55_0.12_200)] px-6 py-6 text-white">
          <h1 className="text-2xl font-bold tracking-tight">สรุปสถานการณ์</h1>
          <p className="mt-1 text-sm text-white/90">
            {INCIDENT_LABEL[incident.type]} · {incident.name}
          </p>
          <p className="text-sm text-white/90">
            {[incident.amphoe && `อำเภอ${incident.amphoe}`, incident.province && `จังหวัด${incident.province}`].filter(Boolean).join(' ')}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-sm">
            ประจำวันที่ {reportLabel}
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm font-medium text-[var(--fg)]">
            มีสถานการณ์ในพื้นที่ จำนวน <span className="font-bold text-[oklch(0.55_0.2_25)]">{fmt(tambonCount)}</span> ตำบล
            {auto.affectedTambons.length > 0 && (
              <span className="ml-1 text-xs font-normal text-[var(--fg-subtle)]">({auto.affectedTambons.join(', ')})</span>
            )}
          </p>

          {/* casualties */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CasualtyCard label="เสียชีวิต" tc={auto.casualties.dead} tone="oklch(0.5 0.02 250)" />
            <CasualtyCard label="สูญหาย" tc={auto.casualties.missing} tone="oklch(0.6 0.2 25)" />
            <CasualtyCard label="บาดเจ็บ" tc={auto.casualties.injured} tone="oklch(0.65 0.18 50)" />
            <CasualtyCard label="รวม" tc={auto.casualties.total} tone="oklch(0.7 0.16 75)" />
          </div>

          {/* visited + shelters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock icon={<Home size={16} />} title="ประชาชนได้รับการเยี่ยม" tone="oklch(0.6 0.13 200)">
              <span className="font-mono text-3xl font-bold">{fmt(auto.householdsVisited)}</span>
              <span className="ml-1 text-sm text-[var(--fg-muted)]">ครัวเรือน · วันนี้ {fmt(auto.visitsToday)} ครั้ง</span>
            </InfoBlock>
            <InfoBlock icon={<Home size={16} />} title="ศูนย์พักพิง" tone="oklch(0.6 0.14 160)">
              <span className="font-mono text-3xl font-bold">{fmt(auto.sheltersUsed)}</span>
              <span className="ml-1 text-sm text-[var(--fg-muted)]">แห่ง · พักอยู่ {fmt(auto.shelterCurrent)} ราย</span>
              {auto.shelterNames.length > 0 && (
                <p className="mt-1 text-xs text-[var(--fg-subtle)]">{auto.shelterNames.join(', ')}</p>
              )}
            </InfoBlock>
          </div>

          {/* health facilities + support (manual) */}
          <Section title="สถานบริการสาธารณสุขที่ได้รับผลกระทบ">
            <MiniStat label="รพ.สต." value={m.rpstAffected} unit="แห่ง" />
            <MiniStat label="โรงพยาบาล" value={m.hospitalAffected} unit="แห่ง" />
            <MiniStat label="ปิดบริการ" value={m.facilitiesClosed} unit="แห่ง" />
            <MiniStat label="เปิดบางส่วน" value={m.facilitiesPartial} unit="แห่ง" />
          </Section>

          <Section title="การสนับสนุน">
            <MiniStat label="ออกหน่วย" value={m.mobileUnitDispatch} unit="ครั้ง" />
            <MiniStat label="ชุดทำแผล" value={m.woundKits} unit="ชุด" />
            <MiniStat label="ชุดยาน้ำท่วม" value={m.floodMedKits} unit="ชุด" />
            <MiniStat label="บุคลากรกระทบ" value={m.staffAffected} unit="ราย" />
            <MiniStat label="ยาโรคเรื้อรัง" value={m.chronicMedItems} unit="รายการ" />
            <MiniStat label="ยาโรคเรื้อรัง" value={m.chronicMedUnits} unit="หน่วย" />
          </Section>

          {/* teams (manual) */}
          <Section title="ทีมปฏิบัติการฉุกเฉินทางการแพทย์">
            <MiniStat label="MERT" value={teams.mert} />
            <MiniStat label="Mini MERT" value={teams.miniMert} />
            <MiniStat label="หน่วยแพทย์เคลื่อนที่" value={teams.mobileMed} />
            <MiniStat label="MCATT" value={teams.mcatt} />
            <MiniStat label="SEhRT" value={teams.sehrt} />
            <MiniStat label="CDCU" value={teams.cdcu} />
            <MiniStat label="SRRT" value={teams.srrt} />
            <MiniStat label="อื่นๆ" value={teams.other} />
          </Section>

          {/* services (manual, homeVisit auto-prefill suggestion) */}
          <Section title="ผู้รับบริการด้านการแพทย์รวม">
            <MiniStat label="เยี่ยมบ้าน" value={services.homeVisit} unit="ราย" />
            <MiniStat label="แจกจ่ายเวชภัณฑ์" value={services.supplies} unit="ราย" />
            <MiniStat label="ตรวจรักษา" value={services.treatment} unit="ราย" />
            <MiniStat label="ให้สุขศึกษา" value={services.healthEdu} unit="ราย" />
            <MiniStat label="สุขภาพจิต" value={services.mentalHealth} unit="ราย" />
            <MiniStat label="ส่งต่อ รพ.สต." value={services.referRpst} unit="ราย" />
            <MiniStat label="ส่งต่อ รพ." value={services.referHospital} unit="ราย" />
          </Section>

          {/* surveillance (auto) */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
              <AlertTriangle size={15} className="text-[oklch(0.6_0.18_50)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">เฝ้าระวังโรค (วันนี้ / สะสม)</span>
            </div>
            {auto.surveillance.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีข้อมูลเฝ้าระวังโรค</p>
            ) : (
              <ul className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-y-0">
                {auto.surveillance.map((d, i) => (
                  <li key={d.code} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 === 0 ? 'sm:border-r sm:border-[var(--border)]' : ''}`}>
                    <span className="text-[var(--fg)]">{d.label}</span>
                    <span className="font-mono">
                      <span className="font-semibold text-[oklch(0.6_0.18_50)]">{fmt(d.today)}</span>
                      <span className="text-[var(--fg-subtle)]"> / {fmt(d.cumulative)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* measures + plan (manual text) */}
          {(report?.measures || report?.planNote) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report?.measures && (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <h3 className="mb-2 text-sm font-semibold text-[var(--fg)]">มาตรการดำเนินการหลัก</h3>
                  <p className="whitespace-pre-wrap text-sm text-[var(--fg-muted)]">{report.measures}</p>
                </div>
              )}
              {report?.planNote && (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <h3 className="mb-2 text-sm font-semibold text-[var(--fg)]">แผนปฏิบัติการ</h3>
                  <p className="whitespace-pre-wrap text-sm text-[var(--fg-muted)]">{report.planNote}</p>
                </div>
              )}
            </div>
          )}

          {!report && (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--fg-subtle)]">
              ตัวเลขด้านบนคำนวณสดจากระบบ · กด &ldquo;แก้ไขข้อมูลรายงาน&rdquo; เพื่อเพิ่มข้อมูลส่วนที่กรอกเอง
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function CasualtyCard({ label, tc, tone }: { label: string; tc: { today: number; cumulative: number }; tone: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="px-3 py-1.5 text-center text-xs font-semibold text-white" style={{ background: tone }}>{label}</div>
      <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
        <div className="px-2 py-2.5 text-center">
          <p className="text-[10px] text-[var(--fg-subtle)]">วันนี้</p>
          <p className="font-mono text-xl font-bold text-[var(--fg)]">{fmt(tc.today)}</p>
        </div>
        <div className="px-2 py-2.5 text-center">
          <p className="text-[10px] text-[var(--fg-subtle)]">สะสม</p>
          <p className="font-mono text-xl font-bold text-[var(--fg)]">{fmt(tc.cumulative)}</p>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: tone }}>{icon}{title}</div>
      <div className="text-[var(--fg)]">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
        {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">{children}</div>
    </div>
  )
}

function MiniStat({ label, value, unit }: { label: string; value?: number | null; unit?: string }) {
  return (
    <div className="flex flex-col border-b border-l border-[var(--border)] px-3 py-2.5 first:border-l-0">
      <span className="truncate text-[11px] text-[var(--fg-subtle)]">{label}</span>
      <span className="font-mono text-lg font-bold text-[var(--fg)]">
        {fmt(value ?? 0)}{unit && <span className="ml-1 text-[10px] font-normal text-[var(--fg-subtle)]">{unit}</span>}
      </span>
    </div>
  )
}

// ───────── Edit panel ─────────
interface EditProps {
  reportDate: string; setReportDate: (v: string) => void
  reportTime: string; setReportTime: (v: string) => void
  manual: SitRepManual; setManual: (v: SitRepManual) => void
  measures: string; setMeasures: (v: string) => void
  planNote: string; setPlanNote: (v: string) => void
  auto: SitRepAuto
  saving: boolean
  onSave: (status: 'draft' | 'published') => void
}

const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]'

function NumField({ label, value, onChange, unit }: { label: string; value?: number; onChange: (v: string) => void; unit?: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-[var(--fg-subtle)]">{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" min={0} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  )
}

function EditPanel(p: EditProps) {
  const setNum = (path: string, v: string) => {
    const num = v === '' ? undefined : Number(v)
    const next = structuredClone(p.manual) as SitRepManual & Record<string, unknown>
    const parts = path.split('.')
    if (parts.length === 1) {
      ;(next as Record<string, unknown>)[parts[0]] = num
    } else {
      const grp = (next as Record<string, Record<string, unknown>>)[parts[0]] ?? {}
      grp[parts[1]] = num
      ;(next as Record<string, unknown>)[parts[0]] = grp
    }
    p.setManual(next)
  }
  const g = (path: string): number | undefined => {
    const parts = path.split('.')
    const obj = p.manual as Record<string, unknown>
    if (parts.length === 1) return obj[parts[0]] as number | undefined
    return ((obj[parts[0]] as Record<string, unknown>) ?? {})[parts[1]] as number | undefined
  }

  const f = (path: string) => ({ value: g(path), onChange: (v: string) => setNum(path, v) })

  return (
    <div className="sitrep-noprint mb-4 rounded-2xl border border-[var(--accent)] bg-[var(--bg-elevated)] p-5">
      <h2 className="mb-4 text-base font-semibold text-[var(--fg)]">แก้ไขข้อมูลรายงาน (ส่วนกรอกเอง)</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-[var(--fg-subtle)]">วันที่รายงาน</span>
          <input type="date" value={p.reportDate} onChange={(e) => p.setReportDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-[var(--fg-subtle)]">เวลา</span>
          <input value={p.reportTime} onChange={(e) => p.setReportTime(e.target.value)} placeholder="17.00 น." className={inputCls} />
        </label>
        <NumField label={`จำนวนตำบล (auto ${p.auto.affectedTambons.length})`} {...f('affectedTambonCount')} />
      </div>

      <FieldGroup title="สถานบริการที่กระทบ">
        <NumField label="รพ.สต." {...f('rpstAffected')} />
        <NumField label="โรงพยาบาล" {...f('hospitalAffected')} />
        <NumField label="ปิดบริการ" {...f('facilitiesClosed')} />
        <NumField label="เปิดบางส่วน" {...f('facilitiesPartial')} />
      </FieldGroup>

      <FieldGroup title="การสนับสนุน">
        <NumField label="ออกหน่วย" {...f('mobileUnitDispatch')} />
        <NumField label="ชุดทำแผล" {...f('woundKits')} />
        <NumField label="ชุดยาน้ำท่วม" {...f('floodMedKits')} />
        <NumField label="บุคลากรกระทบ" {...f('staffAffected')} />
        <NumField label="ยาเรื้อรัง" unit="รายการ" {...f('chronicMedItems')} />
        <NumField label="ยาเรื้อรัง" unit="หน่วย" {...f('chronicMedUnits')} />
      </FieldGroup>

      <FieldGroup title="ทีมปฏิบัติการฉุกเฉิน">
        <NumField label="MERT" {...f('teams.mert')} />
        <NumField label="Mini MERT" {...f('teams.miniMert')} />
        <NumField label="หน่วยแพทย์เคลื่อนที่" {...f('teams.mobileMed')} />
        <NumField label="MCATT" {...f('teams.mcatt')} />
        <NumField label="SEhRT" {...f('teams.sehrt')} />
        <NumField label="CDCU" {...f('teams.cdcu')} />
        <NumField label="SRRT" {...f('teams.srrt')} />
        <NumField label="อื่นๆ" {...f('teams.other')} />
      </FieldGroup>

      <FieldGroup title={`ผู้รับบริการการแพทย์ (เยี่ยมบ้าน auto ${p.auto.householdsVisited})`}>
        <NumField label="เยี่ยมบ้าน" {...f('services.homeVisit')} />
        <NumField label="แจกจ่ายเวชภัณฑ์" {...f('services.supplies')} />
        <NumField label="ตรวจรักษา" {...f('services.treatment')} />
        <NumField label="ให้สุขศึกษา" {...f('services.healthEdu')} />
        <NumField label="สุขภาพจิต" {...f('services.mentalHealth')} />
        <NumField label="ส่งต่อ รพ.สต." {...f('services.referRpst')} />
        <NumField label="ส่งต่อ รพ." {...f('services.referHospital')} />
      </FieldGroup>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-[var(--fg-subtle)]">มาตรการดำเนินการหลัก</span>
          <textarea value={p.measures} onChange={(e) => p.setMeasures(e.target.value)} rows={4} className={inputCls} placeholder="หนึ่งมาตรการต่อบรรทัด" />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-[var(--fg-subtle)]">แผนปฏิบัติการ / หมายเหตุ</span>
          <textarea value={p.planNote} onChange={(e) => p.setPlanNote(e.target.value)} rows={4} className={inputCls} />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={p.saving}
          onClick={() => p.onSave('draft')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-60"
        >
          {p.saving && <Loader2 size={14} className="animate-spin" />} บันทึก
        </button>
      </div>
    </div>
  )
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </div>
  )
}
