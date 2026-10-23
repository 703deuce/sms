/**
 * B7 prep — native ↔ Salesforce/Zoho/Pipedrive field ownership.
 *
 * 1. CrmFieldLock with owner `user_edit` blocks inbound CRM overwrite for that fieldKey.
 * 2. Inbound CRM sync may fill empty native fields only when no lock exists.
 * 3. User-edited native values always win on conflict (lock created on PATCH).
 * 4. External ID mappings (lib/crm/mappings) prevent duplicate Contact rows.
 */

export const CRM_SYNC_PRECEDENCE = {
  inbound: "fill_empty_unless_user_lock",
  outbound: "push_native_when_mapped",
} as const;
