import type { FloodStats, VulnerableStats } from '@/types'

interface Props {
  flood: FloodStats
  vulnerable: VulnerableStats
  lastPass?: string
  fresh?: boolean
}

interface FieldProps {
  label: string
  value: string | number
  delta?: string
  tone?: 'default' | 'flood' | 'near' | 'safe' | 'data'
}

const toneColor: Record<NonNullable<FieldProps['tone']>, string> = {
  default: 'var(--fg)',
  flood: 'var(--risk-flood)',
  near: 'var(--risk-near)',
  safe: 'var(--risk-safe)',
  data: 'var(--signal-data)',
}

function Field({ label, value, delta, tone = 'default' }: FieldProps) {
  return (
    <div className="flex min-w-[112px] flex-col justify-center gap-1.5">
      <span className="text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-[var(--fg-subtle)]">
        {label}
      </span>
      <div className="flex items-baseline gap-2.5 leading-none">
        <span
          className="font-mono text-[22px] font-semibold tabular-nums"
          style={{ color: toneColor[tone] }}
        >
          {value}
        </span>
        {delta && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--fg-muted)]">
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}

const Divider = () => (
  <span aria-hidden className="h-10 w-px self-center bg-[var(--border)]" />
)

export function StatusStrip({ flood, vulnerable, lastPass, fresh }: Props) {
  return (
    <div className="flex h-[76px] shrink-0 items-stretch gap-10 border-b border-[var(--border)] bg-[var(--bg)] px-8">
      <Field
        label="จุดน้ำท่วม"
        value={flood.total.toLocaleString('en-US')}
        delta={`${flood.areaSqKm} ตร.กม.`}
        tone="data"
      />
      <Divider />
      <Field
        label="ในเขตน้ำท่วม"
        value={vulnerable.flood}
        delta={vulnerable.flood > 0 ? 'ต้องอพยพ' : '—'}
        tone={vulnerable.flood > 0 ? 'flood' : 'default'}
      />
      <Divider />
      <Field
        label="ใกล้เขต"
        value={vulnerable.near}
        delta="< 2 กม."
        tone={vulnerable.near > 0 ? 'near' : 'default'}
      />
      <Divider />
      <Field
        label="ปลอดภัย"
        value={vulnerable.safe}
        delta={`จาก ${vulnerable.total}`}
        tone="safe"
      />

      <div className="ml-auto flex items-center gap-3.5 self-center pl-6">
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          SAR ล่าสุด
        </span>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-1.5 rounded-full bg-[var(--signal-data)] ${
              fresh ? 'pulse-live' : 'opacity-40'
            }`}
          />
          <span className="font-mono text-[12px] tabular-nums text-[var(--fg-muted)]">
            {lastPass ?? '2024-09-15 06:12 UTC'}
          </span>
        </div>
      </div>
    </div>
  )
}
