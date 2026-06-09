import { redirect } from 'next/navigation'

// รายการสถานพยาบาลย้ายไปเป็นแท็บในหน้าตั้งค่าแล้ว (หน้ารายละเอียดยังอยู่ที่ /admin/infra/[id])
export default function InfraPage() {
  redirect('/admin/settings/facilities')
}
