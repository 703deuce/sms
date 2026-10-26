-- B2b additive columns. Rollback: drop columns below.

ALTER TABLE "crm_deals" ADD COLUMN IF NOT EXISTS "closeTargetAt" TIMESTAMP(3);
ALTER TABLE "crm_deals" ADD COLUMN IF NOT EXISTS "nextStep" TEXT;

ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "reminderAt" TIMESTAMP(3);

ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "dialedPhoneE164" TEXT;
