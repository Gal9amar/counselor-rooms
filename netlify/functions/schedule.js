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
    // GET
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
        include: { therapist: true, room: true, recurring: true },
        orderBy: [{ date: 'asc' }, { startHour: 'asc' }],
      });
      return ok(slots);
    }

    // POST
    if (httpMethod === 'POST') {
      const { roomId, date, startHour, endHour, therapistId, note } = JSON.parse(body || '{}');
      if (!roomId || !date || startHour == null || endHour == null || !therapistId)
        return err('roomId, date, startHour, endHour, therapistId נדרשים', 400);
      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      const dateUTC = toMidnightUTC(date);
      const overlapping = await prisma.scheduleSlot.findFirst({
        where: { roomId, date: dateUTC, AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }] },
        include: { therapist: true },
      });
      if (overlapping)
        return err(`קיים חופף: ${overlapping.therapist.name} (${overlapping.startHour}:00–${overlapping.endHour}:00)`, 409);

      const slot = await prisma.scheduleSlot.create({
        data: { roomId, date: dateUTC, startHour, endHour, therapistId, ...(note ? { note } : {}) },
        include: { therapist: true, room: true },
      });
      return ok(slot, 201);
    }

    // PATCH /api/schedule/:id — admin only
    if (httpMethod === 'PATCH' && isId) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { startHour, endHour, therapistId, note, roomId, date } = JSON.parse(body || '{}');

      if (startHour == null || endHour == null || !therapistId)
        return err('startHour, endHour, therapistId נדרשים', 400);
      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      const id = parseInt(lastPart);

      const current = await prisma.scheduleSlot.findUnique({ where: { id } });
      if (!current) return err('שיבוץ לא נמצא', 404);

      const targetRoomId = roomId ?? current.roomId;
      const targetDate = date ? toMidnightUTC(date) : current.date;

      // Overlap check (exclude self)
      const overlapping = await prisma.scheduleSlot.findFirst({
        where: {
          id: { not: id },
          roomId: targetRoomId,
          date: targetDate,
          AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
        },
        include: { therapist: true },
      });
      if (overlapping)
        return err(`קיים חופף: ${overlapping.therapist.name} (${overlapping.startHour}:00–${overlapping.endHour}:00)`, 409);

      const slot = await prisma.scheduleSlot.update({
        where: { id },
        data: { startHour, endHour, therapistId, note: note ?? null, roomId: targetRoomId, date: targetDate },
        include: { therapist: true, room: true, recurring: true },
      });
      return ok(slot);
    }

    // DELETE /api/schedule/:id — admin only
    // ?scope=single (default) | all (delete entire recurring series)
    if (httpMethod === 'DELETE' && isId) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const id = parseInt(lastPart);
      const scope = (event.queryStringParameters || {}).scope || 'single';

      if (scope === 'all') {
        const slot = await prisma.scheduleSlot.findUnique({ where: { id } });
        if (!slot) return err('שיבוץ לא נמצא', 404);
        if (slot.recurringId) {
          // Delete all slots in the series, then the recurring record
          await prisma.scheduleSlot.deleteMany({ where: { recurringId: slot.recurringId } });
          await prisma.recurringSchedule.delete({ where: { id: slot.recurringId } });
        } else {
          await prisma.scheduleSlot.delete({ where: { id } });
        }
      } else {
        await prisma.scheduleSlot.delete({ where: { id } });
      }

      return ok({ success: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
