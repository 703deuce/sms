-- Transovo phone platform: employee links, call recordings, hold music settings, transfer codes

ALTER TABLE smart_routing_workspace_settings
  ADD COLUMN IF NOT EXISTS "holdMusicSlug" TEXT DEFAULT 'hold-modern-corporate',
  ADD COLUMN IF NOT EXISTS "holdMusicAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "holdMusicMode" TEXT DEFAULT 'music',
  ADD COLUMN IF NOT EXISTS "recordingEnabledInbound" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recordingEnabledOutbound" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recordingTranscriptionEnabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recordingSummaryEnabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recordingRetentionDays" INTEGER DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "recordingAnnouncementEnabled" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "employeeAuthMode" TEXT DEFAULT 'remembered',
  ADD COLUMN IF NOT EXISTS "transferDtmfKey" TEXT DEFAULT '*2',
  ADD COLUMN IF NOT EXISTS "conferenceDtmfKey" TEXT DEFAULT '*3';

ALTER TABLE smart_routing_destinations
  ADD COLUMN IF NOT EXISTS "transferCode" TEXT,
  ADD COLUMN IF NOT EXISTS "allowTransferTo" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "transferWhisperLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "onBusinessCall" BOOLEAN DEFAULT false;

ALTER TABLE smart_routing_authorized_callers
  ADD COLUMN IF NOT EXISTS "defaultBusinessCallerIdE164" TEXT,
  ADD COLUMN IF NOT EXISTS "alternatePhoneE164" TEXT;

CREATE TABLE IF NOT EXISTS smart_routing_employee_access_tokens (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "authorizedCallerId" TEXT NOT NULL REFERENCES smart_routing_authorized_callers(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  label TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "lastUsedAt" TIMESTAMPTZ,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_employee_tokens_workspace
  ON smart_routing_employee_access_tokens("workspaceId");
CREATE INDEX IF NOT EXISTS idx_sr_employee_tokens_caller
  ON smart_routing_employee_access_tokens("authorizedCallerId");

CREATE TABLE IF NOT EXISTS smart_routing_call_recordings (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "callSessionId" TEXT REFERENCES smart_routing_call_sessions(id) ON DELETE SET NULL,
  "outboundCallId" TEXT REFERENCES smart_routing_outbound_calls(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'telnyx',
  "providerRecordingId" TEXT,
  "storagePath" TEXT,
  "storageBucket" TEXT DEFAULT 'call-recordings',
  "mimeType" TEXT,
  "durationSeconds" INTEGER,
  direction TEXT,
  "transcriptText" TEXT,
  "transcriptStatus" TEXT DEFAULT 'pending',
  "aiSummary" TEXT,
  "summaryStatus" TEXT DEFAULT 'pending',
  "retentionExpiresAt" TIMESTAMPTZ,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_call_recordings_workspace
  ON smart_routing_call_recordings("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_sr_call_recordings_session
  ON smart_routing_call_recordings("callSessionId");

CREATE TABLE IF NOT EXISTS smart_routing_call_control_sessions (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "callSessionId" TEXT NOT NULL REFERENCES smart_routing_call_sessions(id) ON DELETE CASCADE,
  "employeeCallControlId" TEXT NOT NULL,
  "customerCallControlId" TEXT,
  "controlState" TEXT NOT NULL DEFAULT 'normal',
  "transferPathJson" JSONB DEFAULT '[]',
  "heldParticipant" TEXT,
  "consultationCallControlId" TEXT,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_call_control_session
  ON smart_routing_call_control_sessions("callSessionId");
