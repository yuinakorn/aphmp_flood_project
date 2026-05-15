'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Waves, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'

interface LoginClientProps {
  ssoEnabled: boolean
}

export function LoginClient({ ssoEnabled }: LoginClientProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)

  const onSsoLogin = async () => {
    setSsoLoading(true)
    setError('')
    await signIn('provider-id-sso', { callbackUrl: '/admin' })
    setSsoLoading(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    else router.push('/admin')
  }

  return (
    <div className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-[1fr_460px]">
      <div className="relative hidden overflow-hidden border-r border-[var(--border)] lg:block">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 25% 30%, oklch(0.68 0.15 230 / 0.18), transparent 60%),
              radial-gradient(circle at 70% 75%, oklch(0.66 0.20 30 / 0.10), transparent 55%)
            `,
          }}
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Waves size={22} strokeWidth={1.5} className="text-[var(--accent)]" />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold tracking-tight">
                PH Flood Aid
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                Public Health Flood Operations
              </span>
            </div>
          </div>

          <div className="max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--accent)]">
              Public Health Flood Operations (PHFO)
            </p>
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
              ติดตามสถานการณ์น้ำ
              <br />
              น้ำท่วมช่วยทัน กลุ่มเปราะบาง
            </h1>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[var(--fg-muted)]">
              ระบบสาธารณสุขเพื่อการติดตามและช่วยเหลือกลุ่มเปราะบาง
              <br />
              ก่อน-ระหว่าง-หลังน้ำท่วม
            </p>
          </div>

          <div className="flex items-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
            <span>Provider ID SSO</span>
            <span className="text-[var(--border-strong)]">·</span>
            <span>PDPA Audit</span>
            <span className="text-[var(--border-strong)]">·</span>
            <span>GISTDA</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link
            href="/map"
            className="mb-8 inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
          >
            <ArrowLeft size={13} strokeWidth={1.75} />
            กลับไปดูแผนที่
          </Link>

          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            PH Flood Aid
          </p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            ติดตามสถานการณ์น้ำ • น้ำท่วมช่วยทัน กลุ่มเสี่ยง
          </p>

          {ssoEnabled ? (
            <button
              type="button"
              onClick={onSsoLogin}
              disabled={ssoLoading}
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {ssoLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} strokeWidth={1.9} />
              )}
              {ssoLoading ? 'กำลังเชื่อมต่อ SSO' : 'เข้าสู่ระบบด้วย Provider ID SSO'}
            </button>
          ) : (
            <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--fg-muted)]">
              ยังไม่ได้ตั้งค่า Provider ID SSO ใน environment
              ระบบจึงแสดงเฉพาะ demo credentials สำหรับ local development
            </div>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
              Dev fallback
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
                อีเมล
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="officer@floodwatch.th"
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
                รหัสผ่าน
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-3 py-2 text-[12px] text-[var(--risk-flood)]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 text-[13px] font-medium text-[var(--fg)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบแบบ Demo'}
            </button>
          </form>

          <div className="mt-8 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Demo credentials
            </p>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--fg-muted)]">
              <span className="text-[var(--accent)]">admin</span>
              <span>admin@floodwatch.th / admin1234</span>
              <span className="text-[var(--accent)]">officer</span>
              <span>officer@floodwatch.th / officer1234</span>
              <span className="text-[var(--accent)]">viewer</span>
              <span>viewer@floodwatch.th / viewer1234</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
