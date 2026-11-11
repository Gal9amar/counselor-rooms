const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');
const { sendTestEmail } = require('./lib/email');

// Admin-only app settings. Currently one key: the booking-request notification address.
// The value is personal data: never logged, never cached.
const KEY = 'bookingNotifyEmail';
const NO_STORE = { 'Cache-Control': 'no-store' };
const respond = (data, status = 200) => ok(data, status, NO_STORE);
const fail = (message, status) => ({ ...err(message, status), headers: { ...err(message, status).headers, ...NO_STORE } });

// Practical single-address check: ASCII local part (no quotes/brackets/spaces/commas/semicolons), dotted domain with a 2+ letter TLD.
const EMAIL_RE = /^[A-Za-z0-9!#$%&*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&*+\/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;
const BAD_EMAIL = 'כתובת המייל אינה תקינה. יש להזין כתובת אחת, למשל name@example.org';

function validEmail(v) {
  return v.length <= 254 && !/[\s,;<>"'\\()\[\]]/.test(v) && v.split('@')[0].length <= 64 && EMAIL_RE.test(v);
}

const envFallback = () => !!(process.env.BOOKING_NOTIFY_EMAIL || '').trim();
async function readState() {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  return { notifyEmail: row && typeof row.value === 'string' ? row.value : '', envFallback: envFallback() };
}

// Test-email abuse guard. Module-level state: it lives per warm serverless instance only, so concurrent
// instances can each send one (best-effort limit, acceptable for an admin-only endpoint).
const TEST_COOLDOWN_MS = 30 * 1000;
let lastTestAt = 0;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  const { httpMethod, path, body, headers } = event;
  if (!checkAdmin(headers)) return fail('Unauthorized', 401);

  const lastPart = (path || '').split('/').filter(Boolean).pop();

  try {
    if (lastPart === 'settings') {
      if (httpMethod === 'GET') return respond(await readState());

      if (httpMethod === 'PUT') {
        let parsed;
        try { parsed = JSON.parse(body || '{}'); } catch { return fail('בקשה לא תקינה', 400); }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.notifyEmail !== 'string') return fail(BAD_EMAIL, 400);
        const value = parsed.notifyEmail.trim();
        if (value === '') {
          await prisma.appSetting.deleteMany({ where: { key: KEY } }); // no error when the row does not exist
        } else {
          if (!validEmail(value)) return fail(BAD_EMAIL, 400);
          await prisma.appSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
        }
        return respond(await readState());
      }
      return fail('Method not allowed', 405);
    }

    if (lastPart === 'test-email') {
      if (httpMethod !== 'POST') return fail('Method not allowed', 405);
      const { notifyEmail } = await readState();
      const to = notifyEmail || (process.env.BOOKING_NOTIFY_EMAIL || '').trim();
      if (!to) return fail('לא הוגדרה כתובת לקבלת בקשות', 400);
      const now = Date.now();
      if (now - lastTestAt < TEST_COOLDOWN_MS) return fail('נשלח מייל בדיקה לפני רגע. יש להמתין 30 שניות בין בדיקות', 429);
      lastTestAt = now;
      const r = await sendTestEmail(to);
      if (!r.sent) return fail('שליחת מייל הבדיקה נכשלה. נסו שוב בעוד רגע', 502);
      return respond({ sent: true });
    }

    return fail('Not found', 404);
  } catch (e) {
    console.error('settings error:', e.code || e.name); // never e.message: it may echo the address
    if (e.code === 'P2002') return fail('ההגדרה כבר קיימת', 400);
    if (e.code === 'P2025') return fail('ההגדרה לא נמצאה', 404);
    return fail('שגיאת שרת, נסו שוב', 500);
  }
};
