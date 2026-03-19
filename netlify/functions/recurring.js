const prisma = require('./lib/prisma');
const { ok, err, cors } = require('./lib/helpers');

function toMidnightUTC(dateStr) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function toDateStr(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Generate all dates for a recurring schedule.
 * Returns array of Date objects (midnight UTC).
 */
function generateDates({ frequency, daysOfWeek, startDate, endDate, occurrences }) {
  const dates = [];
  const start = toMidnightUTC(startDate);
  const end = endDate ? toMidnightUTC(endDate) : null;
  const maxOccurrences = occurrences || 365; // safety cap

  let current = new Date(start);

  while (dates.length < maxOccurrences) {
    if (end && current > end) break;

    if (frequency === 'daily') {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (frequency === 'weekly') {
      // daysOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
      if (daysOfWeek.includes(current.getUTCDay())) {
        dates.push(new Date(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (frequency === 'monthly') {
      dates.push(new Date(current));
      current.setUTCMonth(current.getUTCMonth() + 1);
    } else if (frequency === 'yearly') {
      dates.push(new Date(current));
      current.setUTCFullYear(current.getUTCFullYear() + 1);
    } else {
      break;
    }

    // Safety: stop if we've gone more than 5 years out
    const fiveYears = new Date(start);
    fiveYears.setUTCFullYear(fiveYears.getUTCFullYear() + 5);
    if (current > fiveYears) break;
  }

  return dates;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, body } = event;

  try {
    // POST /api/recurring — create a new recurring series
    if (httpMethod === 'POST') {
      const {
        roomId,
        therapistId,
        startHour,
        endHour,
        note,
        frequency,
        daysOfWeek,
        startDate,
        endDate,
        occurrences,
      } = JSON.parse(body || '{}');

      // Validate required fields
      if (!roomId || !therapistId || startHour == null || endHour == null || !frequency || !startDate)
        return err('roomId, therapistId, startHour, endHour, frequency, startDate נדרשים', 400);
      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);
      if (!endDate && !occurrences)
        return err('יש לספק endDate או occurrences', 400);
      if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0))
        return err('יש לבחור לפחות יום אחד בשבוע', 400);

      // Generate all target dates
      const dates = generateDates({ frequency, daysOfWeek: daysOfWeek || [], startDate, endDate, occurrences });
      if (dates.length === 0)
        return err('לא נמצאו תאריכים בטווח שהוגדר', 400);

      // Check conflicts for ALL dates in ONE query
      const overlapping = await prisma.scheduleSlot.findMany({
        where: {
          roomId,
          date: { in: dates },
          AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
        },
        include: { therapist: true },
      });

      if (overlapping.length > 0) {
        const conflicts = overlapping.map((s) => ({
          date: toDateStr(new Date(s.date)),
          therapist: s.therapist.name,
          startHour: s.startHour,
          endHour: s.endHour,
        }));
        return err(JSON.stringify({ conflicts }), 409);
      }

      // Create the RecurringSchedule record
      const recurring = await prisma.recurringSchedule.create({
        data: {
          roomId,
          therapistId,
          startHour,
          endHour,
          note: note || null,
          frequency,
          daysOfWeek: daysOfWeek || [],
          startDate: toMidnightUTC(startDate),
          endDate: endDate ? toMidnightUTC(endDate) : null,
          occurrences: occurrences || null,
        },
      });

      // Create all slots in one query
      await prisma.scheduleSlot.createMany({
        data: dates.map((date) => ({
          roomId,
          date,
          startHour,
          endHour,
          therapistId,
          note: note || null,
          recurringId: recurring.id,
        })),
      });

      // Fetch created slots with relations for the response
      const createdSlots = await prisma.scheduleSlot.findMany({
        where: { recurringId: recurring.id },
        include: { therapist: true, room: true },
        orderBy: { date: 'asc' },
      });

      return ok({ recurring, slots: createdSlots }, 201);
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
