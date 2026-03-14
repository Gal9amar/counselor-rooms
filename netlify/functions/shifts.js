const prisma = require('./lib/prisma');
const { ok, err, cors } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, queryStringParameters } = event;

  // Extract sub-path: /api/shifts/start → "start"
  const parts = path.split('/').filter(Boolean);
  const action = parts[parts.length - 1]; // start | end | history | active | <therapistId>
  const isActiveById = httpMethod === 'GET' && !isNaN(parseInt(action));

  try {
    // POST /api/shifts/start
    if (httpMethod === 'POST' && action === 'start') {
      const { therapistId, roomId } = JSON.parse(body || '{}');
      if (!therapistId || !roomId) return err('therapistId ו-roomId נדרשים', 400);

      const existingShift = await prisma.shift.findFirst({
        where: { therapistId, endTime: null },
        include: { room: true },
      });
      if (existingShift) {
        return err(`המטפל כבר נמצא ב${existingShift.room.name}`, 400);
      }

      const roomOccupied = await prisma.shift.findFirst({
        where: { roomId, endTime: null },
        include: { therapist: true },
      });
      if (roomOccupied) {
        return err(`החדר תפוס על ידי ${roomOccupied.therapist.name}`, 400);
      }

      const shift = await prisma.shift.create({
        data: { therapistId, roomId },
        include: { therapist: true, room: true },
      });
      return ok(shift, 201);
    }

    // POST /api/shifts/end
    if (httpMethod === 'POST' && action === 'end') {
      const { therapistId } = JSON.parse(body || '{}');
      if (!therapistId) return err('therapistId נדרש', 400);

      const activeShift = await prisma.shift.findFirst({
        where: { therapistId, endTime: null },
      });
      if (!activeShift) return err('אין משמרת פעילה למטפל זה', 400);

      const shift = await prisma.shift.update({
        where: { id: activeShift.id },
        data: { endTime: new Date() },
        include: { therapist: true, room: true },
      });
      return ok(shift);
    }

    // GET /api/shifts/active/:therapistId
    if (isActiveById) {
      const therapistId = parseInt(action);
      const shift = await prisma.shift.findFirst({
        where: { therapistId, endTime: null },
        include: { therapist: true, room: true },
      });
      return ok(shift || null);
    }

    // GET /api/shifts/history
    if (httpMethod === 'GET' && action === 'history') {
      const therapistId = queryStringParameters?.therapistId
        ? parseInt(queryStringParameters.therapistId)
        : null;

      const shifts = await prisma.shift.findMany({
        where: {
          ...(therapistId ? { therapistId } : {}),
          endTime: { not: null },
        },
        include: { therapist: true, room: true },
        orderBy: { startTime: 'desc' },
        take: 200,
      });
      return ok(shifts);
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
