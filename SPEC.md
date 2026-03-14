# חדרי טיפולים — אפיון ותיעוד מלא

> גרסה: **1.4.0** | ריפו: `Gal9amar/counselor-rooms` | Deploy: Netlify

---

## תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [Stack טכנולוגי](#stack-טכנולוגי)
3. [מבנה ריפו](#מבנה-ריפו)
4. [DB Schema](#db-schema)
5. [API Endpoints](#api-endpoints)
6. [עמודים](#עמודים)
7. [Design System](#design-system)
8. [ניווט](#ניווט)
9. [PWA](#pwa)
10. [משתני סביבה](#משתני-סביבה)
11. [הגדרת סביבה מקומית](#הגדרת-סביבה-מקומית)
12. [Deploy](#deploy)
13. [Changelog](#changelog)

---

## סקירה כללית

דשבורד לניהול שיבוצי מטפלים בחדרי טיפול. המערכת מאפשרת:
- **שיבוץ עצמי** — מטפל בוחר חדר, תאריך ושעות בעצמו
- **דשבורד בזמן אמת** — מי נמצא עכשיו, מה הסטטוס של כל חדר
- **לוח שנתי** — תצוגת שנה מלאה עם סינון חודש/שנה
- **פאנל מנהל** — ניהול חדרים, מטפלים ועריכת שיבוצים
- **PWA** — ניתן להתקין כאפליקציה על מובייל ודסקטופ

---

## Stack טכנולוגי

| שכבה | טכנולוגיה |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| Backend | Netlify Functions (Serverless) |
| ORM | Prisma 5 |
| DB | PostgreSQL via Supabase |
| Deploy | Netlify |
| פונט | Rubik (Google Fonts) |
| אייקונים | Lucide React |

---

## מבנה ריפו

```
counselor-rooms/
├── client/
│   ├── public/
│   │   ├── manifest.json          # PWA manifest — שם: "חדרי טיפולים"
│   │   ├── sw.js                  # Service Worker (network-first, API bypass)
│   │   ├── icon-192.png           # PWA icon — בניין ירוק עם דלת
│   │   └── icon-512.png
│   └── src/
│       ├── components/
│       │   └── Layout.jsx         # ניווט עליון (desktop) + תחתון (mobile) + footer
│       ├── pages/
│       │   ├── DashboardPage.jsx  # דשבורד: כרטיסים + ציר זמן + מי בבניין
│       │   ├── SchedulePage.jsx   # לוח שיבוצים שנתי (wizard)
│       │   ├── MySchedulePage.jsx # השיבוצים שלי
│       │   └── AdminPage.jsx      # פאנל מנהל
│       ├── services/api.js        # כל קריאות ה-API (axios)
│       ├── index.css              # Design system
│       └── main.jsx               # SW registration
├── netlify/
│   └── functions/
│       ├── rooms.js               # CRUD חדרים
│       ├── therapists.js          # CRUD מטפלים
│       ├── schedule.js            # CRUD שיבוצים + בדיקת חפיפה
│       ├── admin.js               # אימות סיסמה
│       └── lib/
│           ├── prisma.js          # Singleton client
│           └── helpers.js         # ok/err/cors/checkAdmin
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── netlify.toml                   # Build + redirects
├── package.json                   # Root — prisma generate postinstall
├── setup.sh                       # סקריפט הגדרה מקומי
└── .env.example
```

---

## DB Schema

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Room {
  id            Int            @id @default(autoincrement())
  name          String         @unique
  createdAt     DateTime       @default(now())
  scheduleSlots ScheduleSlot[]
}

model Therapist {
  id            Int            @id @default(autoincrement())
  name          String         @unique
  createdAt     DateTime       @default(now())
  scheduleSlots ScheduleSlot[]
}

model ScheduleSlot {
  id          Int      @id @default(autoincrement())
  roomId      Int
  date        DateTime // midnight UTC — toDateStr → new Date(Date.UTC(y,m,d))
  startHour   Int      // 8..21
  endHour     Int      // 9..22
  therapistId Int
  createdAt   DateTime @default(now())
  room        Room      @relation(fields: [roomId], references: [id])
  therapist   Therapist @relation(fields: [therapistId], references: [id])

  @@index([roomId, date])
  @@index([therapistId])
  @@index([date])
}
```

### SQL ליצירת טבלאות (Supabase SQL Editor)
```sql
CREATE TABLE "Room" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

CREATE TABLE "Therapist" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Therapist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Therapist_name_key" ON "Therapist"("name");

CREATE TABLE "ScheduleSlot" (
  "id" SERIAL NOT NULL,
  "roomId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startHour" INTEGER NOT NULL,
  "endHour" INTEGER NOT NULL,
  "therapistId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduleSlot_roomId_date_idx" ON "ScheduleSlot"("roomId", "date");
CREATE INDEX "ScheduleSlot_therapistId_idx" ON "ScheduleSlot"("therapistId");
CREATE INDEX "ScheduleSlot_date_idx" ON "ScheduleSlot"("date");

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_therapistId_fkey"
  FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## API Endpoints

| Method | Path | תיאור | Auth |
|---|---|---|---|
| GET | /api/rooms | רשימת חדרים | ציבורי |
| POST | /api/rooms | הוסף חדר | מנהל |
| PATCH | /api/rooms/:id | שנה שם חדר | מנהל |
| DELETE | /api/rooms/:id | מחק חדר | מנהל |
| GET | /api/therapists | רשימת מטפלים | ציבורי |
| POST | /api/therapists | הוסף מטפל | מנהל |
| PATCH | /api/therapists/:id | שנה שם מטפל | מנהל |
| DELETE | /api/therapists/:id | מחק מטפל | מנהל |
| GET | /api/schedule?roomId&date&from&to | שיבוצים | ציבורי |
| POST | /api/schedule | הוסף שיבוץ + בדיקת חפיפה | ציבורי |
| PATCH | /api/schedule/:id | ערוך שיבוץ | מנהל |
| DELETE | /api/schedule/:id | מחק שיבוץ | מנהל |
| POST | /api/admin/verify | אימות סיסמה | — |

### Auth מנהל
- Header: `x-admin-password: <password>`
- מול `process.env.ADMIN_PASSWORD`
- נשמר ב-`sessionStorage` בצד לקוח

---

## עמודים

### דשבורד (`/`)
- **כרטיסים:** חדר פעיל (ירוק + שם מטפל + שעות) / פנוי + מטפל הבא היום
- **ציר זמן:** Gantt עם שעות 8:00–21:00
  - ⚠️ RTL: positioning ב-`right%` — `right:0%` = שעה 8 (ליד שם חדר), `right:100%` = שעה 21
  - קו אדום = שעה נוכחית
- **"בבניין עכשיו":** בנר ירוק עם רשימת מטפלים פעילים
- **לחיצה על כרטיס:** modal לוח חודשי של החדר עם ניווט חודשים
- רענון אוטומטי כל דקה

### לוח שיבוצים (`/schedule`)
- Wizard 3 שלבים: **חדר → תאריך → שעה**
- לוח שנה: 12 חודשים, סינון שנה/חודש, כפתור "הוסף שנה"
- slots: 8:00–21:00 (כל שעה עגולה)
- dropdown שעת סיום: חוסם שעות תפוסות אוטומטית
- בדיקת חפיפה בצד שרת (409 Conflict)
- שיבוץ קיים = נעול (רק מנהל מפנה)

### השיבוצים שלי (`/my-schedule`)
- בחירת שם מטפל — נשמר ב-`localStorage`
- סטטיסטיקות: שיבוצים קרובים + שעות קרובות
- פילטר **קרובים:** מהיום קדימה + שיבוצי היום שטרם הסתיימו (`endHour > currentHour`)
- פילטר **הכל:** כולל עבר (טעינה מ-2020)
- רשימה לפי תאריכים — badge "היום" בירוק

### מנהל (`/admin`)
- אימות סיסמה → `sessionStorage`
- **חדרים:** הוסף / עריכה inline / מחק
- **מטפלים:** הוסף / עריכה inline / מחק
- **שיבוצים:** רשימה לפי תאריך, עריכה inline (שעות + מטפל), מחיקה

---

## Design System

קובץ: `client/src/index.css`

| Class | תיאור |
|---|---|
| `.card` | כרטיס לבן, shadow עדין, border ירוק-בהיר |
| `.card-clickable` | hover: lift + border ירוק |
| `.card-active` | רקע ירוק בהיר, border ירוק |
| `.btn-primary` | gradient ירוק + glass effect + shadow |
| `.btn-secondary` | לבן + border ירוק + glass |
| `.btn-ghost` | שקוף, hover ירוק עדין |
| `.input` | לבן, border אפור, focus: border ירוק + glow |
| `.badge-active` | ירוק "פעיל" |
| `.badge-free` | אפור "פנוי" |
| `.nav-item` | ניווט עם hover ירוק, active: bg ירוק |
| `.section-title` | כותרת 1.5rem bold |
| `.fade-up` / `fade-up-1/2/3` | animation stagger |
| `.pulse-dot` | נקודה מהבהבת |

**רקע:** `#f8faf8` + tint ירוק radial  
**Accent:** `#16a34a`  
**פונט:** Rubik

---

## ניווט

| מצב | סוג | פרטים |
|---|---|---|
| דסקטופ | Top nav מרוכז | אייקון + תווית מלאה |
| מובייל | Bottom nav קבוע | אייקון + תווית + שורת זכויות |

פריטים: דשבורד · לוח שיבוצים · השיבוצים שלי · מנהל

---

## PWA

- **שם:** חדרי טיפולים
- **Theme color:** `#16a34a`
- **Service Worker:** network-first, מעקף לנתיבי `/api/` ו-`/.netlify/`
- **iOS:** `apple-touch-icon`, `apple-mobile-web-app-capable`
- **התקנה:** Chrome/Edge — אייקון בסרגל כתובות | iOS Safari — שיתוף → הוסף למסך הבית

---

## משתני סביבה

| Variable | תיאור |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler פורט **6543** + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Supabase Direct Connection פורט **5432** |
| `ADMIN_PASSWORD` | סיסמת פאנל מנהל |

---

## הגדרת סביבה מקומית

```bash
git clone https://github.com/Gal9amar/counselor-rooms
cd counselor-rooms
chmod +x setup.sh
./setup.sh
# ← ימלא .env, יריץ migrate ו-seed
netlify dev   # פורט 8888
```

דרישות: Node 18+, Netlify CLI (`npm i -g netlify-cli`)

---

## Deploy

### Netlify
1. חבר ריפו ב-app.netlify.com
2. הגדר env vars (DATABASE_URL, DIRECT_URL, ADMIN_PASSWORD)
3. `netlify.toml` מזוהה אוטומטית

### Supabase
- Transaction Pooler פורט 6543 → `DATABASE_URL`
- Direct Connection פורט 5432 → `DIRECT_URL`
- הרץ SQL ליצירת טבלאות (ראה למעלה)

---

## Changelog

### v1.4.0
- עמוד "השיבוצים שלי" — בחירת מטפל + רשימה לפי תאריכים
- bottom nav במובייל עם תוויות מלאות + שורת זכויות
- פילטר "קרובים" מתחשב בשעת סיום של היום

### v1.3.0
- עיצוב מחדש: רקע לבן, גוונים ירוקים, כפתורי glass
- Rubik font + design system מלא
- PWA support (manifest + service worker + icons)

### v1.2.0
- שיבוצים לפי תאריך ספציפי (החלפת dayOfWeek)
- לוח שנה מלא עם סינון שנה/חודש + "הוסף שנה"
- דשבורד: ציר זמן Gantt + "בבניין עכשיו" + modal חודשי
- עריכת שיבוץ inline בפאנל מנהל

### v1.1.0
- Migration מ-Render ל-Netlify Functions
- הסרת Shift model — רק ScheduleSlot
- עריכת שם חדר/מטפל inline

### v1.0.0
- הקמה ראשונית: Room, Therapist, ScheduleSlot
- Wizard שיבוץ: חדר → תאריך → שעה
- פאנל מנהל עם סיסמה
