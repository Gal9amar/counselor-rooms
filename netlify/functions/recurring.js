const prisma = require('./lib/prisma');
const { ok, err, cors, toMidnightUTC, toDateStr, generateDates } = require('./lib/helpers');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const { httpMethod, body } = event;

  try {
    // POST /api/recurring — create a new recurring series
    if (httpMethod === 'POST') {
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
      } = JSON.parse(body || '{}');

      // Validate required fields
      if (!roomId || !therapistId || startHour == null || endHour == null || !frequency || !startDate)
        return err('roomId, therapistId, startHour, endHour, frequency, startDate נדרשים', 400);
      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);
      if (!endDate && !occurrences)
        return err('יש לספק endDate או occurrences', 400);
      if (frequency === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0))
        return err('יש לבחור לפחות יום אחד בשבוע', 400);

      // Generate all target dates
      const dates = generateDates({ frequency, daysOfWeek: daysOfWeek || [], startDate, endDate, occurrences });
      if (dates.length === 0)
        return err('לא נמצאו תאריכים בטווח שהוגדר', 400);

      // Check conflicts for ALL dates in ONE query
      const overlapping = await prisma.scheduleSlot.findMany({
        where: {
          roomId,
          date: { in: dates },
          AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
        },
        include: { therapist: true },
      });

      if (overlapping.length > 0) {
        const conflicts = overlapping.map((s) => ({
          date: toDateStr(new Date(s.date)),
          therapist: s.therapist.name,
          startHour: s.startHour,
          endHour: s.endHour,
        }));
        return err(JSON.stringify({ conflicts }), 409);
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
      if (isNaN(id)) return err('id לא תקין', 400);

      const { roomId, therapistId, startHour, endHour, note, startDate, frequency, daysOfWeek, endDate, occurrences } = JSON.parse(body || '{}');
      if (!roomId || !therapistId || startHour == null || endHour == null)
        return err('roomId, therapistId, startHour, endHour נדרשים', 400);
      if (endHour <= startHour)
        return err('שעת סיום חייבת להיות אחרי שעת התחלה', 400);

      const existing = await prisma.recurringSchedule.findUnique({ where: { id } });
      if (!existing) return err('סדרה לא נמצאה', 404);

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
        if (newDates.length === 0) return err('לא נמצאו תאריכים בטווח שהוגדר', 400);

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
        const conflicts = [];
        for (const slot of seriesSlots) {
          const overlapping = await prisma.scheduleSlot.findFirst({
            where: {
              id: { not: slot.id },
              roomId,
              date: slot.date,
              AND: [{ startHour: { lt: endHour } }, { endHour: { gt: startHour } }],
            },
            include: { therapist: true },
          });
          if (overlapping) conflicts.push({ date: toDateStr(new Date(slot.date)), therapist: overlapping.therapist.name });
        }
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
      if (isNaN(id)) return err('id לא תקין', 400);

      const existing = await prisma.recurringSchedule.findUnique({ where: { id } });
      if (!existing) return err('סדרה לא נמצאה', 404);

      await prisma.scheduleSlot.deleteMany({ where: { recurringId: id } });
      await prisma.recurringSchedule.delete({ where: { id } });

      return ok({ deleted: id });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err(e.message);
  }
};
