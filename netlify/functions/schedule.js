const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin, handleError, isId, isHour } = require('./lib/helpers');
const HOURS_RANGE_MSG = 'שעות לא תקינות. שעת ההתחלה בין 8:00 ל-21:00 ושעת הסיום בין 9:00 ל-22:00';
const { SLOT_JSON, SLOT_FROM, SLOT_ORDER, slotFilters } = require('./lib/sql');

function toMidnightUTC(dateStr) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const hasId = !isNaN(parseInt(lastPart));

  try {
    // GET
    if (httpMethod === 'GET') {
      // One JOINed statement instead of findMany + one extra Prisma call per `include` relation
      // (measured: 11 -> 5 network round trips). Same response shape; see lib/sql.js.
      // Optional filters: roomId, therapistId, date | from/to.
      const f = slotFilters(event.queryStringParameters || {});
      if (f.error) return err(f.error, 400);
      const rows = await prisma.$queryRaw`
        SELECT ${SLOT_JSON} AS j ${SLOT_FROM} ${f.where} ORDER BY ${SLOT_ORDER}`;
      return ok(rows.map((r) => r.j));
    }

    // POST
    // POST /api/schedule — admin only (regular users use POST /api/booking-requests)
    if (httpMethod === 'POST') {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { roomId, date, startHour, endHour, therapistId, note, forcePending } = JSON.parse(body || '{}');
      if (!roomId || !date || startHour == null || endHour == null || !therapistId)
        return err('יש למלא חדר, תאריך, שעת התחלה, שעת סיום ומטפל', 400);
      if (!isId(roomId) || !isId(therapistId)) return err('שדות לא תקינים', 400);
      if (!isHour(startHour) || !isHour(endHour)) return err(HOURS_RANGE_MSG, 400);
      if (endHour <= startHour)
        return err('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 400);
      if (typeof date !== 'string' || isNaN(new Date(date))) return err('שדות לא תקינים', 400);
      if (note != null && typeof note !== 'string') return err('שדות לא תקינים', 400);

      const dateUTC = toMidnightUTC(date);

      // Check blocking room notes
      // The three checks are independent: run them in one round-trip wave, then decide in the same order as before.
      const [blockingNote, overlapping, pendingConflicts] = await Promise.all([
        prisma.roomNote.findFirst({
          where: {
            roomId,
            blocksBooking: true,
            startDate: { lte: dateUTC },
            endDate: { gte: dateUTC },
            OR: [
              { startHour: null },
              { AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }] },
            ],
          },
        }),
        prisma.scheduleSlot.findFirst({
          where: { roomId, date: dateUTC, AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }] },
          include: { therapist: true },
        }),
        forcePending
          ? Promise.resolve([])
          : prisma.bookingRequest.findMany({
              where: { roomId, date: dateUTC, status: 'pending', startHour: { lt: endHour }, endHour: { gt: startHour } },
            }),
      ]);
      if (blockingNote)
        return err(`החדר חסום: ${blockingNote.message}`, 409);
      if (overlapping)
        return err(`קיים שיבוץ חופף: ${overlapping.therapist.name} (${overlapping.startHour}:00–${overlapping.endHour}:00)`, 409);
      if (pendingConflicts.length > 0) {
        return err(JSON.stringify({
          pendingConflict: true,
          conflicts: pendingConflicts.map(r => ({ therapistName: r.therapistName, startHour: r.startHour, endHour: r.endHour })),
        }), 409);
      }

      const slot = await prisma.scheduleSlot.create({
        data: { roomId, date: dateUTC, startHour, endHour, therapistId, ...(note ? { note } : {}) },
        include: { therapist: true, room: true },
      });
      return ok(slot, 201);
    }

    // PATCH /api/schedule/:id — admin only
    if (httpMethod === 'PATCH' && hasId) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { startHour, endHour, therapistId, note, roomId, date } = JSON.parse(body || '{}');

      if (startHour == null || endHour == null || !therapistId)
        return err('יש למלא שעת התחלה, שעת סיום ומטפל', 400);
      if (!isId(therapistId) || (roomId != null && !isId(roomId))) return err('שדות לא תקינים', 400);
      if (!isHour(startHour) || !isHour(endHour)) return err(HOURS_RANGE_MSG, 400);
      if (endHour <= startHour)
        return err('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 400);
      if (date != null && (typeof date !== 'string' || isNaN(new Date(date)))) return err('שדות לא תקינים', 400);
      if (note != null && typeof note !== 'string') return err('שדות לא תקינים', 400);

      const id = parseInt(lastPart);
      if (!isId(id)) return err('שדות לא תקינים', 400);

      const current = await prisma.scheduleSlot.findUnique({ where: { id } });
      if (!current) return err('השיבוץ לא נמצא. ייתכן שהוא נמחק', 404);

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
        return err(`קיים שיבוץ חופף: ${overlapping.therapist.name} (${overlapping.startHour}:00–${overlapping.endHour}:00)`, 409);

      const slot = await prisma.scheduleSlot.update({
        where: { id },
        data: { startHour, endHour, therapistId, note: note ?? null, roomId: targetRoomId, date: targetDate },
        include: { therapist: true, room: true, recurring: true },
      });
      return ok(slot);
    }

    // DELETE /api/schedule/:id — admin only
    // ?scope=single (default) | all (delete entire recurring series)
    if (httpMethod === 'DELETE' && hasId) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const id = parseInt(lastPart);
      const scope = (event.queryStringParameters || {}).scope || 'single';

      if (scope === 'all') {
        const slot = await prisma.scheduleSlot.findUnique({ where: { id } });
        if (!slot) return err('השיבוץ לא נמצא. ייתכן שהוא נמחק', 404);
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
    return handleError(e, 'schedule');
  }
};
