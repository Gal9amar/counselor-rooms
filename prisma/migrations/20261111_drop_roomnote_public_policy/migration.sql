-- RoomNote had a policy "service_role_full_access" granted to role PUBLIC (cmd ALL, using true), which let anyone holding the
-- public anon key read/write/delete management notes through Supabase PostgREST. The app only reaches the table through Prisma
-- (table owner), so no policy is needed. Apply manually in the Supabase SQL editor (production has no _prisma_migrations table).
DROP POLICY "service_role_full_access" ON "RoomNote";
