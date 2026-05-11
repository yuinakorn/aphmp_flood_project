import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Masthead } from '@/components/shell/Masthead'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
      <Masthead
        session={{
          role: session.user?.role ?? 'viewer',
          name: session.user?.name ?? '',
        }}
      />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  )
}
