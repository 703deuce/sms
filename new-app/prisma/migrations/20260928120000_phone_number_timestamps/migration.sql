-- Align PhoneNumber with Prisma @updatedAt usage (onboarding, vault hub, try-it phone resolution).
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prefer purchasedAt when present for historical rows.
UPDATE "PhoneNumber"
SET "createdAt" = COALESCE("purchasedAt", "createdAt"),
    "updatedAt" = COALESCE("purchasedAt", "updatedAt")
WHERE "purchasedAt" IS NOT NULL;
