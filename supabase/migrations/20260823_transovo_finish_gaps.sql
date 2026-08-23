-- Transovo finish gaps: MCTB request form, link tracking, direct dial, VM transcript English

ALTER TABLE missed_call_text_configs
  ADD COLUMN IF NOT EXISTS "directDialForwardE164" TEXT,
  ADD COLUMN IF NOT EXISTS "requestFormEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requestFormToken" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultLinkUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "leadCaptureEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requestFormFieldsJson" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS missed_call_text_configs_request_form_token_idx
  ON missed_call_text_configs ("requestFormToken")
  WHERE "requestFormToken" IS NOT NULL;

CREATE TABLE IF NOT EXISTS mctb_request_form_submissions (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "missedCallEventId" TEXT,
  "contactId" TEXT,
  "formToken" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mctb_request_form_submissions_workspace_idx
  ON mctb_request_form_submissions ("workspaceId", "submittedAt");
CREATE INDEX IF NOT EXISTS mctb_request_form_submissions_token_idx
  ON mctb_request_form_submissions ("formToken");

ALTER TABLE link_click_events
  ADD COLUMN IF NOT EXISTS "missedCallEventId" TEXT;

CREATE INDEX IF NOT EXISTS link_click_events_missed_call_event_idx
  ON link_click_events ("missedCallEventId")
  WHERE "missedCallEventId" IS NOT NULL;

ALTER TABLE voicemail_messages
  ADD COLUMN IF NOT EXISTS "transcriptEnglish" TEXT;
