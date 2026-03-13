# ניהול חדרי טיפול

דשבורד לניהול נוכחות מטפלים בחדרי טיפול.

## פיצ'רים
- דשבורד חדרים בזמן אמת (ירוק = פעיל, אפור = פנוי)
- כניסה/יציאה ממשמרת בלחיצה
- היסטוריית משמרות עם סינון לפי מטפל
- פאנל מנהל לניהול חדרים ומטפלים

## טכנולוגיות
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **DB**: PostgreSQL via Supabase
- **Deploy**: Render

---

## התקנה מקומית

### דרישות
- Node.js 18+
- חשבון Supabase

### שרת
```bash
cd server
cp .env.example .env
# ערוך .env עם פרטי Supabase
npm install
npx prisma migrate dev
node prisma/seed.js   # נתוני דוגמה (אופציונלי)
npm run dev
```

### לקוח
```bash
cd client
npm install
npm run dev
```

---

## Deploy ל-Render + Supabase

### 1. Supabase
1. צור פרויקט חדש ב-[supabase.com](https://supabase.com)
2. עבור להגדרות → Database → Connection String
3. העתק את **Transaction pooler** (פורט 6543) → `DATABASE_URL`
4. העתק את **Direct connection** (פורט 5432) → `DIRECT_URL`

### 2. Render
1. חבר את המאגר ב-[render.com](https://render.com)
2. Render יזהה את `render.yaml` אוטומטית
3. הגדר משתני סביבה:
   - `DATABASE_URL` - Transaction pooler מ-Supabase
   - `DIRECT_URL` - Direct connection מ-Supabase
   - `ADMIN_PASSWORD` - סיסמה לפאנל המנהל
   - `CLIENT_URL` - URL של ה-frontend (לאחר deploy)
   - `VITE_API_URL` - URL של ה-backend API
