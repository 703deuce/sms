-- Additive fields/models for finish-everything audit gaps.
-- Prefer: npm run db:push with DATABASE_URL. This SQL is a manual fallback.

-- Workspace billing + branding
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT DEFAULT '#0f766e';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "accentColor" TEXT DEFAULT '#0ea5e9';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "shortLinkDomain" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "formTheme" TEXT DEFAULT 'light';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "reviewLinkUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "billingPlan" TEXT DEFAULT 'growth';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "creditBalanceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "activeFromNumberId" TEXT;

-- User 2FA / deletion
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);

-- Phone number extras
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "voiceForwardTo" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "webhookUrl" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "capabilitiesJson" JSONB;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB;

-- Campaign pool
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "senderPoolId" TEXT;

-- Messaging registration TCR attrs
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "privacyPolicyUrl" TEXT;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "optInKeywords" TEXT;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "optOutKeywords" TEXT;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "helpKeywords" TEXT;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "optInFormUrl" TEXT;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "campaignDisplayName" TEXT;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "subscriberOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "subscriberOptOut" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "embeddedLinks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "embeddedPhone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "ageGated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "directLending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "affiliateMarketing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messaging_registrations ADD COLUMN IF NOT EXISTS "numberPoolSize" INTEGER NOT NULL DEFAULT 1;

-- Messaging settings keywords + review
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "optOutKeywords" TEXT DEFAULT 'STOP,UNSUBSCRIBE,CANCEL,END,QUIT';
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "optInKeywords" TEXT DEFAULT 'START,YES,UNSTOP';
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "helpKeywords" TEXT DEFAULT 'HELP,INFO';
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "reviewLinkUrl" TEXT;

-- Contact card MMS
ALTER TABLE contact_card_profiles ADD COLUMN IF NOT EXISTS "attachToWelcomeMms" BOOLEAN NOT NULL DEFAULT false;

-- Credits stripe ids
ALTER TABLE credit_ledger_entries ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;
ALTER TABLE credit_ledger_entries ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_entries_stripeSessionId_key ON credit_ledger_entries("stripeSessionId");

CREATE TABLE IF NOT EXISTS phone_number_assignments (
  id TEXT PRIMARY KEY,
  "phoneNumberId" TEXT NOT NULL REFERENCES "PhoneNumber"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("phoneNumberId", "userId")
);
CREATE INDEX IF NOT EXISTS phone_number_assignments_userId_idx ON phone_number_assignments("userId");

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'INBOX_AGENT',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "invitedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspaceId", email)
);
CREATE INDEX IF NOT EXISTS workspace_invites_email_idx ON workspace_invites(email);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS in_app_notifications_user_created_idx ON in_app_notifications("userId", "createdAt");

CREATE TABLE IF NOT EXISTS contests (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "keywordId" TEXT,
  "keywordText" TEXT NOT NULL,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "maxEntries" INTEGER,
  "winnerCount" INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  "rulesText" TEXT,
  "prizeDescription" TEXT,
  "winnerContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "drawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contest_entries (
  id TEXT PRIMARY KEY,
  "contestId" TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  "contactId" TEXT,
  phone TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("contestId", phone)
);

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "expiresAt" TIMESTAMP(3),
  "externalId" TEXT,
  "configJson" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspaceId", provider)
);

CREATE TABLE IF NOT EXISTS call_queues (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'ring_all',
  "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
  "memberUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "overflowAction" TEXT NOT NULL DEFAULT 'voicemail',
  "overflowTarget" TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ivr_menus (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  greeting TEXT,
  "optionsJson" JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  "plansJson" JSONB NOT NULL DEFAULT '[]',
  "flagsJson" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
