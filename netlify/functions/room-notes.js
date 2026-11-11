const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin, publicCache, handleError, isId } = require('./lib/helpers');

function toMidnightUTC(dateStr) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isIdPath = lastPart && !isNaN(parseInt(lastPart));

  try {
    // GET /api/room-notes?roomId=X  — returns notes (optionally filtered by room)
    if (httpMethod === 'GET') {
      const roomIdRaw = event.queryStringParameters?.roomId;
      let where = {};
      if (roomIdRaw) {
        const rid = /^\d+$/.test(String(roomIdRaw)) ? Number(roomIdRaw) : NaN;
        if (!isId(rid)) return err('חדר לא תקין', 400);
        where = { roomId: rid };
      }
      const notes = await prisma.roomNote.findMany({
        where,
        orderBy: { startDate: 'asc' },
      });
      return ok(notes, 200, publicCache(headers));
    }

    // POST /api/room-notes (admin)
    if (httpMethod === 'POST') {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { roomId, message, startDate, endDate, startHour, endHour, blocksBooking } = JSON.parse(body || '{}');
      if (!roomId || !message || !startDate || !endDate)
        return err('יש למלא הערה, תאריך התחלה ותאריך סיום', 400);
      if (new Date(startDate) > new Date(endDate))
        return err('תאריך הסיום חייב להיות אחרי תאריך ההתחלה', 400);
      if (startHour != null && endHour != null && endHour <= startHour)
        return err('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 400);

      const note = await prisma.roomNote.create({
        data: {
          roomId,
          message,
          startDate: toMidnightUTC(startDate),
          endDate: toMidnightUTC(endDate),
          startHour: startHour ?? null,
          endHour: endHour ?? null,
          blocksBooking: !!blocksBooking,
        },
      });
      return ok(note, 201);
    }

    // DELETE /api/room-notes/:id (admin)
    if (httpMethod === 'DELETE' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const id = parseInt(lastPart);
      await prisma.roomNote.delete({ where: { id } });
      return ok({ deleted: id });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return handleError(e, 'room-notes');
  }
};
