const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];

  try {
    // GET /api/schedule — full weekly grid
    if (httpMethod === 'GET') {
      const slots = await prisma.scheduleSlot.findMany({
        include: { therapist: true, room: true },
      });
      return ok(slots);
    }

    // POST /api/schedule — therapist self-assigns
    if (httpMethod === 'POST') {
      const { roomId, dayOfWeek, therapistId } = JSON.parse(body || '{}');
      if (roomId == null || dayOfWeek == null || !therapistId)
        return err('roomId, dayOfWeek, therapistId נדרשים', 400);

      // Check slot not already taken
      const existing = await prisma.scheduleSlot.findUnique({
        where: { roomId_dayOfWeek: { roomId, dayOfWeek } },
      });
      if (existing) return err('התא כבר תפוס', 409);

      const slot = await prisma.scheduleSlot.create({
        data: { roomId, dayOfWeek, therapistId },
        include: { therapist: true, room: true },
      });
      return ok(slot, 201);
    }

    // DELETE /api/schedule/:id — admin only, clear a slot
    if (httpMethod === 'DELETE' && !isNaN(parseInt(lastPart))) {
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
