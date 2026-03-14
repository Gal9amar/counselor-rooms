const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

function toMidnightUTC(dateStr) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isId = !isNaN(parseInt(lastPart));

  try {
    // GET /api/schedule?roomId=X&date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD
    if (httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const where = {};

      if (qs.roomId) where.roomId = parseInt(qs.roomId);

      if (qs.date) {
        where.date = toMidnightUTC(qs.date);
      } else if (qs.from || qs.to) {
        where.date = {};
        if (qs.from) where.date.gte = toMidnightUTC(qs.from);
        if (qs.to)   where.date.lte = toMidnightUTC(qs.to);
      }

      const slots = await prisma.scheduleSlot.findMany({
        where,
        include: { therapist: true, room: true },
        orderBy: [{ date: 'asc' }, { startHour: 'asc' }],
      });
      return ok(slots);
    }

    // POST /api/schedule
    if (httpMethod === 'POST') {
      const { roomId, date, startHour, endHour, therapistId } = JSON.parse(body || '{}');

      if (!roomId || !date || startHour == null || endHour == null || !therapistId)
        return err('roomId, date, startHour, endHour, therapistId נדרשים', 400);

      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      const dateUTC = toMidnightUTC(date);

      // Overlap check
      const overlapping = await prisma.scheduleSlot.findFirst({
        where: {
          roomId,
          date: dateUTC,
          AND: [
            { startHour: { lt: endHour } },
            { endHour: { gt: startHour } },
          ],
        },
        include: { therapist: true },
      });

      if (overlapping) {
        return err(
          `קיים חופף: ${overlapping.therapist.name} (${overlapping.startHour}:00–${overlapping.endHour}:00)`,
          409
        );
      }

      const slot = await prisma.scheduleSlot.create({
        data: { roomId, date: dateUTC, startHour, endHour, therapistId },
        include: { therapist: true, room: true },
      });
      return ok(slot, 201);
    }

    // DELETE /api/schedule/:id — admin only
    if (httpMethod === 'DELETE' && isId) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      await prisma.scheduleSlot.delete({ where: { id: parseInt(lastPart) } });
      return ok({ success: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
