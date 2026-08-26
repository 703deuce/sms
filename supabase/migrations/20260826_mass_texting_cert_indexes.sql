-- Mass Texting certification indexes (additive, concurrent-safe).
CREATE INDEX IF NOT EXISTS "Campaign_workspaceId_status_idx" ON "Campaign" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "Campaign_workspaceId_scheduledAt_idx" ON "Campaign" ("workspaceId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "campaign_recipients_contactId_idx" ON "campaign_recipients" ("contactId");
CREATE INDEX IF NOT EXISTS "campaign_messages_providerId_idx" ON "campaign_messages" ("providerId");
CREATE INDEX IF NOT EXISTS "campaign_messages_workspaceId_createdAt_idx" ON "campaign_messages" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "Conversation_workspaceId_contactId_productSource_idx" ON "Conversation" ("workspaceId", "contactId", "productSource");
CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage" ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContactList_workspaceId_idx" ON "ContactList" ("workspaceId");
CREATE INDEX IF NOT EXISTS "Template_workspaceId_idx" ON "Template" ("workspaceId");
