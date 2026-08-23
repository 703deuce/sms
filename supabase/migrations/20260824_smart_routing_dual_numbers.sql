-- Smart Routing V1: separate inbound Routing Number from Business Callback Number
-- Prisma column names (camelCase). Safe to re-run.

ALTER TABLE smart_routing_workspace_settings
  ADD COLUMN IF NOT EXISTS "callbackNumberE164" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedCallbackPhoneNumberId" TEXT;

COMMENT ON COLUMN smart_routing_workspace_settings."callbackNumberE164" IS
  'Private employee-only number for Business Callback (not customer forwarding)';

COMMENT ON COLUMN smart_routing_workspace_settings."assignedCallbackPhoneNumberId" IS
  'PhoneNumber row id for the workspace Business Callback Number';
