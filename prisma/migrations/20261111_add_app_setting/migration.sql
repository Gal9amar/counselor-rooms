-- Key/value application settings (first use: booking-request notification email, managed from the admin panel).
CREATE TABLE "AppSetting" (
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- Same posture as every other table in this database: RLS on, no policies (only the server role/Prisma reads it,
-- never the public PostgREST API - the notification address is personal data).
ALTER TABLE "AppSetting" ENABLE ROW LEVEL SECURITY;

-- Defence in depth: the default ACL in schema public grants anon/authenticated full access to new tables.
-- Prisma connects as the table owner, so revoking costs nothing and removes the PostgREST exposure entirely.
REVOKE ALL ON TABLE "AppSetting" FROM anon, authenticated;
