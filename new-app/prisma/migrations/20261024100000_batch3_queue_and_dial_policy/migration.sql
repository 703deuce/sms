-- Batch 3: queue ordering on list members + workspace dial policy columns

ALTER TABLE "ContactListMember" ADD COLUMN IF NOT EXISTS "dialPriority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContactListMember" ADD COLUMN IF NOT EXISTS "queueSortOrder" INTEGER;

CREATE INDEX IF NOT EXISTS "ContactListMember_listId_dialPriority_idx" ON "ContactListMember"("listId", "dialPriority" DESC);

ALTER TABLE "workspace_crm_settings" ADD COLUMN IF NOT EXISTS "dialPolicyJson" JSONB;
