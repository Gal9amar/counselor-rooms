const prisma = require('./lib/prisma');
const { ok, err, cors, checkAdmin, toMidnightUTC, toDateStr, generateDates, handleError, isId, isHour } = require('./lib/helpers');
const HOURS_RANGE_MSG = 'שעות לא תקינות. שעת ההתחלה בין 8:00 ל-21:00 ושעת הסיום בין 9:00 ל-22:00';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, body } = event;

  try {
    // POST /api/recurring — create a new recurring series
    // Admin only (regular users use POST /api/booking-requests)
    if (httpMethod === 'POST') {
      if (!checkAdmin(event.headers)) return err('Unauthorized', 401);
      const {
        roomId,
        therapistId,
        startHour,
        endHour,
        note,
        frequency,
        daysOfWeek,
        startDate,
        endDate,
        occurrences,
        forcePending,
      } = JSON.parse(body || '{}');

      // Validate required fields
      if (!roomId || !therapistId || startHour == null || endHour == null || !frequency || !startDate)
        return err('יש למלא חדר, מטפל, שעת התחלה, שעת סיום, תדירות ותאריך התחלה', 400);
      if (!isId(roomId) || !isId(therapistId)) return err('שדות לא תקינים', 400);
      if (!isHour(startHour) || !isHour(endHour)) return err(HOURS_RANGE_MSG, 400);
      if (endHour <= startHour)
        return err('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 400);
      if (!['daily', 'weekly', 'monthly'].includes(frequency) || typeof startDate !== 'string' || isNaN(new Date(startDate)))
        return err('שדות לא תקינים', 400);
      if ((endDate != null && (typeof endDate !== 'string' || isNaN(new Date(endDate)))) ||
          (occurrences != null && !(Number.isInteger(occurrences) && occurrences >= 1 && occurrences <= 365)) ||
          (daysOfWeek != null && !(Array.isArray(daysOfWeek) && daysOfWeek.length <= 7 && daysOfWeek.every(d => Number.isInteger(d) && d >= 0 && d <= 6))) ||
          (note != null && typeof note !== 'string'))
        return err('שדות לא תקינים', 400);
      if (!endDate && !occurrences)
        return err('יש לבחור תאריך סיום או מספר מפגשים', 400);
      if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0))
        return err('יש לבחור לפחות יום אחד בשבוע', 400);

      // Generate all target dates
      const dates = generateDates({ frequency, daysOfWeek: daysOfWeek || [], startDate, endDate, occurrences });
      if (dates.length === 0)
        return err('לא נמצאו תאריכים בטווח שנבחר. בדקו את הגדרות הסדרה', 400);

      // Check conflicts for ALL dates in ONE query
      const [overlapping, pendingConflicts] = await Promise.all([
        prisma.scheduleSlot.findMany({
          where: {
            roomId,
            date: { in: dates },
            AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
          },
          include: { therapist: true },
        }),
        forcePending
          ? Promise.resolve([])
          : prisma.bookingRequest.findMany({
              where: { roomId, date: { in: dates }, status: 'pending', startHour: { lt: endHour }, endHour: { gt: startHour } },
            }),
      ]);

      if (overlapping.length > 0) {
        const conflicts = overlapping.map((s) => ({
          date: toDateStr(new Date(s.date)),
          therapist: s.therapist.name,
          startHour: s.startHour,
          endHour: s.endHour,
        }));
        return err(JSON.stringify({ conflicts }), 409);
      }

      if (pendingConflicts.length > 0) {
        return err(JSON.stringify({
          pendingConflict: true,
          conflicts: pendingConflicts.map(r => ({ date: toDateStr(new Date(r.date)), therapistName: r.therapistName, startHour: r.startHour, endHour: r.endHour })),
        }), 409);
      }

      // Create the RecurringSchedule record
      const recurring = await prisma.recurringSchedule.create({
        data: {
          roomId,
          therapistId,
          startHour,
          endHour,
          note: note || null,
          frequency,
          daysOfWeek: daysOfWeek || [],
          startDate: toMidnightUTC(startDate),
          endDate: endDate ? toMidnightUTC(endDate) : null,
          occurrences: occurrences || null,
        },
      });

      // Create all slots in one query
      await prisma.scheduleSlot.createMany({
        data: dates.map((date) => ({
          roomId,
          date,
          startHour,
          endHour,
          therapistId,
          note: note || null,
          recurringId: recurring.id,
        })),
      });

      // Fetch created slots with relations for the response
      const createdSlots = await prisma.scheduleSlot.findMany({
        where: { recurringId: recurring.id },
        include: { therapist: true, room: true },
        orderBy: { date: 'asc' },
      });

      return ok({ recurring, slots: createdSlots }, 201);
    }

    // PATCH /api/recurring/:id — update series metadata + all its slots
    if (httpMethod === 'PATCH') {
      const { path, headers } = event;
      const { checkAdmin } = require('./lib/helpers');
      if (!checkAdmin(headers)) return err('Unauthorized', 401);

      const parts = path.split('/').filter(Boolean);
      const id = parseInt(parts[parts.length - 1]);
      if (isNaN(id)) return err('מזהה הסדרה לא תקין', 400);

      const { roomId, therapistId, startHour, endHour, note, startDate, frequency, daysOfWeek, endDate, occurrences } = JSON.parse(body || '{}');
      if (!roomId || !therapistId || startHour == null || endHour == null)
        return err('יש למלא חדר, מטפל, שעת התחלה ושעת סיום', 400);
      if (!isId(id) || !isId(roomId) || !isId(therapistId)) return err('שדות לא תקינים', 400);
      if (!isHour(startHour) || !isHour(endHour)) return err(HOURS_RANGE_MSG, 400);
      if (endHour <= startHour)
        return err('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 400);
      if ((frequency != null && !['daily', 'weekly', 'monthly'].includes(frequency)) ||
          (startDate != null && (typeof startDate !== 'string' || isNaN(new Date(startDate)))) ||
          (endDate != null && endDate !== '' && (typeof endDate !== 'string' || isNaN(new Date(endDate)))) ||
          (occurrences != null && occurrences !== '' && !(Number.isInteger(occurrences) && occurrences >= 1 && occurrences <= 365)) ||
          (daysOfWeek != null && !(Array.isArray(daysOfWeek) && daysOfWeek.length <= 7 && daysOfWeek.every(d => Number.isInteger(d) && d >= 0 && d <= 6))) ||
          (note != null && typeof note !== 'string'))
        return err('שדות לא תקינים', 400);

      const existing = await prisma.recurringSchedule.findUnique({ where: { id } });
      if (!existing) return err('הסדרה לא נמצאה. ייתכן שהיא נמחקה', 404);

      const newFrequency = frequency || existing.frequency;
      const newDaysOfWeek = daysOfWeek !== undefined ? daysOfWeek : existing.daysOfWeek;
      const existingStartStr = toDateStr(new Date(existing.startDate));
      const newStartDate = startDate || existingStartStr;
      const existingEndStr = existing.endDate ? toDateStr(new Date(existing.endDate)) : null;
      const newEndDate = endDate !== undefined ? (endDate || null) : existingEndStr;
      const newOccurrences = occurrences !== undefined ? (occurrences || null) : existing.occurrences;

      // Always regenerate if any scheduling param changed
      const scheduleChanged =
        startDate !== undefined ||
        frequency !== undefined ||
        daysOfWeek !== undefined ||
        endDate !== undefined ||
        occurrences !== undefined;

      if (scheduleChanged) {
        const newDates = generateDates({
          frequency: newFrequency,
          daysOfWeek: newDaysOfWeek,
          startDate: newStartDate,
          endDate: newEndDate,
          occurrences: newOccurrences,
        });
        if (newDates.length === 0) return err('לא נמצאו תאריכים בטווח שנבחר. בדקו את הגדרות הסדרה', 400);

        // Check conflicts for new dates (exclude this series)
        const overlapping = await prisma.scheduleSlot.findMany({
          where: {
            roomId,
            date: { in: newDates },
            AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
            NOT: { recurringId: id },
          },
          include: { therapist: true },
        });
        if (overlapping.length > 0) {
          const conflicts = overlapping.map(s => ({ date: toDateStr(new Date(s.date)), therapist: s.therapist.name }));
          return err(JSON.stringify({ conflicts }), 409);
        }

        await prisma.scheduleSlot.deleteMany({ where: { recurringId: id } });
        await prisma.recurringSchedule.update({
          where: { id },
          data: {
            roomId, therapistId, startHour, endHour, note: note || null,
            frequency: newFrequency, daysOfWeek: newDaysOfWeek,
            startDate: toMidnightUTC(newStartDate),
            endDate: newEndDate ? toMidnightUTC(newEndDate) : null,
            occurrences: newOccurrences || null,
          },
        });
        await prisma.scheduleSlot.createMany({
          data: newDates.map(date => ({ roomId, date, startHour, endHour, therapistId, note: note || null, recurringId: id })),
        });
      } else {
        // Only room/therapist/hours/note changed — check conflicts on existing slot dates
        const seriesSlots = await prisma.scheduleSlot.findMany({ where: { recurringId: id } });
        // One query for the whole series (was one query per slot).
        const overlappingSlots = seriesSlots.length === 0 ? [] : await prisma.scheduleSlot.findMany({
          where: {
            roomId,
            date: { in: seriesSlots.map(s => s.date) },
            AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
            NOT: { recurringId: id },
          },
          include: { therapist: true },
        });
        const conflicts = overlappingSlots.map(s => ({ date: toDateStr(new Date(s.date)), therapist: s.therapist.name }));
        if (conflicts.length > 0) return err(JSON.stringify({ conflicts }), 409);

        await prisma.recurringSchedule.update({
          where: { id },
          data: { roomId, therapistId, startHour, endHour, note: note || null },
        });
        await prisma.scheduleSlot.updateMany({
          where: { recurringId: id },
          data: { roomId, therapistId, startHour, endHour, note: note || null },
        });
      }

      const updatedSlots = await prisma.scheduleSlot.findMany({
        where: { recurringId: id },
        include: { therapist: true, room: true, recurring: true },
        orderBy: { date: 'asc' },
      });
      return ok(updatedSlots);
    }

    // DELETE /api/recurring/:id — delete entire recurring series and all its slots
    if (httpMethod === 'DELETE') {
      const { path, headers } = event;
      const { checkAdmin } = require('./lib/helpers');
      if (!checkAdmin(headers)) return err('Unauthorized', 401);

      const parts = path.split('/').filter(Boolean);
      const id = parseInt(parts[parts.length - 1]);
      if (isNaN(id)) return err('מזהה הסדרה לא תקין', 400);

      const existing = await prisma.recurringSchedule.findUnique({ where: { id } });
      if (!existing) return err('הסדרה לא נמצאה. ייתכן שהיא נמחקה', 404);

      await prisma.scheduleSlot.deleteMany({ where: { recurringId: id } });
      await prisma.recurringSchedule.delete({ where: { id } });

      return ok({ deleted: id });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return handleError(e, 'recurring');
  }
};
