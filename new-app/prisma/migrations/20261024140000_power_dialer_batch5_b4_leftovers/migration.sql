-- Batch 5 + B4 leftovers: list consent basis, script team assignment
ALTER TABLE "ContactList" ADD COLUMN IF NOT EXISTS "dialConsentJson" JSONB;
ALTER TABLE "power_dialer_scripts" ADD COLUMN IF NOT EXISTS "assignment_json" JSONB;
