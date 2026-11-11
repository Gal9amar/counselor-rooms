const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

const ok = (data, status = 200, extraHeaders) => ({
  statusCode: status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  body: JSON.stringify(data),
});

// Cache headers for rarely-changing public GETs (rooms, therapists, room notes).
// - Browsers always revalidate (max-age=0), so nothing is ever pinned in a browser cache.
// - Netlify's CDN may serve the response for 20s and refresh it in the background for 60s more
//   (Netlify-CDN-Cache-Control is read by Netlify's edge only, never by browsers).
// - Any request that carries x-admin-password (the client sends it on EVERY call while an admin is logged in)
//   gets no-store and a separate cache key (Netlify-Vary), so an admin always reads their own writes.
const publicCache = (headers) => {
  if ((headers || {})['x-admin-password']) return { 'Cache-Control': 'no-store' };
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60',
    'Netlify-Vary': 'header=x-admin-password,query',
  };
};

const err = (message, status = 500) => ({
  statusCode: status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

const INT32_MAX = 2147483647;
// Positive integer that fits a Postgres int4 id column.
const isId = (v) => Number.isInteger(v) && v >= 1 && v <= INT32_MAX;
const isHour = (v) => Number.isInteger(v) && v >= 8 && v <= 22;

// Shared catch-block mapping: never returns e.message. Logs only the error code/name.
// `uniqueMsg` is the friendly 400 for Prisma P2002 (when the route has a unique column).
const handleError = (e, tag, uniqueMsg) => {
  console.error(`${tag} error:`, (e && (e.code || e.name)) || 'unknown');
  if (e instanceof SyntaxError) return err('בקשה לא תקינה', 400);
  if (e && e.code === 'P2002') return err(uniqueMsg || 'הפריט כבר קיים', 400);
  if (e && e.code === 'P2025') return err('הפריט לא נמצא', 404);
  if (e && e.code === 'P2003') return err('החדר או המטפל שנבחרו אינם קיימים', 400);
  return err('אירעה תקלה בשרת. נסו שוב בעוד רגע', 500);
};

const cors = () => ({
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
});

const checkAdmin = (headers) => {
  const password = (headers || {})['x-admin-password'];
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof password !== 'string' || !password || !expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

function toMidnightUTC(dateStr) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function toDateStr(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function generateDates({ frequency, daysOfWeek, startDate, endDate, occurrences }) {
  const dates = [];
  const start = toMidnightUTC(startDate);
  const end = endDate ? toMidnightUTC(endDate) : null;
  const maxOccurrences = occurrences || 365;
  const fiveYears = new Date(start);
  fiveYears.setUTCFullYear(fiveYears.getUTCFullYear() + 5);
  let current = new Date(start);

  if (frequency === 'weekly') {
    let weekCount = 0;
    const startWeekSunday = new Date(start);
    startWeekSunday.setUTCDate(start.getUTCDate() - start.getUTCDay());
    let weekStart = new Date(startWeekSunday);
    while (weekCount < maxOccurrences) {
      if (end && weekStart > end) break;
      if (weekStart > fiveYears) break;
      let addedInWeek = false;
      for (let d = 0; d < 7; d++) {
        if (!daysOfWeek.includes(d)) continue;
        const day = new Date(weekStart);
        day.setUTCDate(weekStart.getUTCDate() + d);
        if (day < start) continue;
        if (end && day > end) continue;
        dates.push(new Date(day));
        addedInWeek = true;
      }
      if (addedInWeek) weekCount++;
      weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }
  } else {
    while (dates.length < maxOccurrences) {
      if (end && current > end) break;
      if (current > fiveYears) break;
      if (frequency === 'daily') {
        dates.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + 1);
      } else if (frequency === 'monthly') {
        dates.push(new Date(current));
        current.setUTCMonth(current.getUTCMonth() + 1);
      } else {
        break;
      }
    }
  }
  return dates;
}

module.exports = { ok, err, cors, handleError, isId, isHour, INT32_MAX, publicCache, checkAdmin, toMidnightUTC, toDateStr, generateDates };
