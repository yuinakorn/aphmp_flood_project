import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FolderHeart } from 'lucide-react'
import { FamilyFolderClient } from './FamilyFolderClient'
import { getFamilyFolderSummary, getFamilyFolderHouseholds } from '@/lib/family-folder'

export const metadata = { title: 'Family Folder กลุ่มเปราะบาง — FloodWatch Admin' }

export default async function FamilyFolderPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [summary, { households, total }] = await Promise.all([
    getFamilyFolderSummary(),
    getFamilyFolderHouseholds(200),
  ])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            JHCIS · Family Folder
          </p>
          <h1 className="mt-2 flex items-center gap-2.5 text-[22px] font-semibold tracking-tight">
            <FolderHeart size={20} strokeWidth={1.75} className="text-[var(--accent)]" />
            ครอบครัวกลุ่มเปราะบาง
          </h1>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
            บ้านที่มีสมาชิกกลุ่มเปราะบาง · ดึงข้อมูลจาก JHCIS แบบ real-time
          </p>
        </div>
      </div>

      <div className="mt-6">
        <FamilyFolderClient
          summary={summary}
          initialHouseholds={households}
          total={total}
        />
      </div>
    </div>
  )
}
