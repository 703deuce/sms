-- B1 carry-overs + B2 native mini CRM (additive). Rollback: drop new tables/columns in reverse order.

-- Contact extensions
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadSource" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadStage" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "crmCompanyId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "timezoneInferred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Contact_workspaceId_ownerUserId_idx" ON "Contact"("workspaceId", "ownerUserId");
CREATE INDEX IF NOT EXISTS "Contact_workspaceId_folderId_idx" ON "Contact"("workspaceId", "folderId");

-- Power dialer attempt extensions
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "vmDeliveryMode" TEXT;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "callRating" INTEGER;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "acwDeadlineAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "power_dialer_session_presets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'user',
    "name" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_session_presets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "power_dialer_session_presets_workspaceId_ownerUserId_idx" ON "power_dialer_session_presets"("workspaceId", "ownerUserId");
ALTER TABLE "power_dialer_session_presets" ADD CONSTRAINT "power_dialer_session_presets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "workspace_crm_settings" (
    "workspaceId" TEXT NOT NULL,
    "defaultCountryCode" TEXT NOT NULL DEFAULT 'US',
    "allowedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inboundContactRules" JSONB,
    "phoneFallthroughMode" TEXT NOT NULL DEFAULT 'next_number',
    "prefsJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_crm_settings_pkey" PRIMARY KEY ("workspaceId")
);
ALTER TABLE "workspace_crm_settings" ADD CONSTRAINT "workspace_crm_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_companies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "phone" TEXT,
    "ownerUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_companies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_companies_workspaceId_name_idx" ON "crm_companies"("workspaceId", "name");
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_deal_stages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isClosedWon" BOOLEAN NOT NULL DEFAULT false,
    "isClosedLost" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "crm_deal_stages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_deal_stages_workspaceId_sortOrder_idx" ON "crm_deal_stages"("workspaceId", "sortOrder");
ALTER TABLE "crm_deal_stages" ADD CONSTRAINT "crm_deal_stages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_deals" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_deals_workspaceId_stageId_idx" ON "crm_deals"("workspaceId", "stageId");
CREATE INDEX IF NOT EXISTS "crm_deals_contactId_idx" ON "crm_deals"("contactId");
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "crm_deal_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "assigneeUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_tasks_workspaceId_dueAt_idx" ON "crm_tasks"("workspaceId", "dueAt");
CREATE INDEX IF NOT EXISTS "crm_tasks_assigneeUserId_status_idx" ON "crm_tasks"("assigneeUserId", "status");
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_appointments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_appointments_workspaceId_startsAt_idx" ON "crm_appointments"("workspaceId", "startsAt");
ALTER TABLE "crm_appointments" ADD CONSTRAINT "crm_appointments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_appointments" ADD CONSTRAINT "crm_appointments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_appointments" ADD CONSTRAINT "crm_appointments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contact_phones" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'mobile',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_phones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_phones_contactId_e164_key" ON "contact_phones"("contactId", "e164");
CREATE INDEX IF NOT EXISTS "contact_phones_contactId_priority_idx" ON "contact_phones"("contactId", "priority");
ALTER TABLE "contact_phones" ADD CONSTRAINT "contact_phones_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contact_folders" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contact_folders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contact_folders_workspaceId_parentId_idx" ON "contact_folders"("workspaceId", "parentId");
ALTER TABLE "contact_folders" ADD CONSTRAINT "contact_folders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_folders" ADD CONSTRAINT "contact_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "contact_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contact_saved_views" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_saved_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contact_saved_views_workspaceId_ownerUserId_idx" ON "contact_saved_views"("workspaceId", "ownerUserId");
ALTER TABLE "contact_saved_views" ADD CONSTRAINT "contact_saved_views_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_custom_field_definitions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "optionsJson" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "crm_custom_field_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_custom_field_definitions_workspaceId_key_key" ON "crm_custom_field_definitions"("workspaceId", "key");
ALTER TABLE "crm_custom_field_definitions" ADD CONSTRAINT "crm_custom_field_definitions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_custom_field_values" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueJson" JSONB,
    CONSTRAINT "crm_custom_field_values_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_custom_field_values_contactId_fieldId_key" ON "crm_custom_field_values"("contactId", "fieldId");
ALTER TABLE "crm_custom_field_values" ADD CONSTRAINT "crm_custom_field_values_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_custom_field_values" ADD CONSTRAINT "crm_custom_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "crm_custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contact_activity_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_activity_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contact_activity_events_contactId_occurredAt_idx" ON "contact_activity_events"("contactId", "occurredAt");
ALTER TABLE "contact_activity_events" ADD CONSTRAINT "contact_activity_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_activity_events" ADD CONSTRAINT "contact_activity_events_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "contact_merge_records" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "primaryContactId" TEXT NOT NULL,
    "mergedContactId" TEXT NOT NULL,
    "mergedSnapshot" JSONB NOT NULL,
    "mergedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_merge_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contact_merge_records_workspaceId_primaryContactId_idx" ON "contact_merge_records"("workspaceId", "primaryContactId");
ALTER TABLE "contact_merge_records" ADD CONSTRAINT "contact_merge_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_merge_records" ADD CONSTRAINT "contact_merge_records_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_field_locks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_field_locks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_field_locks_contactId_fieldKey_key" ON "crm_field_locks"("contactId", "fieldKey");
ALTER TABLE "crm_field_locks" ADD CONSTRAINT "crm_field_locks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_field_locks" ADD CONSTRAINT "crm_field_locks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_crmCompanyId_fkey" FOREIGN KEY ("crmCompanyId") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "contact_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
