'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { AddVulnerableSheet, type AddVulnerableArea } from '@/components/forms/AddVulnerableSheet'

interface Props {
  area: AddVulnerableArea
  province: string | null
  isNational: boolean
  provinceOptions: string[]
  defaultCenter: { lat: number; lng: number }
  incidentName: string | null
}

export function AddVulnerableButton(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="gx-btn gx-btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={2} />
        เพิ่มรายการ
      </button>
      {open && (
        <AddVulnerableSheet
          open
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); router.refresh() }}
          {...props}
        />
      )}
    </>
  )
}
