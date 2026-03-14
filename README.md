# ניהול חדרי טיפול

דשבורד לניהול נוכחות מטפלים בחדרי טיפול.

## פיצ'רים

- דשבורד חדרים בזמן אמת (ירוק = פעיל, אפור = פנוי)
- כניסה/יציאה ממשמרת בלחיצה
- היסטוריית משמרות עם סינון לפי מטפל
- פאנל מנהל לניהול חדרים ומטפלים

## טכנולוגיות

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Netlify Functions (Serverless)
- **DB**: PostgreSQL via Supabase
- **Deploy**: Netlify

---

## התקנה מקומית

### דרישות

- Node.js 18+
- חשבון Supabase
- Netlify CLI: `npm i -g netlify-cli`

### הגדרת סביבה

```bash
cp .env.example .env
# ערוך .env עם פרטי Supabase
```

### הרצת מיגרציה

```bash
npm install
npx prisma migrate deploy
# או לפיתוח: npx prisma migrate dev
```

### הרצה מקומית עם Netlify Dev

```bash
# Root (functions + prisma)
npm install

# Client
cd client && npm install && cd ..

# הרצה
netlify dev
```

Netlify Dev מריץ את הפונקציות ואת ה-Vite dev server יחד בפורט 8888.

---

## Deploy ל-Netlify + Supabase

### 1. Supabase

1. צור פרויקט חדש ב-[supabase.com](https://supabase.com)
2. הגדרות → Database → Connection String:
   - **Transaction pooler** (פורט 6543) → `DATABASE_URL`
   - **Direct connection** (פורט 5432) → `DIRECT_URL`
3. הרץ מיגרציה: `npx prisma migrate deploy`

### 2. Netlify

1. חבר את המאגר ב-[app.netlify.com](https://app.netlify.com)
2. Netlify יזהה את `netlify.toml` אוטומטית
3. הגדר משתני סביבה ב-Site Settings → Environment Variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `ADMIN_PASSWORD`
