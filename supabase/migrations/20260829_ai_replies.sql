-- AI Replies V1 — conversational SMS auto-responder

CREATE TABLE IF NOT EXISTS ai_replies (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  "replyType" TEXT NOT NULL DEFAULT 'conversational',
  "phoneNumberId" TEXT,
  status TEXT NOT NULL DEFAULT 'paused',
  tone TEXT NOT NULL DEFAULT 'professional',
  "responseLength" TEXT NOT NULL DEFAULT 'medium',
  "systemPrompt" TEXT NOT NULL,
  "triggerConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "knowledgeConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "leadConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "handoffConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "advancedConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "messagesSent" INTEGER NOT NULL DEFAULT 0,
  "contactsEngaged" INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  handoffs INTEGER NOT NULL DEFAULT 0,
  "lastTriggeredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_reply_sessions (
  id TEXT PRIMARY KEY,
  "aiReplyId" TEXT NOT NULL REFERENCES ai_replies(id) ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ai_active',
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  replied BOOLEAN NOT NULL DEFAULT false,
  "handedOff" BOOLEAN NOT NULL DEFAULT false,
  "leadCaptured" BOOLEAN NOT NULL DEFAULT false,
  "lastMessageAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("aiReplyId", "conversationId")
);

CREATE TABLE IF NOT EXISTS ai_reply_message_logs (
  id TEXT PRIMARY KEY,
  "aiReplyId" TEXT NOT NULL REFERENCES ai_replies(id) ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "conversationId" TEXT,
  "contactId" TEXT,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  "knowledgeUsed" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_replies_workspace_status_idx ON ai_replies ("workspaceId", status);
CREATE INDEX IF NOT EXISTS ai_reply_sessions_workspace_conversation_idx ON ai_reply_sessions ("workspaceId", "conversationId");
CREATE INDEX IF NOT EXISTS ai_reply_sessions_conversation_status_idx ON ai_reply_sessions ("conversationId", status);
CREATE INDEX IF NOT EXISTS ai_reply_message_logs_reply_created_idx ON ai_reply_message_logs ("aiReplyId", "createdAt");
