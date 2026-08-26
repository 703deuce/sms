-- Mass Texting V1 billing + shared inbox product metadata
-- Apply after prisma schema sync

DO $$ BEGIN
  CREATE TYPE "MassTextingLifecycleState" AS ENUM (
    'TRIAL_PENDING_A2P',
    'TRIAL_ACTIVE',
    'TRIAL_LIMIT_REACHED',
    'TRIAL_EXPIRED',
    'CONVERSION_SELECTED',
    'PAYMENT_REQUIRED',
    'PRODUCTION_A2P_PENDING',
    'PRODUCTION_ACTIVE',
    'CANCELED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MassTextA2pFeeStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'WAIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MassTextCreditReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConversationProductSource" AS ENUM ('MCTB', 'MASS_TEXT', 'MANUAL', 'AUTOMATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessagingProductUseCase" AS ENUM ('MCTB_CUSTOMER_CARE', 'MASS_TEXT_MARKETING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "productSource" "ConversationProductSource";
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "phoneNumberId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "fromE164" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "missedCallEventId" TEXT;

ALTER TABLE "ConversationMessage" ADD COLUMN IF NOT EXISTS "fromE164" TEXT;
ALTER TABLE "ConversationMessage" ADD COLUMN IF NOT EXISTS "campaignMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "Conversation_workspaceId_productSource_updatedAt_idx"
  ON "Conversation" ("workspaceId", "productSource", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_workspaceId_phoneNumberId_updatedAt_idx"
  ON "Conversation" ("workspaceId", "phoneNumberId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_workspaceId_campaignId_idx"
  ON "Conversation" ("workspaceId", "campaignId");

CREATE TABLE IF NOT EXISTS "messaging_product_registrations" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "productUseCase" "MessagingProductUseCase" NOT NULL,
  "overallStatus" TEXT NOT NULL DEFAULT 'not_started',
  "messagingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "messagingProvider" TEXT,
  "messagingProfileId" TEXT,
  "phoneNumberId" TEXT,
  "brandId" TEXT,
  "campaignId" TEXT,
  "brandStatusRaw" TEXT,
  "campaignStatusRaw" TEXT,
  "phoneE164" TEXT,
  "phoneAttached" BOOLEAN NOT NULL DEFAULT false,
  "useCaseDescription" TEXT,
  "sampleMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "optInDescription" TEXT,
  "helpMessage" TEXT,
  "stopMessage" TEXT,
  "campaignDisplayName" TEXT,
  "registrationSubmittedAt" TIMESTAMP(3),
  "registrationApprovedAt" TIMESTAMP(3),
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "registrationFailureReason" TEXT,
  "certifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspaceId", "productUseCase")
);

CREATE TABLE IF NOT EXISTS "list_import_attestations" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" TEXT,
  "listId" TEXT,
  "listName" TEXT,
  "contactCount" INTEGER NOT NULL DEFAULT 0,
  "attestationVersion" TEXT NOT NULL DEFAULT 'mass_text_list_v1',
  "attestationText" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'csv_import',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "campaign_launch_audits" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "campaignId" TEXT NOT NULL,
  "launchedByUserId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "rawContactCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateRemoved" INTEGER NOT NULL DEFAULT 0,
  "invalidRemoved" INTEGER NOT NULL DEFAULT 0,
  "suppressedRemoved" INTEGER NOT NULL DEFAULT 0,
  "finalRecipientCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedSegments" INTEGER NOT NULL DEFAULT 0,
  "estimatedCreditsCents" INTEGER NOT NULL DEFAULT 0,
  "phoneNumberId" TEXT,
  "phoneE164" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  UNIQUE ("workspaceId", "idempotencyKey")
);

CREATE TABLE IF NOT EXISTS "mass_texting_billing_accounts" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "lifecycleState" "MassTextingLifecycleState" NOT NULL DEFAULT 'TRIAL_PENDING_A2P',
  "billingModel" TEXT,
  "monthlyPlanTier" TEXT,
  "monthlySegmentsIncluded" INTEGER NOT NULL DEFAULT 0,
  "monthlySegmentsUsed" INTEGER NOT NULL DEFAULT 0,
  "paygCreditsSegments" INTEGER NOT NULL DEFAULT 0,
  "paygLineActive" BOOLEAN NOT NULL DEFAULT false,
  "a2pFeeStatus" "MassTextA2pFeeStatus" NOT NULL DEFAULT 'PENDING',
  "trialSegmentsUsed" INTEGER NOT NULL DEFAULT 0,
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "billingPeriodStart" TIMESTAMP(3),
  "billingPeriodEnd" TIMESTAMP(3),
  "stripeSubscriptionId" TEXT,
  "additionalNumbers" INTEGER NOT NULL DEFAULT 0,
  "pricingVersion" INTEGER NOT NULL DEFAULT 1,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "mass_texting_credit_reservations" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "billingAccountId" TEXT NOT NULL REFERENCES "mass_texting_billing_accounts"("id") ON DELETE CASCADE,
  "campaignId" TEXT NOT NULL,
  "reservedSegments" INTEGER NOT NULL,
  "status" "MassTextCreditReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "mass_texting_billing_events" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT REFERENCES "Workspace"("id") ON DELETE SET NULL,
  "stripeEventId" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "mass_texting_billing_accounts_lifecycleState_idx"
  ON "mass_texting_billing_accounts" ("lifecycleState");
CREATE INDEX IF NOT EXISTS "mass_texting_credit_reservations_workspaceId_campaignId_idx"
  ON "mass_texting_credit_reservations" ("workspaceId", "campaignId");

-- Backfill existing open conversations without product source as manual (MCTB recovery tagged separately at runtime)
UPDATE "Conversation"
SET "productSource" = 'MANUAL'
WHERE "productSource" IS NULL;
