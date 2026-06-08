import type { Metadata } from 'next'
import { ReportForm } from './ReportForm'

export const metadata: Metadata = {
  title: 'แจ้งขอความช่วยเหลือ น้ำท่วม',
  description: 'แจ้งขอความช่วยเหลือสำหรับประชาชนที่ประสบภัยน้ำท่วม เจ้าหน้าที่จะติดต่อกลับโดยเร็ว',
}

export default function ReportPage() {
  return (
    <main className="min-h-dvh bg-slate-50">
      <ReportForm />
    </main>
  )
}
