const prisma = require('./lib/prisma');
const { sendBookingNotification } = require('./lib/email');

// Max requests created in 10 minutes for which an email is still sent. Scatter submissions are many rows
// (one per date, up to 40) but one email, so they are counted and limited separately.
const EMAIL_BURST_LIMIT = 15;
const EMAIL_BURST_LIMIT_SCATTER = 60;
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
        scatterAll,
      } = JSON.parse(body || '{}');
      if (!therapistName || !roomId || !date || startHour == null || endHour == null)
        return err('חסרים שדות חובה', 400);
      // Numeric/shape validation (the UI limits these, the public API must too).
      const sh = Number(startHour), eh = Number(endHour);
      if (!Number.isInteger(sh) || !Number.isInteger(eh) || sh < 8 || eh > 22 || sh >= eh)
        return err('שעות לא תקינות: התחלה 8–21, סיום 9–22, וסיום אחרי התחלה', 400);
      if (!Number.isInteger(Number(roomId))) return err('חדר לא תקין', 400);
      if (typeof therapistName !== 'string' || therapistName.trim().length === 0 || therapistName.length > 80)
        return err('שם המבקש ארוך מדי (עד 80 תווים)', 400);
      if (note != null && (typeof note !== 'string' || note.length > 300))
        return err('ההערה ארוכה מדי (עד 300 תווים)', 400);
      const type = bookingType || 'single';
      if (!['single', 'recurring', 'scatter'].includes(type)) return err('סוג שיבוץ לא תקין', 400);
      if (type === 'recurring' && !['daily', 'weekly', 'monthly'].includes(recurFrequency))
        return err('תדירות לא תקינה', 400);
      if (isNaN(new Date(date))) return err('תאריך לא תקין', 400);
      if (recurEndDate != null && (typeof recurEndDate !== 'string' || isNaN(new Date(recurEndDate)))) return err('תאריך סיום לא תקין', 400);
      if (recurOccurrences != null && !(Number.isInteger(Number(recurOccurrences)) && Number(recurOccurrences) >= 1 && Number(recurOccurrences) <= 365))
        return err('מספר מופעים לא תקין', 400);
      if (recurDays != null && !(Array.isArray(recurDays) && recurDays.length <= 7 && recurDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)))
        return err('ימי שבוע לא תקינים', 400);

      const isRecurring = type === 'recurring';
      // Scatter: only the last request (carrying scatterAll) triggers the single summary email.
      const willEmail = type !== 'scatter' || Array.isArray(scatterAll);
      const burstLimit = type === 'scatter' ? EMAIL_BURST_LIMIT_SCATTER : EMAIL_BURST_LIMIT;
      // The burst count does not depend on the new row, so it runs in the same round trip as the create.
      const [request, recent] = await Promise.all([prisma.bookingRequest.create({
        data: {
          therapistName: therapistName.trim(),
          roomId: parseInt(roomId),
          date: toMidnightUTC(date),
          startHour: sh,
          endHour: eh,
          note: note || null,
          bookingType: type,
          recurFrequency: isRecurring ? (recurFrequency || null) : null,
          recurDays: isRecurring && recurFrequency === 'weekly' ? (recurDays || []) : [],
          recurEndDate: isRecurring && recurEndDate ? toMidnightUTC(recurEndDate) : null,
          recurOccurrences: isRecurring && recurOccurrences ? parseInt(recurOccurrences) : null,
        },
        include: { room: { select: { id: true, name: true } } },
      }),
        willEmail
          ? prisma.bookingRequest.count({
              where: {
                createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
                bookingType: type === 'scatter' ? 'scatter' : { not: 'scatter' },
              },
            }).catch(() => 0)
          : Promise.resolve(0),
      ]);

      // Email the owner about every new request. A scatter submission arrives as several requests;
      // the client sends the full list (scatterAll) only with the last one, so that is one email in total.
      // Failures are logged and never fail the request.
      const isScatter = request.bookingType === 'scatter';
      if (willEmail) {
        try {
          // Abuse guard: this endpoint is public, so cap the emails sent per 10 minutes (the request itself is always saved
          // and visible in the admin panel). `recent` excludes the row just created, hence `<` instead of `<=`.
          if (recent < burstLimit) {
            // Malformed client input must never fail a request that is already saved: drop bad entries.
            const scatter = isScatter
              ? scatterAll.slice(0, 40)
                  .filter(e => e && typeof e.date === 'string' && !isNaN(new Date(e.date)))
                  .map(e => ({ date: toMidnightUTC(e.date), startHour: parseInt(e.startHour), endHour: parseInt(e.endHour) }))
                  .filter(e => Number.isInteger(e.startHour) && Number.isInteger(e.endHour) && e.startHour >= 8 && e.endHour <= 22 && e.startHour < e.endHour)
              : undefined;
            await sendBookingNotification(request, { scatter: scatter && scatter.length ? scatter : undefined });
          } else {
            console.warn(`booking email skipped: ${recent} requests in the last 10 minutes`);
          }
        } catch (mailErr) {
          console.error('booking notification failed:', mailErr.message);
        }
      }
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
        const therapist = await prisma.therapist.upsert({
          where: { name: finalTherapistName },
          update: {},
          create: { name: finalTherapistName },
        });

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
          include: { therapist: true },
        });
        if (conflict) return err(
          JSON.stringify({ conflicts: [{ date: toDateStr(new Date(finalDate)), therapist: conflict.therapist.name, startHour: conflict.startHour, endHour: conflict.endHour }] }),
          409
        );

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
    console.error('booking-requests error:', e.message);
    if (e instanceof SyntaxError) return err('בקשה לא תקינה', 400);
    if (e.code === 'P2003') return err('החדר שנבחר לא קיים', 400);
    return err('שגיאת שרת, נסו שוב', 500);
  }
};
