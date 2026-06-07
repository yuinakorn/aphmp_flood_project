'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ProvinceFilter({ provinces, current }: { provinces: string[]; current: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function select(province: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (province) {
      params.set('province', province)
    } else {
      params.delete('province')
    }
    router.push(`?${params.toString()}`)
  }

  const active = 'rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1 text-xs font-medium text-[var(--accent)]'
  const inactive = 'rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:border-[var(--fg-muted)] hover:text-[var(--fg)]'

  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => select(null)} className={current === null ? active : inactive}>
        ทั้งหมด
      </button>
      {provinces.map((p) => (
        <button key={p} type="button" onClick={() => select(p)} className={current === p ? active : inactive}>
          {p}
        </button>
      ))}
    </div>
  )
}
