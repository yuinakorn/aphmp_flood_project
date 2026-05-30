'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Waves, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoginClientProps {
  ssoEnabled: boolean
}

export function LoginClient({ ssoEnabled }: LoginClientProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [ssoLoading, setSsoLoading] = useState(false)
  const [simulationLoading, setSimulationLoading] = useState(false)

  const onSsoLogin = async () => {
    setSsoLoading(true)
    setError('')
    await signIn('provider-id-sso', { callbackUrl: '/admin' })
    setSsoLoading(false)
  }

  const onSimulationLogin = async () => {
    setSimulationLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email: 'admin@floodwatch.th',
      password: 'admin1234',
      redirect: false,
    })
    setSimulationLoading(false)
    if (res?.error) setError('Simulation login ไม่สำเร็จ')
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
                GIS Health Intelligence
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                แพลตฟอร์มข้อมูลสุขภาพเชิงพื้นที่
              </span>
            </div>
          </div>

          <div className="max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--accent)]">
              โมดูลปัจจุบัน · เฝ้าระวังน้ำท่วม
            </p>
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
              ข้อมูลเชิงพื้นที่
              <br />
              เพื่อดูแลกลุ่มเปราะบาง
            </h1>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[var(--fg-muted)]">
              แพลตฟอร์มข่าวกรองสุขภาพเชิงพื้นที่ เริ่มจากการเฝ้าระวังและช่วยเหลือ
              กลุ่มเปราะบางก่อน-ระหว่าง-หลังน้ำท่วม พร้อมขยายสู่ภารกิจสุขภาพอื่นในอนาคต
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
            GIS Health Intelligence
          </p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            แพลตฟอร์มข้อมูลสุขภาพเชิงพื้นที่ • โมดูลเฝ้าระวังน้ำท่วม
          </p>

          {ssoEnabled ? (
            <Button
              type="button"
              onClick={onSsoLogin}
              disabled={ssoLoading}
              className="mt-6 h-10 w-full bg-[var(--accent)] px-4 text-[13px] text-[var(--accent-fg)] hover:opacity-90"
            >
              {ssoLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} strokeWidth={1.9} />
              )}
              {ssoLoading ? 'กำลังเชื่อมต่อ SSO' : 'เข้าสู่ระบบด้วย Provider ID SSO'}
            </Button>
          ) : (
            <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--fg-muted)]">
              ยังไม่ได้ตั้งค่า Provider ID SSO ใน environment
              ใช้ Simulation login สำหรับเข้าทดสอบระบบใน local development
            </div>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
              Simulation
            </span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <Button
            type="button"
            onClick={onSimulationLogin}
            disabled={simulationLoading || ssoLoading}
            className="h-10 w-full bg-[var(--risk-safe)] px-4 text-[13px] text-[var(--accent-fg)] hover:opacity-90"
          >
            {simulationLoading && <Loader2 size={15} className="animate-spin" />}
            {simulationLoading ? 'กำลังเข้าสู่ระบบ Simulation' : 'Simulation login'}
          </Button>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-[var(--risk-flood)] bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-3 py-2 text-[12px] text-[var(--risk-flood)]"
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
