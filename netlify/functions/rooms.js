const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const id = path.split('/').filter(Boolean).pop();
  const isIdPath = id && !isNaN(parseInt(id));

  try {
    // GET /api/rooms
    if (httpMethod === 'GET') {
      const rooms = await prisma.room.findMany({ orderBy: { name: 'asc' } });
      return ok(rooms);
    }

    // POST /api/rooms (admin)
    if (httpMethod === 'POST') {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('שם חדר נדרש', 400);
      const room = await prisma.room.create({ data: { name } });
      return ok(room, 201);
    }

    // PATCH /api/rooms/:id (admin)
    if (httpMethod === 'PATCH' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('שם חדר נדרש', 400);
      const room = await prisma.room.update({ where: { id: parseInt(id) }, data: { name } });
      return ok(room);
    }

    // DELETE /api/rooms/:id (admin)
    if (httpMethod === 'DELETE' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      await prisma.room.delete({ where: { id: parseInt(id) } });
      return ok({ success: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    if (e.code === 'P2002') return err('חדר עם שם זה כבר קיים', 400);
    return err(e.message);
  }
};
