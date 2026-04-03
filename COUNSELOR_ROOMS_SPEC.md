# דשבורד חדרי טיפול - תוכנית יישום

## הקשר
בניית פרויקט חדש במאגר `counselor-rooms` ב-GitHub (ריק כרגע).
המשתמש מנהל חדרי טיפול וצריך דשבורד לניהול נוכחות מטפלים בחדרים, עם פונקציונליות תחילת/סיום משמרת ומעקב היסטוריה.

נשתמש באותה **ערימת טכנולוגיות** של פרויקט `car-service-tracker` הקיים (React + Vite + Node.js + Express + Prisma + PostgreSQL).

## סיכום דרישות
- **דשבורד** (ציבורי): תצוגה ויזואלית של כל החדרים עם המטפל הנוכחי הפעיל
- **זרימת מטפל**: בחירת שם מרשימה ← בחירת חדר ← התחלת משמרת ← הופעה כפעיל ← סיום משמרת ← רישום בהיסטוריה
- **עמוד היסטוריה**: היסטוריית משמרות לפי מטפל וסה"כ (תאריך, שעת כניסה, שעת יציאה, מספר חדר)
- **פאנל מנהל**: מוגן בסיסמה; ניהול חדרים ורשימת מטפלים, צפייה בהיסטוריה מלאה
- **חדרים**: מספר קבוע, מוגדר מראש (ניתן לניהול דרך מנהל)
- **מטפלים**: רשימה קבועה, ללא כניסה - רק בחירת שם מתפריט

---

## ארכיטקטורה

### ערימת טכנולוגיות
- **צד לקוח**: React 18 + Vite + Tailwind CSS + React Router v6 + Lucide React
- **צד שרת**: Node.js + Express.js
- **מסד נתונים**: PostgreSQL + Prisma ORM
- **אין מערכת אימות** למטפלים (בחירת שם); מנהל משתמש בסיסמה פשוטה ב-env

### מבנה הפרויקט
```
counselor-rooms/
├── client/                  # ממשק React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx       # כל החדרים + מטפל נוכחי
│   │   │   ├── ShiftPage.jsx           # מטפל בוחר שם+חדר, תחילת/סיום משמרת
│   │   │   ├── HistoryPage.jsx         # היסטוריית משמרות (סינון לפי מטפל)
│   │   │   └── AdminPage.jsx           # פאנל מנהל (מוגן בסיסמה)
│   │   ├── components/
│   │   │   ├── RoomCard.jsx            # כרטיס חדר לדשבורד
│   │   │   ├── Layout.jsx              # סרגל ניווט + עטיפת פריסה
│   │   │   └── AdminGuard.jsx          # הגנת סיסמה למנהל
│   │   ├── services/api.js             # קריאות Axios לשרת
│   │   └── App.jsx                     # הגדרת נתיבים
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── rooms.js        # GET /rooms, POST /rooms (מנהל), DELETE /rooms/:id (מנהל)
│   │   │   ├── therapists.js   # GET /therapists, POST /therapists (מנהל), DELETE (מנהל)
│   │   │   ├── shifts.js       # POST /shifts/start, POST /shifts/end, GET /shifts/history
│   │   │   └── admin.js        # POST /admin/verify-password
│   │   ├── middleware/
│   │   │   └── adminAuth.js    # מידלוור לבדיקת סיסמת מנהל
│   │   └── index.js            # אפליקציית Express
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

---

## מודלי מסד נתונים (Prisma)

```prisma
model Room {
  id        Int      @id @default(autoincrement())
  name      String   @unique   // למשל "חדר 1", "חדר טיפול א"
  createdAt DateTime @default(now())
  shifts    Shift[]
}

model Therapist {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now())
  shifts    Shift[]
}

model Shift {
  id           Int       @id @default(autoincrement())
  therapistId  Int
  roomId       Int
  startTime    DateTime  @default(now())
  endTime      DateTime?           // null = פעיל כרגע
  therapist    Therapist @relation(fields: [therapistId], references: [id])
  room         Room      @relation(fields: [roomId], references: [id])
}
```

---

## נקודות קצה של ה-API

| שיטה | נתיב | תיאור | הרשאה |
|------|------|--------|--------|
| GET | /api/rooms | רשימת כל החדרים עם המשמרת הפעילה | ציבורי |
| POST | /api/rooms | הוספת חדר | מנהל |
| DELETE | /api/rooms/:id | מחיקת חדר | מנהל |
| GET | /api/therapists | רשימת כל המטפלים | ציבורי |
| POST | /api/therapists | הוספת מטפל | מנהל |
| DELETE | /api/therapists/:id | מחיקת מטפל | מנהל |
| POST | /api/shifts/start | התחלת משמרת (therapistId, roomId) | ציבורי |
| POST | /api/shifts/end | סיום משמרת (therapistId) | ציבורי |
| GET | /api/shifts/history | קבלת היסטוריה (אופציונלי ?therapistId=) | ציבורי |
| POST | /api/admin/verify | אימות סיסמת מנהל | — |

---

## עמודי הממשק

### 1. דשבורד (`/`)
- רשת של כרטיסי `RoomCard`
- כל כרטיס מציג: שם חדר, שם מטפל (או "פנוי"), שעת תחילת משמרת אם פעיל
- רענון אוטומטי כל 30 שניות
- הבחנה ויזואלית ברורה: חדר פעיל (ירוק) מול חדר פנוי (אפור)

### 2. משמרת (`/shift`)
- תפריט נפתח: בחירת שם מטפל מהרשימה
- תפריט נפתח: בחירת חדר (רק חדרים פנויים)
- כפתור "התחלת משמרת" ← POST /api/shifts/start
- אם למטפל יש משמרת פעילה: מציג חדר נוכחי + כפתור "סיום משמרת" ← POST /api/shifts/end
- משוב הצלחה עם הודעת אישור

### 3. היסטוריה (`/history`)
- טבלה המציגה את כל המשמרות: שם מטפל, חדר, שעת כניסה, שעת יציאה, משך
- תפריט נפתח לסינון לפי מטפל
- ממויין לפי החדש ביותר

### 4. מנהל (`/admin`)
- מסך הזנת סיסמה (סיסמה מאוחסנת ב-`.env` של השרת כ-`ADMIN_PASSWORD`)
- לאחר אימות (מאוחסן ב-sessionStorage):
  - **לשונית מטפלים**: רשימה + הוספה + מחיקת מטפלים
  - **לשונית חדרים**: רשימה + הוספה + מחיקת חדרים
  - **לשונית היסטוריה**: היסטוריה מלאה

---

## אימות מנהל
- פשוט: המנהל מזין סיסמה בממשק
- הממשק שולח סיסמה בכותרת `x-admin-password` עם בקשות מנהל
- מידלוור השרת בודק מול `process.env.ADMIN_PASSWORD`
- אין צורך ב-JWT - מאוחסן ב-sessionStorage לאורך הסשן

---

## שלבי יישום

1. **אתחול מבנה הפרויקט** - יצירת תיקיות client ו-server עם קבצי package.json
2. **הגדרת סכמת Prisma** - מודלים Room, Therapist, Shift
3. **בניית שרת Express** - נתיבים לחדרים, מטפלים, משמרות, מנהל
4. **בניית ממשק React** - עמודים, רכיבים, ניתוב
5. **הגדרת סביבה** - .env.example, הגדרת proxy ב-vite
6. **זרעי נתונים ראשוניים** - חדרים ומטפלים לדוגמה דרך Prisma seed
7. **דחיפה למאגר `counselor-rooms` ב-GitHub לענף `claude/counselor-room-dashboard-fCYpZ`**

---

## קבצים קריטיים ליצירה

- `server/prisma/schema.prisma` - מודלי נתונים
- `server/src/index.js` - נקודת כניסה של Express
- `server/src/routes/shifts.js` - לוגיקת המשמרות המרכזית
- `client/src/pages/DashboardPage.jsx` - תצוגה ראשית
- `client/src/pages/ShiftPage.jsx` - אינטראקציית מטפל
- `client/src/pages/AdminPage.jsx` - ניהול מנהל
- `client/src/services/api.js` - כל קריאות ה-API

---

## אימות

1. הרצת `npx prisma migrate dev` ליצירת מסד נתונים
2. הפעלת שרת: `node src/index.js` - אימות שהנתיבים מגיבים
3. הפעלת לקוח: `vite` - בדיקה שהדשבורד מציג חדרים
4. בדיקת זרימת משמרת: בחירת מטפל ← בחירת חדר ← התחלת משמרת ← אימות עדכון דשבורד ← סיום משמרת ← אימות היסטוריה
5. בדיקת מנהל: הזנת סיסמה ← הוספת חדר ← הוספת מטפל ← אימות הופעה בתפריטים
6. בדיקת סינון היסטוריה לפי מטפל

---

## הערות עיצוב ממשק
- פריסת RTL בעברית (`dir="rtl"`)
- Tailwind לעיצוב - נקי ומינימלי
- קידוד צבע: ירוק לחדרים פעילים, אפור לפנויים
- רספונסיבי למובייל
