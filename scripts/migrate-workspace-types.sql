-- Backfill workspace types for Personal/Business split.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceType') THEN
    CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'BUSINESS');
  END IF;
END$$;

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "type" "WorkspaceType" NOT NULL DEFAULT 'BUSINESS';

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Workspace_ownerUserId_idx" ON "Workspace" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "Workspace_type_idx" ON "Workspace" ("type");

-- Existing customers remain business workspaces.
UPDATE "Workspace" SET "type" = 'BUSINESS' WHERE "type" IS NULL;
