'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Opt {
  id: number
  nameTh: string
  zipCode?: number | null
}

export interface AddressValue {
  province: string
  amphoe: string
  tambon: string
  zipCode?: number | null
}

interface Props {
  onChange: (value: AddressValue) => void
}

function Select({
  label,
  value,
  disabled,
  placeholder,
  options,
  onSelect,
}: {
  label: string
  value: number | ''
  disabled?: boolean
  placeholder: string
  options: Opt[]
  onSelect: (id: number | '') => void
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--fg-muted)]">{label}</span>
      <div className="relative flex items-center">
        <select
          value={value === '' ? '' : String(value)}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value === '' ? '' : Number(e.target.value))}
          className="h-8 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] pl-2.5 pr-7 text-[13px] text-[var(--fg)] outline-none transition-colors hover:border-[var(--border-strong)] focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.nameTh}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2 text-[var(--fg-subtle)]"
        />
      </div>
    </label>
  )
}

export function AddressSelect({ onChange }: Props) {
  const [provinces, setProvinces] = useState<Opt[]>([])
  const [districts, setDistricts] = useState<Opt[]>([])
  const [subdistricts, setSubdistricts] = useState<Opt[]>([])
  const [provinceId, setProvinceId] = useState<number | ''>('')
  const [districtId, setDistrictId] = useState<number | ''>('')
  const [subdistrictId, setSubdistrictId] = useState<number | ''>('')

  useEffect(() => {
    fetch('/api/geo/provinces', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProvinces(d))
      .catch(() => {})
  }, [])

  const nameOf = (list: Opt[], id: number | '') =>
    id === '' ? '' : (list.find((o) => o.id === id)?.nameTh ?? '')

  function selectProvince(id: number | '') {
    setProvinceId(id)
    setDistrictId('')
    setSubdistrictId('')
    setDistricts([])
    setSubdistricts([])
    onChange({ province: nameOf(provinces, id), amphoe: '', tambon: '', zipCode: null })
    if (id !== '') {
      fetch(`/api/geo/districts?provinceId=${id}`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setDistricts(d))
        .catch(() => {})
    }
  }

  function selectDistrict(id: number | '') {
    setDistrictId(id)
    setSubdistrictId('')
    setSubdistricts([])
    onChange({
      province: nameOf(provinces, provinceId),
      amphoe: nameOf(districts, id),
      tambon: '',
      zipCode: null,
    })
    if (id !== '') {
      fetch(`/api/geo/subdistricts?districtId=${id}`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setSubdistricts(d))
        .catch(() => {})
    }
  }

  function selectSubdistrict(id: number | '') {
    setSubdistrictId(id)
    const sd = id === '' ? undefined : subdistricts.find((s) => s.id === id)
    onChange({
      province: nameOf(provinces, provinceId),
      amphoe: nameOf(districts, districtId),
      tambon: sd?.nameTh ?? '',
      zipCode: sd?.zipCode ?? null,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="จังหวัด"
        value={provinceId}
        placeholder="เลือกจังหวัด"
        options={provinces}
        onSelect={selectProvince}
      />
      <Select
        label="อำเภอ / เขต"
        value={districtId}
        disabled={provinceId === ''}
        placeholder={provinceId === '' ? 'เลือกจังหวัดก่อน' : 'เลือกอำเภอ'}
        options={districts}
        onSelect={selectDistrict}
      />
      <Select
        label="ตำบล / แขวง"
        value={subdistrictId}
        disabled={districtId === ''}
        placeholder={districtId === '' ? 'เลือกอำเภอก่อน' : 'เลือกตำบล'}
        options={subdistricts}
        onSelect={selectSubdistrict}
      />
    </div>
  )
}
