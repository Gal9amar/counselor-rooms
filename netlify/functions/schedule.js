const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isId = !isNaN(parseInt(lastPart));

  try {
    // GET /api/schedule?roomId=X&dayOfWeek=Y
    if (httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const where = {};
      if (qs.roomId) where.roomId = parseInt(qs.roomId);
      if (qs.dayOfWeek != null) where.dayOfWeek = parseInt(qs.dayOfWeek);

      const slots = await prisma.scheduleSlot.findMany({
        where,
        include: { therapist: true, room: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }],
      });
      return ok(slots);
    }

    // POST /api/schedule — book a range
    if (httpMethod === 'POST') {
      const { roomId, dayOfWeek, startHour, endHour, therapistId } = JSON.parse(body || '{}');

      if (roomId == null || dayOfWeek == null || startHour == null || endHour == null || !therapistId)
        return err('roomId, dayOfWeek, startHour, endHour, therapistId נדרשים', 400);

      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      // Overlap check: existing slots that intersect [startHour, endHour)
      const overlapping = await prisma.scheduleSlot.findFirst({
        where: {
          roomId,
          dayOfWeek,
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
        data: { roomId, dayOfWeek, startHour, endHour, therapistId },
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
