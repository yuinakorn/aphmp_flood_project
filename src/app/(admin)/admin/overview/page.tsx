import { auth } from '@/lib/auth'
import { getOverviewData } from '@/lib/overview'
import { OverviewView } from './OverviewView'

export const metadata = { title: 'ภาพรวมสถานการณ์ — ศูนย์บัญชาการ EOC' }

export default async function OverviewPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'viewer'
  const data = await getOverviewData(role, session?.user?.province ?? null)
  return <OverviewView data={data} />
}
