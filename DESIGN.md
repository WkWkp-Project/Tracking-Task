# PM Hub — DESIGN.md (ระบบดีไซน์ที่ต้องใช้ให้ตรงทุก surface)

Tailwind utility-based (ไม่มี tokens file แยก). ทุก view ต้องใช้ vocabulary เดียวกันนี้ — AE board ก็ต้องตาม

## Type
- Family: `Inter, system-ui, 'Segoe UI', 'Sarabun', sans-serif` (ตัวเดียว หลายน้ำหนัก)
- Scale: text-lg (หัวข้อ), text-sm (body/ปุ่ม), text-xs/[11px]/[10px] (label/chip) — fixed rem ไม่ fluid
- น้ำหนัก: `font-bold` สำหรับหัวข้อ/ปุ่ม/label

## Color
- bg หน้า: `#f3f4f6` (gray-100) · surface: `white` · panel/header: `gray-50`
- เส้น: `border-gray-200` (การ์ด), `divide-gray-100` (แถว)
- **accent: blue-600** (`#2563eb`) — ปุ่มหลัก/สถานะเลือก/ลิงก์เท่านั้น
- ตัวอักษร: `text-gray-900` (หลัก), `text-gray-500` (รอง), `text-gray-400` (จาง)
- Semantic (แยกจาก accent): red-100/700, amber-100/700, emerald-100/700, blue-50/600

## Components (ใช้ซ้ำ — ห้ามประดิษฐ์ใหม่)
- **การ์ด/ตาราง**: `bg-white border border-gray-200 rounded-xl overflow-hidden`
- **หัวตาราง**: `bg-gray-50 text-[11px] font-bold text-gray-500 uppercase border-b border-gray-200`, เซลล์ `py-3 px-5`
- **แถว**: `divide-y divide-gray-100 hover:bg-gray-50`
- **pill/chip**: `text-[10px] font-bold px-2 py-0.5 rounded` + คู่สี semantic (เช่น `bg-red-100 text-red-700`)
- **view switcher**: `bg-gray-100 rounded-lg p-0.5`; ปุ่ม `px-3 py-1.5 rounded-md text-xs font-bold`; active `bg-white shadow-sm text-blue-600`
- **ปุ่มหลัก**: `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold`
- **input/select**: `p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500`
- **Avatar**: คอมโพเนนต์ `components/ui.jsx` (สีต่อคน)
- ไอคอน: `lucide-react` ขนาด 14–18

## Motion
- 150–250ms, transition สื่อ state (hover/active/selected) เท่านั้น ไม่มี choreography

## AE board ต้องเป็น
ตาราง in-app (การ์ด+หัว+แถว ชุดเดียวกับ Timeline) · pill Priority/Status ใช้คู่สี semantic เดิม · In charge ใช้ Avatar · ปุ่ม/ฟอร์มชุดเดียวกัน · deadline coloring แบบ subtle (พื้น chip ไม่ใช่ทั้งเซลล์แดงจัด)
