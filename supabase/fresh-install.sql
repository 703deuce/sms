-- Transovo fresh install for Supabase SQL editor
--
-- Use this if bootstrap.sql failed with missing columns (e.g. workspaceId)
-- or "relation already exists" from a partial apply.
-- DROPS Transovo app tables, then recreates them. Safe for empty/partial setups.

-- ========== 1) Drop app tables ==========
DROP TABLE IF EXISTS "UsageRecord" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Webhook" CASCADE;
DROP TABLE IF EXISTS "ApiKey" CASCADE;
DROP TABLE IF EXISTS "ComplianceCampaign" CASCADE;
DROP TABLE IF EXISTS "ComplianceBrand" CASCADE;
DROP TABLE IF EXISTS "ConsentRecord" CASCADE;
DROP TABLE IF EXISTS "OptInForm" CASCADE;
DROP TABLE IF EXISTS "Keyword" CASCADE;
DROP TABLE IF EXISTS "AutomationFlow" CASCADE;
DROP TABLE IF EXISTS "Template" CASCADE;
DROP TABLE IF EXISTS "ConversationMessage" CASCADE;
DROP TABLE IF EXISTS "Conversation" CASCADE;
DROP TABLE IF EXISTS "integration_webhook_events" CASCADE;
DROP TABLE IF EXISTS "integration_webhook_endpoints" CASCADE;
DROP TABLE IF EXISTS "job_queue" CASCADE;
DROP TABLE IF EXISTS "review_request_suppression" CASCADE;
DROP TABLE IF EXISTS "campaign_messages" CASCADE;
DROP TABLE IF EXISTS "campaign_recipients" CASCADE;
DROP TABLE IF EXISTS "messaging_registration_events" CASCADE;
DROP TABLE IF EXISTS "messaging_registrations" CASCADE;
DROP TABLE IF EXISTS "Message" CASCADE;
DROP TABLE IF EXISTS "Campaign" CASCADE;
DROP TABLE IF EXISTS "ContactTag" CASCADE;
DROP TABLE IF EXISTS "Tag" CASCADE;
DROP TABLE IF EXISTS "Segment" CASCADE;
DROP TABLE IF EXISTS "ContactListMember" CASCADE;
DROP TABLE IF EXISTS "ContactList" CASCADE;
DROP TABLE IF EXISTS "Contact" CASCADE;
DROP TABLE IF EXISTS "PhoneNumber" CASCADE;
DROP TABLE IF EXISTS "Membership" CASCADE;
DROP TABLE IF EXISTS "Workspace" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- ========== 2) Create enums + tables + indexes + FKs ==========

-- Idempotent bootstrap for Supabase SQL editor.
-- Safe to re-run if some tables/enums already exist (e.g. partial prior apply).
-- Regenerate: npm run db:schema && npm run db:bootstrap

-- Prefer supabase/bootstrap.sql in the SQL editor (idempotent).
-- This file is the raw Prisma diff output.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMINISTRATOR', 'MANAGER', 'CAMPAIGN_CREATOR', 'INBOX_AGENT', 'ANALYST', 'READ_ONLY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED', 'BLOCKED', 'INVALID');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED', 'SNOOZED', 'SPAM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FlowStatus" AS ENUM ('ACTIVE', 'DRAFT', 'PAUSED', 'ERROR', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ComplianceStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MessagingStepStatus" AS ENUM ('not_started', 'action_required', 'submitted', 'in_review', 'approved', 'failed', 'suspended', 'ready');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RecipientWorkflowStatus" AS ENUM ('pending', 'scheduled', 'in_progress', 'waiting', 'completed', 'stopped', 'failed', 'opted_out');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "JobQueueStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'deferred');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INBOX_AGENT',
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PhoneNumber" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "areaCode" TEXT,
    "friendlyName" TEXT,
    "twilioSid" TEXT,
    "providerNumberId" TEXT,
    "a2pStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "messagingService" TEXT,
    "monthlyCostCents" INTEGER NOT NULL DEFAULT 115,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "purchasedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "consentSource" TEXT,
    "consentDate" TIMESTAMP(3),
    "lastMessaged" TIMESTAMP(3),
    "lastReply" TIMESTAMP(3),
    "assignedUser" TEXT,
    "company" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactList" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ContactList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "ContactListMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Segment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactTag" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sequenceJson" JSONB,
    "successMode" TEXT NOT NULL DEFAULT 'click',
    "dailySendLimit" INTEGER,
    "sendWindowStart" INTEGER,
    "sendWindowEnd" INTEGER,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "optOuts" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "workspaceId" TEXT,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "segments" INTEGER NOT NULL DEFAULT 1,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "providerId" TEXT,
    "idempotencyKey" TEXT,
    "trackingToken" TEXT,
    "destinationUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "messaging_registrations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "overallStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "messagingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "subaccountSid" TEXT,
    "subaccountAuthTokenEnc" TEXT,
    "secondaryProfileSid" TEXT,
    "trustProductSid" TEXT,
    "brandSid" TEXT,
    "messagingServiceSid" TEXT,
    "a2pCampaignSid" TEXT,
    "messagingProvider" TEXT,
    "messagingProfileId" TEXT,
    "phoneNumberId" TEXT,
    "brandId" TEXT,
    "campaignId" TEXT,
    "brandStatusRaw" TEXT,
    "campaignStatusRaw" TEXT,
    "messagingActivationStatus" TEXT,
    "registrationSubmittedAt" TIMESTAMP(3),
    "registrationApprovedAt" TIMESTAMP(3),
    "registrationFailureReason" TEXT,
    "phoneE164" TEXT,
    "phoneSid" TEXT,
    "phoneAttached" BOOLEAN NOT NULL DEFAULT false,
    "phonePurchasedAt" TIMESTAMP(3),
    "profileStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "trustStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "brandStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "messagingServiceStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "campaignStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "numberStatus" "MessagingStepStatus" NOT NULL DEFAULT 'not_started',
    "legalBusinessName" TEXT,
    "dbaName" TEXT,
    "businessType" TEXT,
    "businessIndustry" TEXT,
    "businessIdentity" TEXT,
    "businessRegistrationId" TEXT,
    "websiteUrl" TEXT,
    "street" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'US',
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactTitle" TEXT,
    "useCase" TEXT,
    "useCaseDescription" TEXT,
    "sampleMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optInDescription" TEXT,
    "helpMessage" TEXT,
    "stopMessage" TEXT,
    "messageVolume" TEXT,
    "vertical" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastAdvancedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "messaging_registration_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_registration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "campaign_recipients" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "enrollmentKey" TEXT,
    "workflowStatus" "RecipientWorkflowStatus" NOT NULL DEFAULT 'pending',
    "currentStep" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "campaign_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "stepKey" TEXT,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "trackingToken" TEXT,
    "destinationUrl" TEXT,
    "error" TEXT,
    "deliveredCounted" BOOLEAN NOT NULL DEFAULT false,
    "clickedCounted" BOOLEAN NOT NULL DEFAULT false,
    "sentCounted" BOOLEAN NOT NULL DEFAULT false,
    "advancedAfterSend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "review_request_suppression" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "suppressionKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_request_suppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_queue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "jobType" TEXT NOT NULL,
    "queueName" TEXT NOT NULL DEFAULT 'default',
    "payload" JSONB NOT NULL,
    "status" "JobQueueStatus" NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_webhook_endpoints" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "campaignId" TEXT,
    "sendDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "fieldMap" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "integration_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_webhook_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "integration_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "tags" TEXT[],
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "body" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AutomationFlow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "enrolled" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Keyword" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "confirmation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "subscribers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OptInForm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "OptInForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "consentDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "disclosureVersion" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ComplianceBrand" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legalName" TEXT,
    "dba" TEXT,
    "ein" TEXT,
    "entityType" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "ComplianceBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ComplianceCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "useCase" TEXT,
    "description" TEXT,
    "optInMethod" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'DRAFT',
    "samples" TEXT[],

    CONSTRAINT "ComplianceCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Webhook" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UsageRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "smsSegments" INTEGER NOT NULL DEFAULT 0,
    "mmsMessages" INTEGER NOT NULL DEFAULT 0,
    "inbound" INTEGER NOT NULL DEFAULT 0,
    "outbound" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhoneNumber_twilioSid_idx" ON "PhoneNumber"("twilioSid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PhoneNumber_workspaceId_e164_key" ON "PhoneNumber"("workspaceId", "e164");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_workspaceId_phone_key" ON "Contact"("workspaceId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactListMember_listId_contactId_key" ON "ContactListMember"("listId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactTag_tagId_contactId_key" ON "ContactTag"("tagId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Message_trackingToken_key" ON "Message"("trackingToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_trackingToken_idx" ON "Message"("trackingToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_providerId_idx" ON "Message"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Message_workspaceId_idempotencyKey_key" ON "Message"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "messaging_registrations_workspaceId_key" ON "messaging_registrations"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messaging_registrations_overallStatus_idx" ON "messaging_registrations"("overallStatus");
CREATE INDEX IF NOT EXISTS "messaging_registrations_messaging_profile_id_idx" ON "messaging_registrations"("messagingProfileId");
CREATE INDEX IF NOT EXISTS "messaging_registrations_brand_id_idx" ON "messaging_registrations"("brandId");
CREATE INDEX IF NOT EXISTS "messaging_registrations_campaign_id_idx" ON "messaging_registrations"("campaignId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messaging_registration_events_registrationId_createdAt_idx" ON "messaging_registration_events"("registrationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_recipients_enrollmentKey_key" ON "campaign_recipients"("enrollmentKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_recipients_campaignId_workflowStatus_nextActionAt_idx" ON "campaign_recipients"("campaignId", "workflowStatus", "nextActionAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_recipients_workspaceId_phone_idx" ON "campaign_recipients"("workspaceId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_messages_trackingToken_key" ON "campaign_messages"("trackingToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_messages_status_scheduledFor_idx" ON "campaign_messages"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_messages_campaignId_status_idx" ON "campaign_messages"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_messages_recipientId_stepKey_key" ON "campaign_messages"("recipientId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "review_request_suppression_suppressionKey_key" ON "review_request_suppression"("suppressionKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "review_request_suppression_workspaceId_phone_idx" ON "review_request_suppression"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "review_request_suppression_workspaceId_email_idx" ON "review_request_suppression"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "job_queue_idempotencyKey_key" ON "job_queue"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_queue_status_runAfter_queueName_idx" ON "job_queue"("status", "runAfter", "queueName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_queue_jobType_status_idx" ON "job_queue"("jobType", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_webhook_endpoints_token_key" ON "integration_webhook_endpoints"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_webhook_endpoints_workspaceId_active_idx" ON "integration_webhook_endpoints"("workspaceId", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_webhook_events_workspaceId_createdAt_idx" ON "integration_webhook_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_webhook_events_endpointId_idempotencyKey_key" ON "integration_webhook_events"("endpointId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Keyword_workspaceId_keyword_phoneNumber_key" ON "Keyword"("workspaceId", "keyword", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceBrand_workspaceId_key" ON "ComplianceBrand"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceCampaign_workspaceId_key" ON "ComplianceCampaign"("workspaceId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "messaging_registrations" ADD CONSTRAINT "messaging_registrations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "messaging_registration_events" ADD CONSTRAINT "messaging_registration_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "messaging_registration_events" ADD CONSTRAINT "messaging_registration_events_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "messaging_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "campaign_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "review_request_suppression" ADD CONSTRAINT "review_request_suppression_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "job_queue" ADD CONSTRAINT "job_queue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_webhook_endpoints" ADD CONSTRAINT "integration_webhook_endpoints_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_webhook_events" ADD CONSTRAINT "integration_webhook_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_webhook_events" ADD CONSTRAINT "integration_webhook_events_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "integration_webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AutomationFlow" ADD CONSTRAINT "AutomationFlow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "OptInForm" ADD CONSTRAINT "OptInForm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ComplianceBrand" ADD CONSTRAINT "ComplianceBrand_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ComplianceCampaign" ADD CONSTRAINT "ComplianceCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

