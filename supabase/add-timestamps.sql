-- Add createdAt + updatedAt to every Transovo app table.
--
-- Why: the Supabase data layer (src/lib/supabase/prisma-compat.ts → prepareData)
-- stamps "updatedAt" on EVERY insert/update and "createdAt" on every insert, for
-- all models. Several tables were created without those columns, so writes fail with:
--   PGRST204  Could not find the 'updatedAt' column of '<Table>' in the schema cache
--
-- This migration is idempotent and non-destructive (safe to run multiple times).
-- Paste it into the Supabase SQL editor and run it.

DO $$
DECLARE
  t text;
  app_tables text[] := ARRAY[
    'User','Workspace','Membership','PhoneNumber','Contact','ContactList','ContactListMember',
    'Segment','Tag','ContactTag','Campaign','Message','messaging_registrations',
    'messaging_registration_events','campaign_recipients','campaign_messages',
    'review_request_suppression','job_queue','integration_webhook_endpoints',
    'integration_webhook_events','Conversation','ConversationMessage','Template',
    'AutomationFlow','Keyword','OptInForm','ConsentRecord','ComplianceBrand',
    'ComplianceCampaign','ApiKey','Webhook','AuditLog','UsageRecord'
  ];
BEGIN
  FOREACH t IN ARRAY app_tables LOOP
    EXECUTE format(
      'ALTER TABLE IF EXISTS %I ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
      t
    );
    EXECUTE format(
      'ALTER TABLE IF EXISTS %I ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
      t
    );
  END LOOP;
END $$;

-- Refresh PostgREST's cached schema so the new columns are visible immediately.
NOTIFY pgrst, 'reload schema';
