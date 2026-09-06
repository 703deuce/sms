-- Enforce unique provider-import identity per workspace (nullable externalId allows multiple NULL rows in Postgres).
-- Keep the newest row when historical duplicates exist.
DELETE FROM "voice_appointments" a
WHERE a."externalId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "voice_appointments" b
    WHERE b."workspaceId" = a."workspaceId"
      AND b."externalId" = a."externalId"
      AND b."id" > a."id"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "voice_appointments_workspaceId_externalId_key"
  ON "voice_appointments" ("workspaceId", "externalId");
