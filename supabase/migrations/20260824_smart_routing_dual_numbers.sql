-- Smart Routing V1: separate inbound Routing Number from Business Callback Number

ALTER TABLE smart_routing_workspace_settings
  ADD COLUMN IF NOT EXISTS callback_number_e164 TEXT,
  ADD COLUMN IF NOT EXISTS assigned_callback_phone_number_id TEXT;

COMMENT ON COLUMN smart_routing_workspace_settings.callback_number_e164 IS
  'Private employee-only number for Business Callback (not customer forwarding)';
COMMENT ON COLUMN smart_routing_workspace_settings.assigned_callback_phone_number_id IS
  'PhoneNumber row id for the workspace Business Callback Number';
