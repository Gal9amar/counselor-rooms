// Single-statement read queries for the hot GET paths.
//
// Why raw SQL: with `pgbouncer=true` every Prisma call costs ~5 network round trips (BEGIN, DEALLOCATE ALL,
// parse, execute, COMMIT) and `include` adds one extra Prisma call per relation (measured: findMany with 3
// relations = 11 round trips). One JOINed statement is a fixed ~5 round trips whatever the relations are.
// The JSON shapes below are field-for-field identical to what Prisma `include` returned (dates as ISO strings
// ending in Z), so the client does not change.
const { Prisma } = require('./prisma-pkg'); // must be the same package copy as the shared Prisma client
const { toMidnightUTC } = require('./helpers');

// timestamp(3) columns hold UTC; this is exactly what JSON.stringify(Date) prints.
const iso = (col) => Prisma.raw(`to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);

const ROOM_JSON = Prisma.sql`json_build_object('id', r.id, 'name', r.name, 'order', r."order", 'createdAt', ${iso('r."createdAt"')})`;
const THERAPIST_JSON = Prisma.sql`json_build_object('id', t.id, 'name', t.name, 'createdAt', ${iso('t."createdAt"')})`;
const NOTE_JSON = Prisma.sql`json_build_object(
  'id', n.id, 'roomId', n."roomId", 'message', n.message, 'startDate', ${iso('n."startDate"')}, 'endDate', ${iso('n."endDate"')},
  'startHour', n."startHour", 'endHour', n."endHour", 'blocksBooking', n."blocksBooking", 'createdAt', ${iso('n."createdAt"')})`;

// ScheduleSlot + therapist + room + recurring (aliases s, t, r, rs). FKs are NOT NULL, so INNER JOINs match `include`.
const SLOT_FROM = Prisma.sql`FROM "ScheduleSlot" s
  JOIN "Therapist" t ON t.id = s."therapistId"
  JOIN "Room" r ON r.id = s."roomId"
  LEFT JOIN "RecurringSchedule" rs ON rs.id = s."recurringId"`;
const SLOT_JSON = Prisma.sql`json_build_object(
  'id', s.id, 'roomId', s."roomId", 'date', ${iso('s.date')}, 'startHour', s."startHour", 'endHour', s."endHour",
  'therapistId', s."therapistId", 'note', s.note, 'recurringId', s."recurringId", 'createdAt', ${iso('s."createdAt"')},
  'therapist', ${THERAPIST_JSON},
  'room', ${ROOM_JSON},
  'recurring', CASE WHEN rs.id IS NULL THEN NULL ELSE json_build_object(
    'id', rs.id, 'roomId', rs."roomId", 'therapistId', rs."therapistId", 'startHour', rs."startHour", 'endHour', rs."endHour",
    'note', rs.note, 'frequency', rs.frequency, 'daysOfWeek', rs."daysOfWeek",
    'startDate', ${iso('rs."startDate"')}, 'endDate', ${iso('rs."endDate"')}, 'occurrences', rs.occurrences,
    'createdAt', ${iso('rs."createdAt"')}) END)`;
const SLOT_ORDER = Prisma.sql`s.date ASC, s."startHour" ASC, s.id ASC`;

// Same filters as before (roomId, date | from/to) plus an optional therapistId. Returns { where } or { error }.
function slotFilters(qs = {}) {
  const conds = [];
  if (qs.roomId) {
    const roomId = parseInt(qs.roomId, 10);
    if (!Number.isInteger(roomId) || roomId > 2147483647) return { error: 'roomId לא תקין' };
    conds.push(Prisma.sql`s."roomId" = ${roomId}`);
  }
  if (qs.therapistId) {
    const therapistId = parseInt(qs.therapistId, 10);
    if (!Number.isInteger(therapistId) || therapistId > 2147483647) return { error: 'therapistId לא תקין' };
    conds.push(Prisma.sql`s."therapistId" = ${therapistId}`);
  }
  const day = (v) => {
    const d = toMidnightUTC(v);
    return isNaN(d) ? null : d;
  };
  if (qs.date) {
    const d = day(qs.date);
    if (!d) return { error: 'תאריך לא תקין' };
    conds.push(Prisma.sql`s.date = ${d}`);
  } else {
    if (qs.from) {
      const d = day(qs.from);
      if (!d) return { error: 'תאריך לא תקין' };
      conds.push(Prisma.sql`s.date >= ${d}`);
    }
    if (qs.to) {
      const d = day(qs.to);
      if (!d) return { error: 'תאריך לא תקין' };
      conds.push(Prisma.sql`s.date <= ${d}`);
    }
  }
  return { where: conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty };
}

const REQUEST_JSON = Prisma.sql`json_build_object(
  'id', b.id, 'therapistName', b."therapistName", 'roomId', b."roomId", 'date', ${iso('b.date')},
  'startHour', b."startHour", 'endHour', b."endHour", 'note', b.note, 'status', b.status, 'bookingType', b."bookingType",
  'recurFrequency', b."recurFrequency", 'recurDays', b."recurDays", 'recurEndDate', ${iso('b."recurEndDate"')},
  'recurOccurrences', b."recurOccurrences", 'createdAt', ${iso('b."createdAt"')},
  'room', json_build_object('id', r.id, 'name', r.name))`;

module.exports = { iso, ROOM_JSON, THERAPIST_JSON, NOTE_JSON, SLOT_FROM, SLOT_JSON, SLOT_ORDER, slotFilters, REQUEST_JSON };
