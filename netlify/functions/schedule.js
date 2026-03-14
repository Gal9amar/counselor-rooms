const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isId = !isNaN(parseInt(lastPart));

  try {
    // GET /api/schedule?roomId=X  OR  GET /api/schedule (all)
    if (httpMethod === 'GET') {
      const roomId = event.queryStringParameters?.roomId
        ? parseInt(event.queryStringParameters.roomId)
        : null;
      const slots = await prisma.scheduleSlot.findMany({
        where: roomId ? { roomId } : {},
        include: { therapist: true, room: true },
        orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }],
      });
      return ok(slots);
    }

    // POST /api/schedule — self-assign
    if (httpMethod === 'POST') {
      const { roomId, dayOfWeek, hour, therapistId } = JSON.parse(body || '{}');
      if (roomId == null || dayOfWeek == null || hour == null || !therapistId)
        return err('roomId, dayOfWeek, hour, therapistId נדרשים', 400);

      const existing = await prisma.scheduleSlot.findUnique({
        where: { roomId_dayOfWeek_hour: { roomId, dayOfWeek, hour } },
      });
      if (existing) return err('התא כבר תפוס', 409);

      const slot = await prisma.scheduleSlot.create({
        data: { roomId, dayOfWeek, hour, therapistId },
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
    if (e.code === 'P2002') return err('התא כבר תפוס', 409);
    return err(e.message);
  }
};
