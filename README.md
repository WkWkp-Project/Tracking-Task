# Tracking Task — ระบบติดตามงานทีมครีเอทีฟ (Full-stack, ใช้งานได้จริง)

ระบบบริหาร/ติดตามงานสำหรับเอเจนซี่ที่ออกแบบรอบ **PM (คนดูโปรเจกต์)** + **Creative/Content (คนทำงาน)**
รองรับ: หลายโปรเจกต์ต่อคน, ดราฟหลายขั้น, ลงชั่วโมงจริง, **ตรวจงานชน + ประเมินความเสี่ยงเชิงสถิติ**,
แชตภายในแบบเรียลไทม์, แจ้งเตือน, เชื่อม **Google Calendar** และ **เขียน/ส่ง Gmail** เหมือนมี extension

> สแต็ก: **React + Vite + Tailwind** (client) · **Node + Express + Socket.io** (server) · เก็บข้อมูลเป็นไฟล์ JSON (ไม่ต้องลง DB engine)

---

## 1. รันโปรเจกต์ (ครั้งแรก)

```bash
# จากโฟลเดอร์ราก "Tracking Task"
npm run install:all     # ติดตั้ง dependency ของ root + server + client
npm run dev             # รัน backend (4000) + frontend (5173) พร้อมกัน
```

เปิดเบราว์เซอร์: **http://localhost:5173**

| Service | URL |
|---|---|
| Frontend (เปิดอันนี้) | http://localhost:5173 |
| Backend API | http://localhost:4000/api |

> ครั้งต่อไปแค่ `npm run dev` พอ

### บัญชีทดสอบ (seed อัตโนมัติ)
| Email | Password | บทบาท |
|---|---|---|
| admin@wkwkp.com | admin1234 | แอดมิน (เพิ่ม/ลบ user ได้) |
| jira.pm@wkwkp.com | password123 | Project Manager |
| art.a@wkwkp.com | password123 | Creative |
| content.b@wkwkp.com | password123 | Copywriter |
| video.c@wkwkp.com | password123 | Video Editor |

---

## 2. ตั้งค่า Google (Login / Gmail / Calendar)

ระบบ **รันได้ทันทีโดยไม่ต้องมี Google** — ปุ่ม/ฟีเจอร์ Google จะขึ้นว่า "ยังไม่ตั้งค่า" จนกว่าจะใส่ credential

เมื่อคุณสร้าง credential แล้ว ให้แก้ไฟล์ `server/.env`:

```env
GOOGLE_CLIENT_ID=<ของคุณ>
GOOGLE_CLIENT_SECRET=<ของคุณ>
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
ALLOWED_GOOGLE_DOMAIN=wkwkp.com     # จำกัดเฉพาะอีเมล @wkwkp.com (เว้นว่าง = ทุกโดเมน)
```

### ขั้นตอนใน Google Cloud Console
1. สร้าง Project → เปิดใช้ API: **Gmail API**, **Google Calendar API**
2. **OAuth consent screen**: เลือก Internal (ถ้าใช้ Workspace wkwkp.com) → เพิ่ม scope:
   `gmail.send`, `calendar.events`, `userinfo.email`, `userinfo.profile`
3. **Credentials → Create OAuth client ID → Web application**
   - Authorized redirect URI: `http://localhost:4000/api/auth/google/callback` (ต้องตรงเป๊ะ)
4. เอา Client ID / Secret มาใส่ `.env` → restart `npm run dev`

จากนั้นปุ่ม **"เข้าสู่ระบบด้วย Google"** จะใช้งานได้, แท็บ **อีเมลลูกค้า** จะส่งผ่าน Gmail ของผู้ใช้จริง,
และปุ่ม **Sync Calendar** จะสร้าง event ใน Google Calendar ของผู้ใช้

> ผู้ใช้แต่ละคนต้อง login ด้วย Google อย่างน้อยครั้งหนึ่งเพื่อผูกบัญชี (เก็บ refresh token) ก่อนส่งเมล/ลงปฏิทินได้

---

## 3. ฟีเจอร์ & ตรรกะที่ทำให้ "ใช้งานได้จริง"

### 3.1 Double Ownership
ทุกงานมี **PM (ผู้ดู)** และ **Assignee (ผู้ทำงาน)** แยกกัน — PM รับการแจ้งเตือนความเสี่ยง, Assignee รับงาน/อัปเดตสถานะ

### 3.2 Risk & Conflict Engine (หัวใจของระบบ) — `server/src/services/riskEngine.js`
รวม 4 เทคนิคเข้าด้วยกัน:

| เทคนิค | ทำอะไร |
|---|---|
| **Capacity / Utilization** | แต่ละคนมี ชม./วัน จำกัด → กระจายชั่วโมงงานที่เหลือลงวันทำงาน → ถ้าโหลด > capacity = **งานชน** |
| **PERT (3-point)** | ประเมินเวลาแบบไม่แน่นอน: `E=(O+4M+P)/6`, `σ=(P−O)/6` (งานครีเอทีฟ tail บานปลาย) |
| **ความน่าจะเป็นเสร็จทัน** | มองช่องว่าง (capacity ว่าง − งานที่ต้องใช้) เป็น Normal → `P(เสร็จทัน)=Φ(z)` |
| **Actuarial expected-loss** | `ความเสี่ยง = P(เกินกำหนด) × severity` (งานยิ่ง client-facing/ใกล้เดดไลน์/ใหญ่ → severity สูง) |

**สำคัญ:** capacity เป็นทรัพยากรร่วม → ถ้าเพิ่มงานเร่งให้คนหนึ่ง งานอื่นของคนเดียวกัน "โอกาสเสร็จทัน" จะลดลงตามจริง
(เพราะคนหนึ่งถือหลายงาน/หลายโปรเจกต์) ระบบจะ **แจ้ง PM อัตโนมัติ** พร้อมคำแนะนำเชิงตัวเลข เช่น
*"เลื่อน deadline +3 วัน หรือย้าย 23.9 ชม. ให้คนอื่น"* และ *"กันบัฟเฟอร์ 27.8 ชม. เพื่อมั่นใจ 85%"*

ดูสด ๆ ได้ในหน้าสร้างงาน (panel ขวา) ก่อนกดสร้าง — เปลี่ยนคน/วันที่/ชั่วโมงแล้ววิเคราะห์ทันที

### 3.3 ดราฟหลายขั้น + ลงชั่วโมงจริง
แต่ละงานมีดราฟ (Draft 1 / Draft 2 / Final / เพิ่มเองได้) แต่ละขั้นมี ชม.ประมาณการ + ลงชั่วโมงจริง + แนบไฟล์งาน + สถานะ
`estimatedHours`/`loggedHours` ของงานคำนวณรวมจากดราฟอัตโนมัติ — ลงชั่วโมงเกินจะเตือน PM

### 3.4 แชตภายใน (เรียลไทม์) — Socket.io
แชตตัวต่อตัวระหว่างสมาชิก, สถานะออนไลน์, แจ้งเตือนเมื่อผู้รับออฟไลน์ (ปุ่ม "แชตทีม" หรือลิงก์ "แชต" ในการ์ดงาน)

### 3.5 แจ้งเตือน
งานชน/เสี่ยงสูง, ได้รับงานใหม่, สถานะเปลี่ยน, ชั่วโมงเกิน, ข้อความใหม่ — เด้งเรียลไทม์ที่กระดิ่งมุมขวาบน

### 3.6 จัดการผู้ใช้ (แอดมิน)
- เพิ่ม user ด้วย **อีเมล + รหัสผ่าน** เอง (ไม่ต้องพึ่ง Google) หรือเว้นรหัสไว้ให้ login ผ่าน Google เท่านั้น
- ตั้งบทบาท + **ชม.ทำงาน/วัน** (ใช้คำนวณ capacity), reset รหัสผ่าน, ปิด/ลบ user

---

## 4. โครงสร้างโปรเจกต์

```
PM Hub/
├── package.json            # สคริปต์รวม (dev / install:all)
├── server/                 # Backend (Express + Socket.io)
│   ├── .env                # ← ใส่ Google credential ที่นี่
│   ├── data/db.json        # ฐานข้อมูล (สร้างอัตโนมัติ)
│   └── src/
│       ├── index.js        # entry + รวม routes
│       ├── config.js  db.js  seed.js  realtime.js
│       ├── auth/           # jwt.js, google.js
│       ├── services/       # riskEngine, gmail, calendar, notify, users, chat
│       └── routes/         # auth, users, projects, tasks, chat, notifications, google
└── client/                 # Frontend (React + Vite + Tailwind)
    └── src/
        ├── api/client.js   # ตัวเรียก API
        ├── socket.js  utils.js
        ├── context/AuthContext.jsx
        ├── pages/          # Login, AuthCallback, Dashboard
        └── components/     # NotificationBell, ChatPanel, TeamModal, NewTaskModal, TaskDrawer, ui
```

---

## 5. หมายเหตุ
- ข้อมูลเก็บใน `server/data/db.json` (ลบไฟล์นี้ = รีเซ็ตเป็นข้อมูล seed ใหม่)
- รหัสผ่าน hash ด้วย bcrypt, auth ใช้ JWT (อายุ 30 วัน) เก็บใน localStorage
- พอร์ต backend อ่านจาก `server/.env` (`PORT=4000`) — ไม่สนค่า PORT ที่ parent process ส่งมา
- UI ปรับแต่งเพิ่มได้ทีหลัง — โครงสร้าง/ฟีเจอร์ทุกส่วนทำงานครบแล้ว
```
