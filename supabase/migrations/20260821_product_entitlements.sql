-- Multi-product entitlements (Voice / Numbers / SMS add-on)
-- Run in Supabase SQL editor or via migration tooling before using /app launcher.

DO $$ BEGIN
  CREATE TYPE "ProductKey" AS ENUM ('SMS', 'NUMBERS', 'VOICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductAccessStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveProduct" "ProductKey";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "productIntent" "ProductKey";

CREATE TABLE IF NOT EXISTS "ProductEntitlement" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "productKey" "ProductKey" NOT NULL,
  "status" "ProductAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEntitlement_workspaceId_productKey_key" UNIQUE ("workspaceId", "productKey")
);

CREATE INDEX IF NOT EXISTS "ProductEntitlement_workspaceId_idx"
  ON "ProductEntitlement"("workspaceId");

CREATE INDEX IF NOT EXISTS "ProductEntitlement_productKey_status_idx"
  ON "ProductEntitlement"("productKey", "status");
