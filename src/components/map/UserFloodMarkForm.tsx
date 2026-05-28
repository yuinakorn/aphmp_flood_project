'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { deriveFloodMarkLevel } from '@/lib/flood-marks'
import { AddressSelect } from '@/components/map/AddressSelect'
import type { UserFloodMark } from '@/types'

interface Props {
  draft: { lat: number; lng: number } | null
  onCancel: () => void
  onCreated: (mark: UserFloodMark) => void
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function UserFloodMarkForm({ draft, onCancel, onCreated }: Props) {
  const [waterLevel, setWaterLevel] = useState('')
  const [placeDetail, setPlaceDetail] = useState('')
  const [placeAround, setPlaceAround] = useState('')
  const [province, setProvince] = useState('')
  const [amphoe, setAmphoe] = useState('')
  const [tambon, setTambon] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [observedAt, setObservedAt] = useState(() => toLocalInputValue(new Date()))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = draft !== null
  const cm = Number(waterLevel)
  const levelPreview = Number.isFinite(cm) && waterLevel.trim() !== '' ? deriveFloodMarkLevel(cm) : null

  const reset = () => {
    setWaterLevel('')
    setPlaceDetail('')
    setPlaceAround('')
    setProvince('')
    setAmphoe('')
    setTambon('')
    setContactPhone('')
    setObservedAt(toLocalInputValue(new Date()))
    setError(null)
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleSubmit = async () => {
    if (!draft) return
    if (!Number.isFinite(cm) || cm < 0 || cm > 2000) {
      setError('ระดับน้ำต้องเป็นตัวเลข 0–2000 ซม.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/user-flood-marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: draft.lat,
          lng: draft.lng,
          waterLevelCm: cm,
          placeDetail: placeDetail || undefined,
          placeAround: placeAround || undefined,
          province: province || undefined,
          amphoe: amphoe || undefined,
          tambon: tambon || undefined,
          contactPhone: contactPhone || undefined,
          observedAt: observedAt ? new Date(observedAt).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? `บันทึกไม่สำเร็จ (${res.status})`)
        return
      }
      const { data } = (await res.json()) as { data: UserFloodMark }
      reset()
      onCreated(data)
    } catch {
      setError('เครือข่ายขัดข้อง ลองอีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleCancel() }}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-[var(--border)]">
          <SheetTitle>ปักหมุด Flood Mark</SheetTitle>
          <SheetDescription>
            {draft
              ? `พิกัด ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
              : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <Field label="ระดับน้ำ (ซม.)" required>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                value={waterLevel}
                onChange={(e) => setWaterLevel(e.target.value)}
                placeholder="เช่น 120"
                autoFocus
              />
              {levelPreview && (
                <span className="shrink-0 rounded-md bg-[var(--bg-sunken)] px-2 py-1 font-mono text-[11px] text-[var(--fg-muted)]">
                  ระดับ {levelPreview}
                </span>
              )}
            </div>
          </Field>

          <Field label="สถานที่ / รายละเอียด">
            <Input
              value={placeDetail}
              onChange={(e) => setPlaceDetail(e.target.value)}
              placeholder="เช่น หน้าวัด..., ถนน..."
            />
          </Field>

          <Field label="จุดสังเกตใกล้เคียง">
            <Input
              value={placeAround}
              onChange={(e) => setPlaceAround(e.target.value)}
              placeholder="เช่น ใกล้สะพาน, ตรงข้ามตลาด"
            />
          </Field>

          <AddressSelect
            key={draft ? `${draft.lat},${draft.lng}` : 'none'}
            onChange={(v) => {
              setProvince(v.province)
              setAmphoe(v.amphoe)
              setTambon(v.tambon)
            }}
          />

          <Field label="เบอร์ติดต่อผู้แจ้ง">
            <Input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="0xx-xxx-xxxx"
            />
          </Field>

          <Field label="วัน/เวลาที่วัด">
            <Input
              type="datetime-local"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
            />
          </Field>

          {error && (
            <p className="text-[12px] text-[var(--risk-flood,oklch(0.66_0.20_30))]">{error}</p>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-[var(--border)]">
          <Button type="button" variant="outline" className="flex-1" onClick={handleCancel} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="button" className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'กำลังบันทึก…' : 'บันทึกหมุด'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--fg-muted)]">
        {label}
        {required && <span className="text-[var(--accent)]"> *</span>}
      </span>
      {children}
    </label>
  )
}
