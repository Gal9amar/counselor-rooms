const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, path, body, headers, queryStringParameters: qs } = event;
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isIdPath = lastPart && !isNaN(parseInt(lastPart));

  try {
    // GET /api/booking-requests?status=pending (admin)
    if (httpMethod === 'GET') {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const where = {};
      if (qs?.status) where.status = qs.status;
      const requests = await prisma.bookingRequest.findMany({
        where,
        include: { room: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return ok(requests);
    }

    // POST /api/booking-requests (public)
    if (httpMethod === 'POST' && !isIdPath) {
      const { therapistName, roomId, date, startHour, endHour, note } = JSON.parse(body || '{}');
      if (!therapistName || !roomId || !date || startHour == null || endHour == null)
        return err('חסרים שדות חובה', 400);
      if (startHour >= endHour) return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      const dateObj = new Date(date + 'T00:00:00Z');
      const request = await prisma.bookingRequest.create({
        data: {
          therapistName,
          roomId: parseInt(roomId),
          date: dateObj,
          startHour: parseInt(startHour),
          endHour: parseInt(endHour),
          note: note || null,
        },
        include: { room: { select: { id: true, name: true } } },
      });
      return ok(request, 201);
    }

    // PATCH /api/booking-requests/:id (admin) — approve / reject / update fields
    if (httpMethod === 'PATCH' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      const id = parseInt(lastPart);
      const { status, therapistName, roomId, date, startHour, endHour, note } = JSON.parse(body || '{}');

      if (status === 'approved') {
        // בדוק שהחדר לא תפוס
        const reqRecord = await prisma.bookingRequest.findUnique({ where: { id } });
        if (!reqRecord) return err('בקשה לא נמצאה', 404);

        const finalRoomId = roomId != null ? parseInt(roomId) : reqRecord.roomId;
        const finalDate = date ? new Date(date + 'T00:00:00Z') : reqRecord.date;
        const finalStart = startHour != null ? parseInt(startHour) : reqRecord.startHour;
        const finalEnd = endHour != null ? parseInt(endHour) : reqRecord.endHour;
        const finalNote = note !== undefined ? note : reqRecord.note;
        const finalTherapistName = therapistName || reqRecord.therapistName;

        // בדיקת חפיפה
        const conflict = await prisma.scheduleSlot.findFirst({
          where: {
            roomId: finalRoomId,
            date: finalDate,
            startHour: { lt: finalEnd },
            endHour: { gt: finalStart },
          },
        });
        if (conflict) return err('קיים שיבוץ חופף בחדר זה בשעות אלו', 409);

        // מצא או צור therapist לפי שם
        let therapist = await prisma.therapist.findFirst({ where: { name: finalTherapistName } });
        if (!therapist) {
          therapist = await prisma.therapist.create({ data: { name: finalTherapistName } });
        }

        // צור slot
        const slot = await prisma.scheduleSlot.create({
          data: {
            roomId: finalRoomId,
            date: finalDate,
            startHour: finalStart,
            endHour: finalEnd,
            therapistId: therapist.id,
            note: finalNote,
          },
          include: { room: true, therapist: true },
        });

        // עדכן בקשה לאושרה
        await prisma.bookingRequest.update({ where: { id }, data: { status: 'approved' } });

        return ok({ request: { id, status: 'approved' }, slot });
      }

      if (status === 'rejected') {
        const updated = await prisma.bookingRequest.update({ where: { id }, data: { status: 'rejected' } });
        return ok(updated);
      }

      // עדכון שדות בלבד (ללא שינוי status)
      const dataToUpdate = {};
      if (therapistName) dataToUpdate.therapistName = therapistName;
      if (roomId != null) dataToUpdate.roomId = parseInt(roomId);
      if (date) dataToUpdate.date = new Date(date + 'T00:00:00Z');
      if (startHour != null) dataToUpdate.startHour = parseInt(startHour);
      if (endHour != null) dataToUpdate.endHour = parseInt(endHour);
      if (note !== undefined) dataToUpdate.note = note;

      const updated = await prisma.bookingRequest.update({
        where: { id },
        data: dataToUpdate,
        include: { room: { select: { id: true, name: true } } },
      });
      return ok(updated);
    }

    // DELETE /api/booking-requests/:id (admin)
    if (httpMethod === 'DELETE' && isIdPath) {
      if (!checkAdmin(headers)) return err('Unauthorized', 401);
      await prisma.bookingRequest.delete({ where: { id: parseInt(lastPart) } });
      return ok({ success: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
