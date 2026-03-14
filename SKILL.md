# counselor-rooms — Project Skill

## פרטי פרויקט
- **שם:** חדרי טיפולים
- **ריפו:** https://github.com/Gal9amar/counselor-rooms
- **Deploy:** Netlify (treatmentrooms.netlify.app)
- **DB:** Supabase (PostgreSQL)
- **גרסה נוכחית:** 1.4.0

---

## Stack

| שכבה | טכנולוגיה |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| Backend | Netlify Functions (Serverless) |
| ORM | Prisma 5 |
| DB | PostgreSQL via Supabase |
| Deploy | Netlify |
| פונט | Rubik (Google Fonts) |

---

## מבנה ריפו

```
counselor-rooms/
├── client/                        # React + Vite frontend
│   ├── public/
│   │   ├── manifest.json          # PWA manifest
│   │   ├── sw.js                  # Service Worker
│   │   ├── icon-192.png           # PWA icon
│   │   └── icon-512.png           # PWA icon
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx         # Nav (bottom mobile / top desktop) + footer
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx  # דשבורד עם כרטיסים + ציר זמן + מי בבניין
│   │   │   ├── SchedulePage.jsx   # לוח שיבוצים שנתי (wizard: חדר→תאריך→שעה)
│   │   │   ├── MySchedulePage.jsx # השיבוצים שלי (בחירת מטפל + רשימה)
│   │   │   └── AdminPage.jsx      # פאנל מנהל (חדרים, מטפלים, שיבוצים)
│   │   ├── services/
│   │   │   └── api.js             # כל קריאות ה-API עם axios
│   │   ├── index.css              # design system (classes: card, btn-primary, input, etc.)
│   │   └── main.jsx               # SW registration
├── netlify/
│   └── functions/
│       ├── rooms.js               # GET/POST/PATCH/DELETE /api/rooms
│       ├── therapists.js          # GET/POST/PATCH/DELETE /api/therapists
│       ├── schedule.js            # GET/POST/PATCH/DELETE /api/schedule
│       ├── admin.js               # POST /api/admin/verify
│       └── lib/
│           ├── prisma.js          # Prisma singleton
│           └── helpers.js         # ok/err/cors/checkAdmin
├── prisma/
│   ├── schema.prisma              # Room, Therapist, ScheduleSlot
│   └── seed.js                   # נתוני דוגמה
├── netlify.toml                   # Build config + redirects
├── package.json                   # Root (prisma generate postinstall)
├── setup.sh                       # One-time local setup script
└── .env.example
```

---

## DB Schema

```prisma
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
  date        DateTime // midnight UTC
  startHour   Int      // 8..21
  endHour     Int      // 9..22
  therapistId Int
  createdAt   DateTime @default(now())

  @@index([roomId, date])
  @@index([therapistId])
  @@index([date])
}
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
| GET | /api/schedule | שיבוצים (params: roomId, date, from, to) | ציבורי |
| POST | /api/schedule | הוסף שיבוץ + בדיקת חפיפה | ציבורי |
| PATCH | /api/schedule/:id | עריכת שיבוץ | מנהל |
| DELETE | /api/schedule/:id | מחק שיבוץ | מנהל |
| POST | /api/admin/verify | אימות סיסמת מנהל | — |

---

## עמודים

### דשבורד (`/`)
- תצוגת כרטיסים: חדר פעיל (ירוק) / פנוי + מטפל הבא היום
- תצוגת ציר זמן: Gantt עם שעות 8:00–21:00
  - **ציר: שמאל=21:00, ימין=8:00 (RTL)**
  - positioning: `right%` בתוך container RTL
- "בבניין עכשיו" — בנר ירוק עם מטפלים פעילים
- לחיצה על כרטיס → modal לוח חודשי של החדר
- רענון אוטומטי כל דקה

### לוח שיבוצים (`/schedule`)
- Wizard 3 שלבים: **חדר → תאריך → שעה**
- לוח שנתי עם סינון שנה/חודש + כפתור "הוסף שנה"
- בחירת שעת התחלה מ-8:00 עד 21:00
- dropdown שעת סיום (חוסם שעות תפוסות)
- בדיקת חפיפה בצד שרת
- שיבוץ נעול לאחר שמירה (רק מנהל יכול לפנות)

### השיבוצים שלי (`/my-schedule`)
- בחירת שם מטפל (נשמר ב-localStorage)
- סטטיסטיקות: שיבוצים קרובים + שעות קרובות
- פילטר **קרובים** = מהיום קדימה + שיבוצים של היום שטרם הסתיימו (לפי endHour)
- פילטר **הכל** = כולל עבר
- רשימה לפי תאריכים — כרטיס לכל יום עם badge "היום"

### מנהל (`/admin`)
- אימות סיסמה → sessionStorage
- לשונית **חדרים**: הוסף/ערוך/מחק
- לשונית **מטפלים**: הוסף/ערוך/מחק
- לשונית **שיבוצים**: רשימה לפי תאריך + עריכה inline (שעות + מטפל) + מחיקה

---

## Design System (index.css)

| Class | שימוש |
|---|---|
| `.card` | כרטיס לבן עם shadow עדין |
| `.card-clickable` | כרטיס עם hover lift |
| `.card-active` | כרטיס ירוק (חדר פעיל) |
| `.btn-primary` | כפתור ירוק עם glass effect |
| `.btn-secondary` | כפתור לבן עם border ירוק + glass |
| `.btn-ghost` | כפתור שקוף |
| `.input` | שדה קלט לבן עם focus ירוק |
| `.badge-active` | badge ירוק "פעיל" |
| `.badge-free` | badge אפור "פנוי" |
| `.nav-item` | פריט ניווט עם hover ירוק |
| `.section-title` | כותרת עמוד 1.5rem bold |
| `.fade-up` / `.fade-up-1/2/3` | אנימציית כניסה עם stagger |
| `.pulse-dot` | נקודה מהבהבת (פעיל עכשיו) |

**רקע:** `#f8faf8` עם tint ירוק עדין  
**Accent:** `#16a34a` (green-600)  
**פונט:** Rubik (Google Fonts)

---

## ניווט

- **דסקטופ:** top nav מרוכז
- **מובייל:** bottom nav קבוע עם אייקון + תווית מלאה
- שורת זכויות בתוך ה-bottom nav במובייל

---

## PWA
- `manifest.json` עם שם "חדרי טיפולים"
- Service Worker (network-first, API bypass)
- אייקון: בניין ירוק עם דלת 192×512
- תמיכה ב-iOS (apple-touch-icon, apple-mobile-web-app)

---

## Environment Variables (Netlify)

| Variable | תיאור |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler פורט 6543 + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Supabase Direct Connection פורט 5432 |
| `ADMIN_PASSWORD` | סיסמת פאנל מנהל |

---

## Changelog

### v1.4.0
- עמוד "השיבוצים שלי" + ניווט תחתון למובייל
- פילטר קרובים מתחשב בשעת סיום של היום
- שורת זכויות בתוך ה-bottom nav

### v1.3.0
- עיצוב מחדש: רקע לבן, גוונים ירוקים, כפתורי glass
- Rubik font, design system מלא ב-index.css
- PWA support (manifest + service worker + icons)
- bottom nav במובייל

### v1.2.0
- שיבוצים לפי תאריך ספציפי (במקום dayOfWeek)
- לוח שנתי מלא עם סינון שנה/חודש
- דשבורד: ציר זמן + מי בבניין + modal חודשי לכל חדר
- עריכת שיבוץ inline בפאנל מנהל

### v1.1.0
- migration מ-Render ל-Netlify Functions
- הסרת Shift model — רק ScheduleSlot
- עריכת שם חדר/מטפל inline

### v1.0.0
- הקמה ראשונית: Room, Therapist, ScheduleSlot
- wizard שיבוץ: חדר → תאריך → שעה
- פאנל מנהל עם סיסמה
