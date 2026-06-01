'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Waves, ArrowLeft, Loader2, ShieldCheck, IdCard, Clock, Ban, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveCidAction } from './actions'

interface LoginClientProps {
  ssoEnabled: boolean
}

type Notice = { kind: 'error' | 'info'; text: string } | null

const DEMO_HINTS = [
  { cid: '1101700234568', label: 'EOC · เชียงราย' },
  { cid: '3570100987656', label: 'เจ้าหน้าที่ · เชียงราย' },
  { cid: '1550100234562', label: 'EOC · เชียงใหม่' },
  { cid: '1655200345670', label: 'EOC · น่าน' },
  { cid: '1123400567890', label: 'รออนุมัติ (เชียงราย)' },
  { cid: '5901100112238', label: 'ถูกระงับ (เชียงใหม่)' },
]

export function LoginClient({ ssoEnabled }: LoginClientProps) {
  const router = useRouter()
  const [cid, setCid] = useState('')
  const [thaidLoading, setThaidLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [error, setError] = useState('')
  const [ssoLoading, setSsoLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)

  const onThaiDLogin = async () => {
    const raw = cid.replace(/\D/g, '')
    setNotice(null)
    setError('')
    setThaidLoading(true)
    try {
      const res = await resolveCidAction(raw)
      switch (res.state) {
        case 'invalid':
          setNotice({ kind: 'error', text: 'เลขบัตรประชาชนไม่ถูกต้อง — ต้องครบ 13 หลัก' })
          break
        case 'not_found':
          router.push(`/register?cid=${raw}`)
          return
        case 'pending':
          setNotice({ kind: 'info', text: 'บัญชีของคุณกำลังรอผู้ดูแลระบบอนุมัติ' })
          break
        case 'suspended':
          setNotice({ kind: 'error', text: 'บัญชีนี้ถูกระงับสิทธิ์ — ติดต่อผู้ดูแลระบบ' })
          break
        case 'active': {
          const signRes = await signIn('thaid-sim', { cid: raw, redirect: false })
          if (signRes?.error) setNotice({ kind: 'error', text: 'เข้าสู่ระบบไม่สำเร็จ' })
          else {
            await fetch('/api/incident-scope', { method: 'DELETE' }) // เริ่มใหม่ → บังคับเลือก scope
            router.push('/admin')
          }
          return
        }
      }
    } catch {
      setNotice({ kind: 'error', text: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' })
    } finally {
      setThaidLoading(false)
    }
  }

  const onSsoLogin = async () => {
    setSsoLoading(true)
    await signIn('provider-id-sso', { callbackUrl: '/admin' })
    setSsoLoading(false)
  }

  const onDevLogin = async () => {
    setDevLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email: 'admin@floodwatch.th',
      password: 'admin1234',
      redirect: false,
    })
    setDevLoading(false)
    if (res?.error) setError('Dev login ไม่สำเร็จ')
    else {
      await fetch('/api/incident-scope', { method: 'DELETE' })
      router.push('/admin')
    }
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
            <span>ThaiD</span>
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
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight">เข้าสู่ระบบเจ้าหน้าที่</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            ยืนยันตัวตนด้วย ThaiD ด้วยเลขประจำตัวประชาชน
          </p>

          {/* ThaiD (จำลอง) */}
          <div className="mt-6">
            <label htmlFor="cid" className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              เลขประจำตัวประชาชน
            </label>
            <input
              id="cid"
              inputMode="numeric"
              autoComplete="off"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !thaidLoading) onThaiDLogin() }}
              placeholder="x-xxxx-xxxxx-xx-x"
              maxLength={17}
              className="mt-1.5 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 font-mono text-[14px] tracking-wide text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
            />
          </div>

          <Button
            type="button"
            onClick={onThaiDLogin}
            disabled={thaidLoading}
            className="mt-3 h-10 w-full bg-[var(--accent)] px-4 text-[13px] text-[var(--accent-fg)] hover:opacity-90"
          >
            {thaidLoading ? <Loader2 size={15} className="animate-spin" /> : <IdCard size={15} strokeWidth={1.9} />}
            {thaidLoading ? 'กำลังยืนยันตัวตน' : 'ยืนยันตัวตนด้วย ThaiD (จำลอง)'}
          </Button>

          {notice && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px] leading-relaxed"
              style={
                notice.kind === 'error'
                  ? { borderColor: 'var(--risk-flood)', background: 'color-mix(in oklch, var(--risk-flood) 10%, transparent)', color: 'var(--risk-flood)' }
                  : { borderColor: 'var(--risk-near)', background: 'color-mix(in oklch, var(--risk-near) 10%, transparent)', color: 'var(--risk-near)' }
              }
            >
              {notice.kind === 'error' ? <Ban size={14} className="mt-px shrink-0" /> : <Clock size={14} className="mt-px shrink-0" />}
              {notice.text}
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
            <AlertCircle size={13} strokeWidth={1.75} className="text-[var(--fg-subtle)]" />
            ยังไม่มีสิทธิ์? กรอก CID แล้วระบบจะพาไป
            <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">ลงทะเบียน</Link>
          </p>

          {/* hint: บัญชีทดสอบ */}
          <details className="mt-5 rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-[var(--fg-subtle)]">บัญชีทดสอบ (simulation)</summary>
            <div className="mt-2 flex flex-col gap-1">
              {DEMO_HINTS.map((h) => (
                <button
                  key={h.cid}
                  type="button"
                  onClick={() => setCid(h.cid)}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11.5px] hover:bg-[var(--bg-elevated)]"
                >
                  <span className="font-mono text-[var(--fg-muted)]">{h.cid}</span>
                  <span className="text-[var(--fg-subtle)]">{h.label}</span>
                </button>
              ))}
            </div>
          </details>

          {/* ทางเข้าสำรอง (SSO / dev) */}
          {(ssoEnabled || process.env.NODE_ENV !== 'production') && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">ทางเข้าสำรอง</span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              {ssoEnabled && (
                <Button
                  type="button"
                  onClick={onSsoLogin}
                  disabled={ssoLoading}
                  className="h-10 w-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  {ssoLoading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} strokeWidth={1.9} />}
                  Provider ID SSO
                </Button>
              )}

              <button
                type="button"
                onClick={onDevLogin}
                disabled={devLoading}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[11.5px] text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
              >
                {devLoading && <Loader2 size={13} className="animate-spin" />}
                Dev login (admin@floodwatch.th)
              </button>
            </>
          )}

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
