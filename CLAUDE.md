# CLAUDE.md – אפיון פרויקט Counselor Rooms

## מה הפרויקט

**ניהול חדרי טיפול** – דשבורד real-time לניהול נוכחות מטפלים בחדרי טיפול.
לקוח: **מרכז אופק חוף אשקלון**
ממשק בעברית/RTL | גרסה: 1.4.0

**פיצ'רים מרכזיים:**
- תצוגה real-time של חדרים (ירוק = פנוי, אדום = תפוס)
- תזמון עצמי של מטפלים לחדרים
- לוח שנה שנתי עם ניווט חודש/שנה
- פאנל ניהול מלא (סיסמה)
- PWA – ניתן להתקנה במובייל ודסקטופ
- מעקב היסטוריית פעילות

**URL:** https://treatmentrooms.netlify.app
**Repo:** Gal9amar/counselor-rooms

---

## מבנה קבצים

```
counselor-rooms/
├── package.json                    ← root: postinstall prisma generate
├── netlify.toml                    ← build config + API redirects
├── .env.example                    ← תבנית משתני סביבה
├── prisma/
│   ├── schema.prisma               ← PostgreSQL schema (Supabase)
│   └── seed.js                     ← 5 חדרים + 4 מטפלים לדוגמה
├── netlify/
│   └── functions/                  ← Serverless functions (esbuild)
│       ├── rooms.js                ← GET/POST/PATCH/DELETE חדרים
│       ├── therapists.js           ← GET/POST/PATCH/DELETE מטפלים
│       ├── schedule.js             ← GET/POST/PATCH/DELETE slots
│       ├── recurring.js            ← ניהול תזמון חוזר
│       ├── admin.js                ← POST verify admin password
│       └── lib/
│           ├── prisma.js           ← Prisma singleton
│           └── helpers.js          ← CORS, auth, response helpers
└── client/                         ← React 18 + Vite
    ├── index.html
    ├── vite.config.js              ← proxy /api → localhost:8888
    ├── tailwind.config.js
    ├── public/
    │   ├── manifest.json           ← PWA (עברית, RTL, theme ירוק)
    │   ├── sw.js                   ← Service Worker (network-first)
    │   ├── logo-left.png           ← לוגו חוף אשקלון
    │   └── logo-right.png          ← לוגו מרכז אופק
    └── src/
        ├── main.jsx                ← entry + SW registration
        ├── App.jsx                 ← router + LoadingContext
        ├── index.css               ← Tailwind + Rubik font + design system
        ├── components/
        │   └── Layout.jsx          ← ניווט (דסקטופ: top bar | מובייל: bottom bar)
        ├── pages/
        │   ├── DashboardPage.jsx   ← כרטיסי חדרים real-time + modal לוח שנה
        │   ├── SchedulePage.jsx    ← אשף תזמון שנתי
        │   ├── MySchedulePage.jsx  ← לוח אישי למטפל
        │   └── AdminPage.jsx       ← פאנל ניהול (סיסמה)
        └── services/
            └── api.js              ← Axios client + global loading state
```

---

## פריסה (Deploy)

- **Netlify** – פריסה ישירה מ-GitHub
- Push ל-main → Netlify מתעדכן אוטומטית
- **Database:** PostgreSQL דרך Supabase

### Build (netlify.toml)
```bash
cd client && npm install && npm run build
# Publish: client/dist
# Functions: netlify/functions (esbuild)
# Node.js: v18
```

### פיתוח מקומי
```bash
cp .env.example .env         # הגדר DATABASE_URL, DIRECT_URL, ADMIN_PASSWORD
npm install                  # root + prisma generate
cd client && npm install && cd ..
npx prisma migrate dev       # יצירת טבלאות
netlify dev                  # פורט 8888 – server + client
```

### מיגרציות
```bash
npx prisma migrate deploy    # production (uses DIRECT_URL)
npx prisma migrate dev       # development
npx prisma db seed           # 5 חדרים + 4 מטפלים
```

---

## Tech Stack

| Layer | טכנולוגיה |
|-------|-----------|
| Frontend | React 18.3.1, Vite 5.4.3, Tailwind CSS 3.4.11, React Router v6 |
| Backend | Netlify Functions (Node.js, Serverless) |
| ORM | Prisma 5.19.0 |
| Database | PostgreSQL (Supabase) |
| HTTP Client | Axios 1.7.7 |
| Icons | Lucide React |
| Font | Rubik (Google Fonts) – Hebrew-optimized |
| PWA | Service Worker + Web App Manifest |

---

## Database – Prisma Schema

### חיבורים
- `DATABASE_URL` – Transaction Pooler פורט **6543** (Supabase) – runtime
- `DIRECT_URL` – Direct Connection פורט **5432** – migrations בלבד

### מודלים

**Room**
```prisma
id: Int @id
name: String @unique
scheduleSlots: ScheduleSlot[]
```

**Therapist**
```prisma
id: Int @id
name: String @unique
scheduleSlots: ScheduleSlot[]
```

**ScheduleSlot**
```prisma
id, roomId, date (midnight UTC), startHour (8..21), endHour (9..22)
therapistId, note?, recurringId?
@@index([roomId, date]), @@index([therapistId]), @@index([date])
```

**RecurringSchedule**
```prisma
frequency: "daily" | "weekly" | "monthly" | "yearly"
daysOfWeek: Int[]   // 0=ראשון ... 5=שישי
startDate, endDate?, occurrences?
```

### הערות חשובות
- תאריכים נשמרים כ-**midnight UTC**
- שעות כ-**integers** 8–21 (startHour), 9–22 (endHour)
- מחיקת Recurring Slot: תמיד לציין `scope` = `single` / `all` / `future`

---

## משתני סביבה

```env
# Supabase – Transaction Pooler (runtime)
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase – Direct Connection (migrations)
DIRECT_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Admin panel
ADMIN_PASSWORD="your-admin-password"
```

---

## API Endpoints

כל ה-endpoints דרך `/api/` (redirect → `/.netlify/functions/`)

| Method | Path | Auth | תיאור |
|--------|------|------|-------|
| GET | `/rooms` | Public | רשימת חדרים |
| POST | `/rooms` | Admin | יצירת חדר |
| PATCH | `/rooms/:id` | Admin | עדכון שם |
| DELETE | `/rooms/:id` | Admin | מחיקה (cascade slots) |
| GET | `/therapists` | Public | רשימת מטפלים |
| POST | `/therapists` | Admin | יצירת מטפל |
| PATCH | `/therapists/:id` | Admin | עדכון שם |
| DELETE | `/therapists/:id` | Admin | מחיקה |
| GET | `/schedule` | Public | slots (filters: `?roomId=`, `?date=`, `?from=`, `?to=`) |
| POST | `/schedule` | Public | הזמנת slot |
| PATCH | `/schedule/:id` | Admin | עדכון slot |
| DELETE | `/schedule/:id?scope=` | Admin | מחיקה (single/all/future) |
| POST | `/recurring` | Public | יצירת תזמון חוזר |
| PATCH | `/recurring/:id` | Admin | עדכון תזמון |
| POST | `/admin/verify` | — | אימות סיסמת admin |

**Admin Auth:** Header `x-admin-password: [ADMIN_PASSWORD]`

---

## עיצוב ו-UX

- **ירוק** `#16a34a` – צבע brand, חדר פנוי
- **אדום** `#f87171` – חדר תפוס/פעיל
- **Rubik** – גופן (Hebrew-optimized)
- RTL בכל הממשק
- Responsive: דסקטופ (top nav) + מובייל (bottom nav)
- PWA: `name: "ניהול חדרי טיפול מרכז אופק"` | `lang: "he"` | `dir: "rtl"`

---

## כללים חשובים

1. **Supabase dual connection** – `DATABASE_URL` (pooler) ≠ `DIRECT_URL` (direct) – אל תבלבל
2. **Netlify Functions** – כל שינוי backend = deploy ל-Netlify (אין server עצמאי)
3. **Admin auth** = header בלבד, אין JWT/OAuth
4. **Overlap detection** – לבדוק חפיפת שעות לפני יצירת slot
5. תמיד לבדוק RTL + מובייל אחרי שינויי CSS
6. **esbuild bundler** ל-functions – external: `@prisma/client`, `prisma`
7. Push ל-main → Netlify deploy אוטומטי
