const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin, publicCache, handleError } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const id = path.split('/').filter(Boolean).pop();
  const isIdPath = id && !isNaN(parseInt(id));

  try {
    // GET /api/therapists
    if (httpMethod === 'GET') {
      const therapists = await prisma.therapist.findMany({ orderBy: { name: 'asc' } });
      return ok(therapists, 200, publicCache(headers));
    }

    // POST /api/therapists (admin)
    if (httpMethod === 'POST') {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('יש להזין שם מטפל', 400);
      const therapist = await prisma.therapist.create({ data: { name } });
      return ok(therapist, 201);
    }

    // PATCH /api/therapists/:id (admin)
    if (httpMethod === 'PATCH' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('יש להזין שם מטפל', 400);
      const therapist = await prisma.therapist.update({ where: { id: parseInt(id) }, data: { name } });
      return ok(therapist);
    }

    // DELETE /api/therapists/:id (admin)
    if (httpMethod === 'DELETE' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const tid = parseInt(id);
      // Atomic: slots first, then therapist; deleteMany already reports how many rows it removed.
      const [deletedSlots] = await prisma.$transaction([
        prisma.scheduleSlot.deleteMany({ where: { therapistId: tid } }),
        prisma.therapist.delete({ where: { id: tid } }),
      ]);
      return ok({ success: true, deletedSlots: deletedSlots.count });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return handleError(e, 'therapists', 'כבר קיים מטפל בשם הזה');
  }
};
