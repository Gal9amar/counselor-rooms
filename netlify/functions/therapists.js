const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const id = path.split('/').filter(Boolean).pop();
  const isIdPath = id && !isNaN(parseInt(id));

  try {
    // GET /api/therapists
    if (httpMethod === 'GET') {
      const therapists = await prisma.therapist.findMany({ orderBy: { name: 'asc' } });
      return ok(therapists);
    }

    // POST /api/therapists (admin)
    if (httpMethod === 'POST') {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('שם מטפל נדרש', 400);
      const therapist = await prisma.therapist.create({ data: { name } });
      return ok(therapist, 201);
    }

    // PATCH /api/therapists/:id (admin)
    if (httpMethod === 'PATCH' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('שם מטפל נדרש', 400);
      const therapist = await prisma.therapist.update({ where: { id: parseInt(id) }, data: { name } });
      return ok(therapist);
    }

    // DELETE /api/therapists/:id (admin)
    if (httpMethod === 'DELETE' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const tid = parseInt(id);
      const slotCount = await prisma.scheduleSlot.count({ where: { therapistId: tid } });
      // Delete slots first, then therapist
      if (slotCount > 0) {
        await prisma.scheduleSlot.deleteMany({ where: { therapistId: tid } });
      }
      await prisma.therapist.delete({ where: { id: tid } });
      return ok({ success: true, deletedSlots: slotCount });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    if (e.code === 'P2002') return err('מטפל עם שם זה כבר קיים', 400);
    return err(e.message);
  }
};
