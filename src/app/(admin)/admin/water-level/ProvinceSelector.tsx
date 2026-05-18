'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { PROVINCE_CONFIGS, type ProvinceId } from '@/lib/water-level'

export function ProvinceSelector({ current }: { current: ProvinceId }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function select(province: ProvinceId) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('province', province)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex gap-1.5">
      {(Object.keys(PROVINCE_CONFIGS) as ProvinceId[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => select(id)}
          className={
            current === id
              ? 'rounded-md border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1.5 text-[12px] font-medium text-[var(--accent)]'
              : 'rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]'
          }
        >
          {PROVINCE_CONFIGS[id].label}
        </button>
      ))}
    </div>
  )
}
