'use client'

import { useState } from 'react'
import { Ambulance, Sailboat, Footprints, Loader2 } from 'lucide-react'
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
import { useIsMobile } from '@/hooks/use-is-mobile'

interface Props {
  draft: { lat: number; lng: number } | null
  onCancel: () => void
  onCreated: () => void
}

const MODES: { key: string; label: string; icon: typeof Ambulance }[] = [
  { key: 'vehicle', label: 'รถ (พยาบาล/ยนต์)', icon: Ambulance },
  { key: 'boat', label: 'เรือ', icon: Sailboat },
  { key: 'foot', label: 'เดินเท้า', icon: Footprints },
]

export function EvacPointForm({ draft, onCancel, onCreated }: Props) {
  const isMobile = useIsMobile()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [modes, setModes] = useState<Set<string>>(new Set(['vehicle']))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (k: string) =>
    setModes((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  async function submit() {
    if (!draft || !name.trim() || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/infra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'evacuation_point',
          name: name.trim(),
          lat: draft.lat,
          lng: draft.lng,
          accessModes: [...modes],
          contact: contact.trim() || null,
        }),
      })
      if (!res.ok) {
        setErr((await res.json().catch(() => ({})))?.error ?? 'บันทึกไม่สำเร็จ')
        setBusy(false)
        return
      }
      setName(''); setContact(''); setModes(new Set(['vehicle']))
      setBusy(false)
      onCreated()
    } catch {
      setErr('เครือข่ายขัดข้อง ลองใหม่')
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!draft} onOpenChange={(o) => { if (!o) onCancel() }}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>เพิ่มจุดรับ-ส่งอพยพ</SheetTitle>
          <SheetDescription>
            จุดที่รถพยาบาล/เรือกู้ชีพเข้าถึงเพื่อรับ-ส่งผู้อพยพ — แสดงบนแผนที่ให้ทีมและประชาชนเห็น
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-[var(--fg-muted)]">ชื่อจุด *</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ท่าน้ำวัดบ่อสวก / ปากทางเข้า บ.ดอน" />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-[var(--fg-muted)]">เข้าถึงโดย</span>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => {
                const Icon = m.icon
                const on = modes.has(m.key)
                return (
                  <button key={m.key} type="button" onClick={() => toggle(m.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                      on
                        ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--fg)]'
                        : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]'
                    }`}>
                    <Icon className="size-4" /> {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-[var(--fg-muted)]">เบอร์ผู้ประสานงาน (ไม่บังคับ)</span>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} inputMode="tel" placeholder="08x-xxx-xxxx" />
          </label>

          {draft && (
            <p className="font-mono text-[11px] text-[var(--fg-subtle)]">
              พิกัด: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>
          )}
          {err && <p className="text-[12px] text-[var(--risk-flood)]">{err}</p>}
        </div>

        <SheetFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>ยกเลิก</Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} บันทึกจุด
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
