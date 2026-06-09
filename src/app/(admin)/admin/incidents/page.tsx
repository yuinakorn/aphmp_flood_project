import { redirect } from 'next/navigation'

// ย้ายไปเป็นแท็บในหน้าตั้งค่าแล้ว
export default function IncidentsPage() {
  redirect('/admin/settings/incidents')
}
