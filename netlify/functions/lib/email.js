// Booking-request notification emails, sent through the Resend REST API (no SDK needed, Node 18 has fetch).
// Env: RESEND_API_KEY (required), BOOKING_NOTIFY_EMAIL (default below), RESEND_FROM (optional),
//      SITE_URL (optional, used for the "open admin" button).

const DEFAULT_TO = 'gal9amar@gmail.com';
const DEFAULT_FROM = 'מרכז אופק - בקשות שיבוץ <onboarding@resend.dev>';
const DEFAULT_SITE = 'https://treatmentrooms.netlify.app';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const own = (obj, key) => (Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined);
const TYPE_LABEL = { single: 'שיבוץ יחיד', recurring: 'שיבוץ חוזר', scatter: 'שיבוץ תפזורת' };
const FREQ_LABEL = { daily: 'כל יום', weekly: 'כל שבוע', monthly: 'כל חודש' };

// Strip line breaks and bidi-override characters from attacker-controlled text (subject / plain-text part).
const clean = (v, max = 300) => String(v ?? '').replace(/[\r\n\u202A-\u202E\u2066-\u2069]+/g, ' ').slice(0, max);
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Dates are stored as midnight UTC; always read them with the UTC getters.
function dateHe(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `יום ${DAYS_HE[x.getUTCDay()]}, ${x.getUTCDate()} ${MONTHS_HE[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}
// LRI..PDI isolates the range so right-to-left text does not flip "10:00–12:00" into "12:00–10:00".
const hours = (s, e) => `⁦${s}:00–${e}:00⁩`;

function rowsFor(request, scatter) {
  const rows = [
    ['מבקש', request.therapistName],
    ['חדר', request.room?.name || `חדר ${request.roomId}`],
  ];
  if (scatter) {
    rows.push(['תאריכים', scatter.map((e) => `${dateHe(e.date)} · ${hours(e.startHour, e.endHour)}`)]);
  } else {
    rows.push(['תאריך', dateHe(request.date)]);
    rows.push(['שעות', hours(request.startHour, request.endHour)]);
  }
  if (request.bookingType === 'recurring') {
    const days = (request.recurDays || []).map((d) => DAYS_HE[d]).join(', ');
    rows.push(['תדירות', `${own(FREQ_LABEL, request.recurFrequency) || ''}${days ? ` (${days})` : ''}`]);
    rows.push(['סיום הסדרה', request.recurEndDate ? `עד ${dateHe(request.recurEndDate)}` : request.recurOccurrences ? `אחרי ${request.recurOccurrences} מפגשים` : 'לא הוגדר']);
  }
  rows.push(['הערה', request.note || '—']);
  return rows;
}

function buildEmail(request, scatter, siteUrl) {
  const type = own(TYPE_LABEL, request.bookingType) || TYPE_LABEL.single;
  const rows = rowsFor(request, scatter);
  const when = scatter ? `${scatter.length} תאריכים` : dateHe(request.date);
  const subject = clean(`בקשת שיבוץ חדשה – ${request.therapistName} · ${request.room?.name || 'חדר'} · ${when}`, 150);
  const adminUrl = `${siteUrl.replace(/\/$/, '')}/admin`;

  const rowHtml = rows.map(([label, value], i) => {
    const val = Array.isArray(value)
      ? value.map((v) => `<div style="padding:2px 0;">${esc(v)}</div>`).join('')
      : esc(value);
    const border = i === rows.length - 1 ? '' : 'border-bottom:1px solid #e5efe7;';
    return `<tr>
      <td style="padding:12px 0 12px 16px;${border}color:#4b5563;font-size:14px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:12px 0;${border}color:#111827;font-size:16px;font-weight:600;vertical-align:top;">${val}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f7f4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(request.therapistName)} מבקש/ת ${esc(request.room?.name || 'חדר')} · ${esc(when)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#f3f7f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dcebdf;font-family:'Rubik','Segoe UI',Arial,Helvetica,sans-serif;">
        <tr><td style="background:#15803d;padding:22px 28px;">
          <div style="color:#d1fae5;font-size:13px;letter-spacing:.2px;">מרכז אופק · חוף אשקלון</div>
          <div style="color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;margin-top:4px;">בקשת שיבוץ חדשה</div>
        </td></tr>
        <tr><td style="padding:22px 28px 6px;">
          <span style="display:inline-block;background:#dcfce7;color:#166534;font-size:13px;font-weight:700;border-radius:999px;padding:5px 14px;">${esc(type)}</span>
          <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;border-radius:999px;padding:5px 14px;margin-right:6px;">ממתינה לאישור</span>
        </td></tr>
        <tr><td style="padding:8px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table>
        </td></tr>
        <tr><td align="center" style="padding:18px 28px 28px;">
          <a href="${esc(adminUrl)}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;padding:14px 32px;">פתיחת פאנל הניהול לאישור</a>
          <div style="color:#6b7280;font-size:13px;margin-top:14px;">אישור או דחייה של הבקשה מתבצעים בפאנל הניהול, בלשונית בקשות שיבוץ.</div>
        </td></tr>
      </table>
      <div style="color:#6b7280;font-size:12px;margin-top:14px;font-family:Arial,sans-serif;">הודעה אוטומטית ממערכת ניהול חדרי הטיפול</div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    'בקשת שיבוץ חדשה (ממתינה לאישור)',
    `סוג: ${type}`,
    ...rows.map(([l, v]) => `${l}: ${Array.isArray(v) ? '\n  ' + v.map((x) => clean(x)).join('\n  ') : clean(v)}`),
    '',
    'התוכן הוזן על ידי המבקש - אין לסמוך על קישורים שבו.',
    '',
    `פאנל ניהול: ${adminUrl}`,
  ].join('\n');

  return { subject, html, text };
}

// Never throws: a failed email must not fail the booking request. Returns { sent, reason? }.
async function sendBookingNotification(request, { scatter } = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY missing' };
  const to = process.env.BOOKING_NOTIFY_EMAIL || DEFAULT_TO;
  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const { subject, html, text } = buildEmail(request, scatter, process.env.SITE_URL || DEFAULT_SITE);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Resend error', res.status, body.slice(0, 300));
      return { sent: false, reason: `Resend ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('Resend request failed:', e.name === 'AbortError' ? 'timeout' : e.message);
    return { sent: false, reason: e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendBookingNotification, buildEmail };
