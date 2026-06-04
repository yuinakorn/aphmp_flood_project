import { redirect } from 'next/navigation'

// หน้า "ภาพรวมสถานการณ์" ถูกรวมเข้า "ศูนย์บัญชาการ EOC" แล้ว (คิวสั่งการ + funnel + บริบทพื้นที่)
// คง route ไว้เพื่อ redirect ลิงก์/บุ๊กมาร์กเดิม
export default function OverviewPage() {
  redirect('/admin/eoc')
}
