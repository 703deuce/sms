-- Run on production ONLY after `prisma migrate resolve --rolled-back 20261023150000_power_dialer_phase4`
-- if a failed deploy left partial Phase 4 objects (wrong FK attempt or half-applied DDL).

DROP TABLE IF EXISTS "power_dialer_callbacks" CASCADE;
DROP TABLE IF EXISTS "power_dialer_voicemail_drops" CASCADE;
DROP TABLE IF EXISTS "power_dialer_scripts" CASCADE;
DROP TABLE IF EXISTS "power_dialer_dispositions" CASCADE;
DROP TABLE IF EXISTS "power_dialer_disposition_sets" CASCADE;

ALTER TABLE "power_dialer_attempts" DROP COLUMN IF EXISTS "dispositionId";
ALTER TABLE "power_dialer_attempts" DROP COLUMN IF EXISTS "voicemailDropSentAt";
ALTER TABLE "ContactList" DROP COLUMN IF EXISTS "filtersJson";
