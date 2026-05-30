import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FolderHeart } from 'lucide-react'
import { FamilyFolderClient } from './FamilyFolderClient'
import { getFamilyFolderSummary, getFamilyFolderHouseholds } from '@/lib/family-folder'

export const metadata = { title: 'Family Folder กลุ่มเปราะบาง — GIS Health Intelligence' }

export default async function FamilyFolderPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [summary, { households, total }] = await Promise.all([
    getFamilyFolderSummary(),
    getFamilyFolderHouseholds(200),
  ])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">Family Folder</p>
          <h1 className="gx-title mt-1.5 flex items-center gap-2.5">
            <FolderHeart size={26} strokeWidth={1.75} className="text-[var(--cat-folder)]" />
            ครอบครัวกลุ่มเปราะบาง
          </h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            บ้านที่มีสมาชิกกลุ่มเปราะบาง · สมาชิก + ความสัมพันธ์ในครัวเรือน
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
