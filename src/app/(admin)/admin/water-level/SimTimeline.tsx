'use client'

import { Play, Pause, RotateCcw } from 'lucide-react'
import type { ThresholdEta } from '@/lib/hydraulics'
import { InfoHint, HintSection } from './InfoHint'

type Props = {
  simTime: number
  horizonHours: number
  playing: boolean
  onScrub: (t: number) => void
  onTogglePlay: () => void
  onReset: () => void
  etas: ThresholdEta[]
  stationCode: string
}

const ETA_COLORS: Record<ThresholdEta['key'], string> = {
  warning: '#ca8a04',
  prepare: '#ea580c',
  critical: '#dc2626',
  danger: '#b91c1c',
}

/** ไทม์ไลน์จำลอง: Play/Pause + scrub 0..horizon ชม. + ETA ถึงเกณฑ์ปลายน้ำ */
export function SimTimeline({
  simTime, horizonHours, playing, onScrub, onTogglePlay, onReset, etas, stationCode,
}: Props) {
  const totalMin = Math.round(simTime * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <button
          type="button"
          onClick={onTogglePlay}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
          aria-label={playing ? 'หยุดชั่วคราว' : 'เล่นการจำลอง'}
        >
          {playing ? <Pause size={12} strokeWidth={2.2} /> : <Play size={12} strokeWidth={2.2} className="ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
          aria-label="เริ่มใหม่"
        >
          <RotateCcw size={11} strokeWidth={2} />
        </button>

        <input
          type="range"
          min={0}
          max={horizonHours}
          step={0.05}
          value={simTime}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="min-w-24 flex-1 basis-36"
          style={{ accentColor: 'var(--accent)' }}
          aria-label="เลื่อนเวลาจำลอง"
        />

        <span className="shrink-0 text-right font-mono text-[12.5px] font-semibold tabular-nums">
          T+{hh}:{mm.toString().padStart(2, '0')}
          <span className="ml-1 text-[10px] font-normal text-[var(--fg-muted)]">ชม.</span>
        </span>
        <InfoHint>
          <HintSection title="มีไว้ทำไม">
            เลื่อนดูเหตุการณ์ล่วงหน้า 0–12 ชม. ว่ามวลน้ำที่จำลองจะเดินทางถึงปลายน้ำเมื่อไหร่
            ทุกอย่างบนจอ (ระดับน้ำ การ์ดสถานี สถานะเตือน) จะขยับตามเวลา T+ ที่เลือก
          </HintSection>
          <HintSection title="หลักการ">
            กด Play = เดินเวลาอัตโนมัติ (1 ชม.จำลอง ≈ 1.25 วินาที) หรือลากแถบเลื่อนดูเวลาใดก็ได้
            ค่าทุกจุดอ่านจากเส้นพยากรณ์ที่คำนวณไว้ล่วงหน้าแล้ว ไม่ใช่สุ่ม
          </HintSection>
          <HintSection title="ป้าย ETA">
            คือจุดแรกที่เส้นพยากรณ์ปลายน้ำแตะเกณฑ์แต่ละขั้น (เฝ้าระวัง/เตรียมพร้อม/วิกฤต/อันตราย)
            ใช้ตอบคำถาม &ldquo;เหลือเวลาเตรียมตัวกี่ชั่วโมง&rdquo;
          </HintSection>
        </InfoHint>

        {etas.map((e) => (
          <span
            key={e.key}
            title={
              simTime >= e.etaHours
                ? `${stationCode} ถึงระดับ${e.label} (${e.level.toFixed(1)} m) แล้ว`
                : `คาด ${stationCode} ถึงระดับ${e.label} (${e.level.toFixed(1)} m) ในอีก ~${e.etaHours.toFixed(1)} ชม.`
            }
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-medium ${simTime >= e.etaHours ? '' : 'opacity-80'}`}
            style={{ color: ETA_COLORS[e.key], borderColor: `${ETA_COLORS[e.key]}55` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: ETA_COLORS[e.key] }} />
            {simTime >= e.etaHours
              ? `ถึง${e.label}แล้ว`
              : `${e.label} ~+${e.etaHours.toFixed(1)} ชม.`}
          </span>
        ))}
      </div>
    </div>
  )
}
