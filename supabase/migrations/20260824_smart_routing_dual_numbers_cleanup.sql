-- Remove mistaken snake_case columns from legacy dual-numbers SQL (Prisma uses camelCase).

ALTER TABLE smart_routing_workspace_settings
  DROP COLUMN IF EXISTS callback_number_e164,
  DROP COLUMN IF EXISTS assigned_callback_phone_number_id;
