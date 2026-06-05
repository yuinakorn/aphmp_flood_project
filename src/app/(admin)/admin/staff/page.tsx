import { redirect } from 'next/navigation'

// ย้ายไปอยู่ในเมนู "ตั้งค่า" แล้ว — แท็บ "จัดการเจ้าหน้าที่"
export default function StaffPage() {
  redirect('/admin/settings')
}
