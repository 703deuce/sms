-- Forwarding destinations: external phone vs workspace-owned number

ALTER TABLE "forwarding_destinations" ADD COLUMN "destinationKind" TEXT NOT NULL DEFAULT 'external_phone';
ALTER TABLE "forwarding_destinations" ADD COLUMN "workspacePhoneNumberId" TEXT;

ALTER TABLE "forwarding_destinations" ALTER COLUMN "phoneE164" DROP NOT NULL;

UPDATE "forwarding_destinations"
SET "destinationKind" = 'external_phone'
WHERE "destinationKind" IS NULL OR "destinationKind" = '';

CREATE UNIQUE INDEX "forwarding_destinations_workspaceId_workspacePhoneNumberId_key"
ON "forwarding_destinations"("workspaceId", "workspacePhoneNumberId")
WHERE "workspacePhoneNumberId" IS NOT NULL;

ALTER TABLE "forwarding_destinations"
ADD CONSTRAINT "forwarding_destinations_workspacePhoneNumberId_fkey"
FOREIGN KEY ("workspacePhoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
