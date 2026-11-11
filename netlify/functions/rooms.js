const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isIdPath = lastPart && !isNaN(parseInt(lastPart));
  const isReorder = lastPart === 'reorder';

  try {
    // GET /api/rooms
    if (httpMethod === 'GET') {
      const rooms = await prisma.room.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
      return ok(rooms);
    }

    // POST /api/rooms (admin)
    if (httpMethod === 'POST' && !isReorder) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('שם חדר נדרש', 400);
      const maxOrder = await prisma.room.aggregate({ _max: { order: true } });
      const room = await prisma.room.create({ data: { name, order: (maxOrder._max.order ?? -1) + 1 } });
      return ok(room, 201);
    }

    // POST /api/rooms/reorder (admin) — body: { ids: [1,3,2,...] }
    if (httpMethod === 'POST' && isReorder) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { ids } = JSON.parse(body || '{}');
      if (!Array.isArray(ids)) return err('ids נדרש', 400);
      if (!ids.every(Number.isInteger)) return err('ids חייב להכיל מספרים שלמים', 400);
      // One UPDATE for all rooms (was one UPDATE per room inside a transaction).
      await prisma.$executeRaw`
        UPDATE "Room" AS r SET "order" = v.ord::int - 1
        FROM unnest(${ids}::int[]) WITH ORDINALITY AS v(id, ord)
        WHERE r.id = v.id`;
      const rooms = await prisma.room.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
      return ok(rooms);
    }

    // PATCH /api/rooms/:id (admin)
    if (httpMethod === 'PATCH' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const { name } = JSON.parse(body || '{}');
      if (!name) return err('שם חדר נדרש', 400);
      const room = await prisma.room.update({ where: { id: parseInt(lastPart) }, data: { name } });
      return ok(room);
    }

    // DELETE /api/rooms/:id (admin)
    if (httpMethod === 'DELETE' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const rid = parseInt(lastPart);
      // Atomic: slots and room go together; deleteMany already reports how many rows it removed.
      const [deletedSlots] = await prisma.$transaction([
        prisma.scheduleSlot.deleteMany({ where: { roomId: rid } }),
        prisma.room.delete({ where: { id: rid } }),
      ]);
      return ok({ success: true, deletedSlots: deletedSlots.count });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    if (e.code === 'P2002') return err('חדר עם שם זה כבר קיים', 400);
    return err(e.message);
  }
};
