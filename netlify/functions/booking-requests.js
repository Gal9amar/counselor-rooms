const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin, toMidnightUTC, toDateStr, generateDates } = require('./lib/helpers');

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
      const {
        therapistName, roomId, date, startHour, endHour, note,
        bookingType, recurFrequency, recurDays, recurEndMode, recurOccurrences, recurEndDate,
      } = JSON.parse(body || '{}');
      if (!therapistName || !roomId || !date || startHour == null || endHour == null)
        return err('חסרים שדות חובה', 400);
      if (startHour >= endHour) return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      const isRecurring = bookingType === 'recurring';
      const request = await prisma.bookingRequest.create({
        data: {
          therapistName,
          roomId: parseInt(roomId),
          date: toMidnightUTC(date),
          startHour: parseInt(startHour),
          endHour: parseInt(endHour),
          note: note || null,
          bookingType: bookingType || 'single',
          recurFrequency: isRecurring ? (recurFrequency || null) : null,
          recurDays: isRecurring && recurFrequency === 'weekly' ? (recurDays || []) : [],
          recurEndDate: isRecurring && recurEndDate ? toMidnightUTC(recurEndDate) : null,
          recurOccurrences: isRecurring && recurOccurrences ? parseInt(recurOccurrences) : null,
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
        const reqRecord = await prisma.bookingRequest.findUnique({ where: { id } });
        if (!reqRecord) return err('בקשה לא נמצאה', 404);

        const finalRoomId = roomId != null ? parseInt(roomId) : reqRecord.roomId;
        const finalDate = date ? toMidnightUTC(date) : reqRecord.date;
        const finalStart = startHour != null ? parseInt(startHour) : reqRecord.startHour;
        const finalEnd = endHour != null ? parseInt(endHour) : reqRecord.endHour;
        const finalNote = note !== undefined ? note : reqRecord.note;
        const finalTherapistName = therapistName || reqRecord.therapistName;

        // מצא או צור therapist לפי שם
        let therapist = await prisma.therapist.findFirst({ where: { name: finalTherapistName } });
        if (!therapist) {
          therapist = await prisma.therapist.create({ data: { name: finalTherapistName } });
        }

        // אישור שיבוץ חוזר
        if (reqRecord.bookingType === 'recurring' && reqRecord.recurFrequency) {
          const startDateStr = toDateStr(reqRecord.date);
          const endDateStr = reqRecord.recurEndDate ? toDateStr(reqRecord.recurEndDate) : null;

          const dates = generateDates({
            frequency: reqRecord.recurFrequency,
            daysOfWeek: reqRecord.recurDays || [],
            startDate: startDateStr,
            endDate: endDateStr,
            occurrences: reqRecord.recurOccurrences || null,
          });
          if (dates.length === 0) return err('לא נמצאו תאריכים בטווח שהוגדר', 400);

          // בדיקת חפיפות לכל התאריכים
          const overlapping = await prisma.scheduleSlot.findMany({
            where: {
              roomId: finalRoomId,
              date: { in: dates },
              AND: [{ startHour: { lt: finalEnd } }, { endHour: { gt: finalStart } }],
            },
            include: { therapist: true },
          });
          if (overlapping.length > 0) {
            const conflicts = overlapping.map(s => ({
              date: toDateStr(new Date(s.date)),
              therapist: s.therapist.name,
              startHour: s.startHour,
              endHour: s.endHour,
            }));
            return err(JSON.stringify({ conflicts }), 409);
          }

          // צור RecurringSchedule + slots
          const recurring = await prisma.recurringSchedule.create({
            data: {
              roomId: finalRoomId,
              therapistId: therapist.id,
              startHour: finalStart,
              endHour: finalEnd,
              note: finalNote,
              frequency: reqRecord.recurFrequency,
              daysOfWeek: reqRecord.recurDays || [],
              startDate: toMidnightUTC(startDateStr),
              endDate: endDateStr ? toMidnightUTC(endDateStr) : null,
              occurrences: reqRecord.recurOccurrences || null,
            },
          });
          await prisma.scheduleSlot.createMany({
            data: dates.map(d => ({
              roomId: finalRoomId,
              date: d,
              startHour: finalStart,
              endHour: finalEnd,
              therapistId: therapist.id,
              note: finalNote,
              recurringId: recurring.id,
            })),
          });
          const createdSlots = await prisma.scheduleSlot.findMany({
            where: { recurringId: recurring.id },
            include: { room: true, therapist: true, recurring: true },
            orderBy: { date: 'asc' },
          });
          await prisma.bookingRequest.update({ where: { id }, data: { status: 'approved' } });
          return ok({ request: { id, status: 'approved' }, slots: createdSlots, recurring });
        }

        // אישור שיבוץ יחיד / תפזורת
        const conflict = await prisma.scheduleSlot.findFirst({
          where: {
            roomId: finalRoomId,
            date: finalDate,
            startHour: { lt: finalEnd },
            endHour: { gt: finalStart },
          },
        });
        if (conflict) return err('קיים שיבוץ חופף בחדר זה בשעות אלו', 409);

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
