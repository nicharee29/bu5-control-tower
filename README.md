# BU5 Control Tower

ระบบติดตามงานขนส่ง BU5 — EV Logistics

## ไฟล์ในระบบ

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้าเว็บ 6 หน้า |
| `styles.css` | สไตล์ทั้งหมด รองรับธีมสว่าง/มืด |
| `app.js` | ตรรกะทั้งหมด เชื่อมต่อ Google Sheet |

## แหล่งข้อมูล

อ่าน-เขียนผ่าน Google Apps Script Web App ที่ผูกกับ Google Sheet
ชีทที่ใช้: `Roster` (ตารางกะ), `Tracking`, `Billing`, `Uploads`, `Audit_Log`

## 6 หน้าใช้งาน

1. ภาพรวมวันนี้ — สรุปสถานะทั้งระบบ
2. อัปโหลดคำสั่งงาน (CS)
3. สรุปปริมาณงาน (Planner)
4. ติดตามสถานะพจส.รายคน — กรองตามกะ เช้า/บ่าย/ดึก
5. ติดตามงาน (CC)
6. ติดตามเอกสารวางบิล

## การ deploy

ผูกกับ Vercel ผ่าน GitHub — push ขึ้น branch `main` แล้ว Vercel จะ deploy ให้อัตโนมัติ

## ข้อควรระวัง

**repo นี้ต้องเป็น private เท่านั้น** เพราะ `app.js` มี URL ของ Apps Script
ที่เปิดสิทธิ์ "Anyone" ใครได้ URL นั้นไปจะดึงชื่อและเบอร์โทรพนักงานได้
