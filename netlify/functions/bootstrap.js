// GET /api/bootstrap?from=YYYY-MM-DD&to=YYYY-MM-DD
// Everything a page needs on load in ONE function call and ONE SQL statement:
//   { rooms, therapists, roomNotes, slots }
// Each part has exactly the shape of its own endpoint (GET /rooms, /therapists, /room-notes, /schedule?from&to),
// so a page can swap its 3-4 parallel requests for this one. Replaces up to 4 cold starts / 4 DB connections /
// ~26 network round trips with 1 / 1 / ~5 (measured against the Singapore database).
// Needs the redirect  /api/bootstrap -> /.netlify/functions/bootstrap  in netlify.toml.
const prisma = require('./lib/prisma');
const { ok, err, cors } = require('./lib/helpers');
const { ROOM_JSON, THERAPIST_JSON, NOTE_JSON, SLOT_JSON, SLOT_FROM, SLOT_ORDER, slotFilters } = require('./lib/sql');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  try {
    const qs = event.queryStringParameters || {};
    // Only the date range filters apply here (a room/therapist filter makes no sense for a whole-app load).
    const f = slotFilters({ from: qs.from, to: qs.to });
    if (f.error) return err(f.error, 400);
    const [row] = await prisma.$queryRaw`
      SELECT
        (SELECT coalesce(json_agg(${ROOM_JSON} ORDER BY r."order", r.name), '[]'::json) FROM "Room" r) AS rooms,
        (SELECT coalesce(json_agg(${THERAPIST_JSON} ORDER BY t.name), '[]'::json) FROM "Therapist" t) AS therapists,
        (SELECT coalesce(json_agg(${NOTE_JSON} ORDER BY n."startDate"), '[]'::json) FROM "RoomNote" n) AS notes,
        (SELECT coalesce(json_agg(${SLOT_JSON} ORDER BY ${SLOT_ORDER}), '[]'::json) ${SLOT_FROM} ${f.where}) AS slots`;
    return ok({ rooms: row.rooms, therapists: row.therapists, roomNotes: row.notes, slots: row.slots });
  } catch (e) {
    console.error('bootstrap error:', e.message);
    return err('אירעה תקלה בשרת. נסו שוב בעוד רגע', 500);
  }
};
