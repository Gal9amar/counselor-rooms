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

**URL:** https://ofek1.netlify.app
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
│       ├── settings.js             ← GET/PUT הגדרות (מייל התראות) + POST test-email, Admin בלבד
│       ├── room-notes.js           ← GET/POST/DELETE הערות לחדרים (RoomNote)
│       ├── bootstrap.js            ← GET טעינה ראשונית מאוחדת (rooms+therapists+roomNotes+slots)
│       └── lib/
│           ├── prisma.js           ← Prisma singleton
│           ├── helpers.js          ← CORS, auth, response helpers, publicCache
│           └── sql.js              ← שאילתות raw SQL מאוחדות (JSON shapes, slotFilters, פרמטרים מאוגדים)
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
        │   ├── AdminPage.jsx       ← פאנל ניהול (סיסמה)
        │   └── NewBookingPage.jsx  ← /new-booking – בקשת שיבוץ למטפלים (ללא Layout, URL ישיר)
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
npx prisma migrate dev       # development
npx prisma db seed           # 5 חדרים + 4 מטפלים
```
**Production:** ב-DB של הפרודקשן אין טבלת `_prisma_migrations`, ולכן `prisma migrate deploy` אינו בשימוש. מיגרציות מוחלות ידנית (Supabase SQL editor / `apply_migration`).

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

**BookingRequest**
```prisma
id, therapistName, roomId, date, startHour, endHour, note?
status: "pending" | "queued" | "approved" | "rejected"   // String רגיל, בלי שינוי סכמה; 'queued' = בתור (ראו "תור בקשות")
bookingType: "single" | "recurring" | "scatter"
recurFrequency?: "daily" | "weekly" | "monthly"
recurDays: Int[]   // ימי שבוע לשבועי
recurEndDate?, recurOccurrences?
```
אישור recurring → יוצר RecurringSchedule + slots (כמו /api/recurring POST)

**RoomNote**
```prisma
id: Int @id
roomId: Int → Room (cascade delete)
message: String
startDate: DateTime (midnight UTC)
endDate: DateTime (midnight UTC)
startHour: Int?
endHour: Int?
```

**AppSetting** (הגדרות מערכת, key/value)
```prisma
key: String @id      // כרגע: "bookingNotifyEmail"
value: String
updatedAt: DateTime
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
| GET | `/bootstrap?from=&to=` | Public | קריאה אחת ל-SQL אחד: `{rooms, therapists, roomNotes, slots}` (כל חלק באותה צורה כמו ה-GET שלו; `from`/`to` בלבד, 400 על תאריך לא תקין; בלי קשר ל-`/booking-requests`; ללא מטמון CDN) |
| GET | `/schedule` | Public | slots (filters: `?roomId=`, `?date=`, `?from=`, `?to=`) |
| POST | `/schedule` | Admin | יצירת slot ישירה |
| PATCH | `/schedule/:id` | Admin | עדכון slot |
| DELETE | `/schedule/:id?scope=` | Admin | מחיקה (single/all/future) |
| GET | `/booking-requests?status=&countOnly=1` | Admin | רשימת בקשות; `countOnly=1` מחזיר `{count}` בלבד (לתג בניווט); `status` = pending/queued/approved/rejected; `no-store` |
| POST | `/recurring` | Admin | יצירת תזמון חוזר |
| PATCH | `/recurring/:id` | Admin | עדכון תזמון |
| POST | `/admin/verify` | — | אימות סיסמת admin |
| GET | `/room-notes?roomId=` | Public | הערות לחדר |
| POST | `/room-notes` | Admin | יצירת הערה לחדר |
| DELETE | `/room-notes/:id` | Admin | מחיקת הערה |
| GET | `/settings` | Admin | `{notifyEmail, envFallback}` (`no-store`; `notifyEmail` ריק אם לא הוגדר; `envFallback` = קיים `BOOKING_NOTIFY_EMAIL`, הערך לא נחשף) |
| PUT | `/settings` | Admin | body `{notifyEmail}`; ריק = מחיקת ההגדרה (חוזרים ל-env); אחרת כתובת אחת תקינה (400 אם לא). מחזיר את צורת ה-GET |
| POST | `/settings/test-email` | Admin | שולח מייל בדיקה לנמען האפקטיבי -> `{sent:true}`; 400 אין נמען, 429 תוך 30 שניות מבדיקה קודמת, 502 כשל Resend |

**Admin Auth:** Header `x-admin-password: [ADMIN_PASSWORD]`. גם `POST /admin/verify` משתמש ב-`checkAdmin` (timing-safe, מחרוזת בלבד, 401 כשאין `ADMIN_PASSWORD` ב-env, 400 'בקשה לא תקינה' על JSON שבור; הצלחה = `{success:true}`).

**התנהגות שגיאות (כל ה-functions):** שגיאה לא צפויה = 500 'אירעה תקלה בשרת. נסו שוב בעוד רגע' (`handleError` ב-`lib/helpers.js`; ללוג נכתב רק `e.code`/`e.name`, אף פעם לא `e.message`); Prisma `P2002` = 400 ידידותי (חדר/מטפל קיימים), `P2025` = 404 'הפריט לא נמצא', `P2003` = 400, JSON שבור = 400 'בקשה לא תקינה'. ולידציה: מזהים שלמים 1..2147483647, שעות שלמות 8..22 (schedule/recurring POST/PATCH; שדות לא תקינים = 400 'שדות לא תקינים'); `GET /room-notes?roomId=` לא תקין = 400. פורמט ה-409 (conflicts / pendingConflict / טקסט החפיפה) לא השתנה.

**Headers:** `netlify.toml` מוסיף ל-`/*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` (בלבד). CSP מלא = משימת המשך (עלול לשבור פונטים/סקריפטים). `publicCache` משתמש ב-`Netlify-Vary: header=x-admin-password,query`; `GET /booking-requests` מחזיר `Cache-Control: no-store`.

### תור בקשות (`booking-requests.js`)
- סטטוסים: `pending` (גלוי לאדמין, שולח מייל), `queued` (נשמר וממתין), `approved`, `rejected`. תג הבקשות באדמין סופר רק `pending` (`?status=pending&countOnly=1`); `?status=queued` ו-`countOnly=1` עובדים לכל סטטוס.
- `PENDING_CAP = 10`, `QUEUE_CAP = 200`. ב-`POST` נוצרת השורה, ובאותו `Promise.all` רץ `groupBy status` על pending+queued (רק שורות עם `createdAt` קטן משל הבקשה החדשה, ולכן הספירה לא תלויה בתזמון). אם pending >= 10: השורה מתעדכנת ל-`queued`, בלי מייל. אם גם queued >= 200: השורה נמחקת ו-429 `{error:'יש כרגע עומס רב בבקשות. נסו שוב מאוחר יותר.'}`.
- תגובת ה-POST (201) היא הבקשה שנוצרה כולל `status` סופי (`pending` או `queued`). תפזורת: כל שורה לפי אותו כלל; המייל המסכם נשלח רק אם השורה האחרונה `pending`.
- קידום: אחרי PATCH `approved`/`rejected` או DELETE של בקשה `pending`, שאילתה אחת (CTE עם `FOR UPDATE SKIP LOCKED`) מקדמת את ה-`queued` הוותיקים ביותר (`ORDER BY createdAt, id`) כל עוד pending < 10, ונשלח מייל רגיל לכל בקשה שקודמה. כשל בקידום או במייל רק נרשם ללוג (קוד שגיאה) ולא מכשיל את ה-PATCH/DELETE; התגובות לא השתנו.

**כלל עסקי:** יצירת שיבוץ ישירה = מנהל בלבד; משתמשים רגילים שולחים בקשת שיבוץ (`POST /booking-requests`, ציבורי).

### מייל על בקשת שיבוץ חדשה
- כל `POST /booking-requests` שולח מייל מעוצב (RTL) דרך Resend (`netlify/functions/lib/email.js`, fetch ישיר ל-API, בלי SDK) אל הכתובת שמוגדרת בפאנל הניהול (טבלת `AppSetting`, מפתח `bookingNotifyEmail`, נקרא באותו `Promise.all` של יצירת הבקשה; כשל בקריאה לא מכשיל את הבקשה). `BOOKING_NOTIFY_EMAIL` הוא ה-fallback כשאין הגדרה (לא כתובת בקוד כי הריפו ציבורי). בלי שניהם המייל מדולג ונרשם בלוג.
- תפזורת = כמה בקשות; הלקוח שולח `scatterAll` (רשימת כל התאריכים) רק עם האחרונה, ולכן יוצא מייל אחד מסכם.
- כישלון במייל נרשם ללוג ולא מכשיל את הבקשה. ללא `RESEND_API_KEY` המייל מדולג.
- משתנים (גם ב-Netlify!): `RESEND_API_KEY` חובה, `BOOKING_NOTIFY_EMAIL` מומלץ כ-fallback; אופציונלי `RESEND_FROM`, `SITE_URL`.
- **שולח:** הדומיין `hamanulan.com` מאומת ב-Resend (נבדק 2026-11-11), והשולח ברירת המחדל הוא `requests@hamanulan.com`. ב-Netlify חובה להגדיר לפחות `RESEND_API_KEY`. (בלי דומיין מאומת Resend שולח רק לבעל החשבון.)

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
8. **עיצוב** – בכל בקשת עיצוב/UI/UX (שינוי מראה, קומפוננטות, CSS, פריסה) חובה להשתמש בסקיל `impeccable` (`/impeccable`)
9. **SQL** – כל שאילתה חדשה/ששונתה, אינדקס, סכמה או migration עוברים אישור של הסוכן `sql-expert` לפני push
10. **Push** – בסיום כל משימה: `qa-verifier` מאשר, ואז commit + push ישירות ל-`main` (בלי branches/PR); לפני push תמיד `git diff --stat` (קובץ מרוקן = עצור)

---

## צוות סוכנים (`.claude/agents/`)

**כלל קבוע (הוראת הבעלים):** בכל בקשת פיתוח חייבים להשתמש בסוכנים הרלוונטיים (לא לעבוד לבד): `rooms-manager` מנתב, מומחה התחום מממש, ושערי האיכות `sql-expert` (כל נגיעה ב-DB), `security-privacy` (endpoints/auth/חשיפת מידע/מיילים), `qa-verifier` (תמיד, לפני כל push) מאשרים לפני push.

הסוכנים שמורים ב-git ולכן זמינים בכל clone. לשימוש מכל תיקייה במחשב: `powershell -File scripts/install-agents.ps1` (מעתיק ל-`~/.claude/agents`). נקודת כניסה: `rooms-manager`.

| סוכן | תחום |
|------|------|
| `rooms-manager` | מנהל: מנתב, אוכף שערי איכות, דוחף ל-main |
| `scheduling-domain` | חוקי שיבוץ: slots, recurring, בקשות, חגים, חפיפות, תאריכים/שעות |
| `api-functions` | Netlify Functions, redirects, ולידציה, חוזה API |
| `sql-expert` | **שער חובה** – יעילות ונכונות כל שאילתה, אינדקסים, טרנזקציות, migrations |
| `frontend-ux` | React/Tailwind/RTL/מובייל/עברית (חובה `/impeccable`) |
| `pwa-cache` | service worker, manifest, גרסאות ישנות אצל משתמשים |
| `qa-verifier` | **שער חובה** – אימות לפני כל push (אין בדיקות אוטומטיות) |
| `security-privacy` | סקירת אבטחה ופרטיות (קריאה בלבד): endpoints ציבוריים, סיסמת admin, סודות |

סוכני `impeccable-*` הם עוזרי העיצוב של הסקיל ונשארים כמות שהם.
