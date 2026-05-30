const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

const ok = (data, status = 200) => ({
  statusCode: status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const err = (message, status = 500) => ({
  statusCode: status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

const cors = () => ({
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
});

const checkAdmin = (headers) => {
  const password = headers['x-admin-password'];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return false;
  }
  return true;
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

module.exports = { ok, err, cors, checkAdmin, toMidnightUTC, toDateStr, generateDates };
