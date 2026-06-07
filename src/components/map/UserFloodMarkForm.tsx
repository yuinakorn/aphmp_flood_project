'use client'

import { useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
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
import { useIsMobile } from '@/hooks/use-is-mobile'
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
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPickFile = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  const isMobile = useIsMobile()
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
    onPickFile(null)
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
      // อัปโหลดรูปก่อน (ถ้ามี) แล้วค่อยบันทึกหมุดพร้อม imageUrl
      let imageUrl: string | undefined
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const up = await fetch('/api/uploads', { method: 'POST', body: fd })
        if (!up.ok) {
          const b = await up.json().catch(() => null)
          setError(b?.error ?? `อัปโหลดรูปไม่สำเร็จ (${up.status})`)
          return
        }
        imageUrl = ((await up.json()) as { url: string }).url
      }

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
          imageUrl,
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
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(o, details) => {
        if (o) return
        // อย่าปิดฟอร์มเมื่อคลิก/ลากบนแผนที่ (ปรับตำแหน่งหมุด) — ปิดเฉพาะ Esc / ปุ่มปิด / ยกเลิก
        if (details?.reason === 'outside-press') return
        handleCancel()
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showOverlay={false}
        className={
          isMobile
            ? 'max-h-[72vh] gap-0 rounded-t-2xl'
            : 'w-full gap-0 sm:max-w-md'
        }
      >
        <SheetHeader className="border-b border-[var(--border)]">
          <SheetTitle>ปักหมุด Flood Mark</SheetTitle>
          <SheetDescription>
            {draft
              ? `พิกัด ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)} · ลากหมุดบนแผนที่เพื่อปรับ`
              : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
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

          <Field label="รูปถ่าย">
            {previewUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="ตัวอย่างรูป"
                  className="max-h-40 rounded-lg border border-[var(--border)] object-cover"
                />
                <button
                  type="button"
                  onClick={() => onPickFile(null)}
                  aria-label="ลบรูป"
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md bg-[var(--bg)]/80 text-[var(--fg-muted)] backdrop-blur transition-colors hover:text-[var(--fg)]"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]">
                    <Camera size={15} strokeWidth={1.75} />
                    ถ่ายรูป
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]">
                    <ImagePlus size={15} strokeWidth={1.75} />
                    เลือกรูป
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <span className="text-[10.5px] text-[var(--fg-subtle)]">JPEG/PNG/WebP ≤ 5MB</span>
              </div>
            )}
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
