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

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentLinkStatus" AS ENUM ('pending', 'paid', 'expired', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AutomationExecutionStatus" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "VoiceAgentStatus" AS ENUM ('DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'CONFIGURATION_ERROR');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "VoiceCallDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "VoiceCallStatus" AS ENUM ('QUEUED', 'INITIATED', 'RINGING', 'ANSWERED', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELLED', 'VOICEMAIL', 'TRANSFERRED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "VoiceCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deletionRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#0f766e',
    "accentColor" TEXT DEFAULT '#0ea5e9',
    "shortLinkDomain" TEXT,
    "formTheme" TEXT DEFAULT 'light',
    "reviewLinkUrl" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "billingPlan" TEXT DEFAULT 'growth',
    "creditBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "customFieldsConfig" JSONB,
    "activeFromNumberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sender_pools" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phoneNumberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_pools_pkey" PRIMARY KEY ("id")
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
    "voiceForwardTo" TEXT,
    "webhookUrl" TEXT,
    "capabilitiesJson" JSONB,
    "settingsJson" JSONB,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "phone_number_assignments" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_number_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INBOX_AGENT',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywordId" TEXT,
    "keywordText" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "maxEntries" INTEGER,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rulesText" TEXT,
    "prizeDescription" TEXT,
    "winnerContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contest_entries" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "externalId" TEXT,
    "connectedUserId" TEXT,
    "connectedAccountName" TEXT,
    "configJson" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastFailedSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "call_queues" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'ring_all',
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "maxWaitSeconds" INTEGER NOT NULL DEFAULT 300,
    "memberUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overflowAction" TEXT NOT NULL DEFAULT 'voicemail',
    "overflowTarget" TEXT,
    "holdMusicUrl" TEXT,
    "announcementUrl" TEXT,
    "callbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ivr_menus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "greeting" TEXT,
    "optionsJson" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ivr_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "plansJson" JSONB NOT NULL DEFAULT '[]',
    "flagsJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PortRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "currentCarrier" TEXT,
    "accountNumber" TEXT,
    "accountPin" TEXT,
    "billingPhone" TEXT,
    "businessName" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "authorizedName" TEXT,
    "numberType" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "focDate" TIMESTAMP(3),
    "temporaryForwardNumber" TEXT,
    "providerPortId" TEXT,
    "requestedByUserId" TEXT,
    "statusHistoryJson" JSONB NOT NULL DEFAULT '[]',
    "documentsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortRequest_pkey" PRIMARY KEY ("id")
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
    "timezone" TEXT,
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
    "category" TEXT,
    "audience" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sequenceJson" JSONB,
    "configJson" JSONB,
    "senderPoolId" TEXT,
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
    "privacyPolicyUrl" TEXT,
    "optInKeywords" TEXT,
    "optOutKeywords" TEXT,
    "helpKeywords" TEXT,
    "optInFormUrl" TEXT,
    "campaignDisplayName" TEXT,
    "subscriberOptIn" BOOLEAN NOT NULL DEFAULT true,
    "subscriberOptOut" BOOLEAN NOT NULL DEFAULT true,
    "embeddedLinks" BOOLEAN NOT NULL DEFAULT true,
    "embeddedPhone" BOOLEAN NOT NULL DEFAULT false,
    "ageGated" BOOLEAN NOT NULL DEFAULT false,
    "directLending" BOOLEAN NOT NULL DEFAULT false,
    "affiliateMarketing" BOOLEAN NOT NULL DEFAULT false,
    "numberPoolSize" INTEGER NOT NULL DEFAULT 1,
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
    "priority" INTEGER NOT NULL DEFAULT 50,
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
    "providerMessageId" TEXT,
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
CREATE TABLE IF NOT EXISTS "solution_setups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "solutionType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "configJson" JSONB,
    "linkedAgentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedAutomationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedCampaignIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedPhoneNumberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedRoutingRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedTemplateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryFlowId" TEXT,
    "externalKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solution_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactId" TEXT,
    "solutionSetupId" TEXT,
    "automationId" TEXT,
    "agentId" TEXT,
    "campaignId" TEXT,
    "callId" TEXT,
    "messageId" TEXT,
    "payload" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AutomationFlow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "publishedDefinition" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "enrolled" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceSolutionSetupId" TEXT,
    "ownerAgentId" TEXT,
    "ownershipKind" TEXT NOT NULL DEFAULT 'standalone',
    "ownerLabel" TEXT,
    "linkedAgentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedCampaignIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedPhoneNumberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedTemplateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "advancedCustomized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "trigger_deployments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "triggerNodeId" TEXT NOT NULL,
    "triggerBlockType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'every_call',
    "scheduleKey" TEXT NOT NULL DEFAULT 'always',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pauseFallback" TEXT NOT NULL DEFAULT 'human',
    "pauseFallbackNumber" TEXT,
    "pauseFallbackFlowId" TEXT,
    "providerConfig" JSONB,
    "errorMessage" TEXT,
    "deployedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trigger_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AutomationExecution" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowVersion" INTEGER NOT NULL,
    "contactId" TEXT NOT NULL,
    "enrollmentKey" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "currentNodeId" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AutomationStepExecution" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "branchTaken" TEXT,
    "output" JSONB,
    "error" TEXT,

    CONSTRAINT "AutomationStepExecution_pkey" PRIMARY KEY ("id")
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
    "tagsJson" JSONB,
    "startCampaignId" TEXT,
    "autoReply" TEXT,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OptInForm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "slug" TEXT,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "disclosureText" TEXT,
    "disclosureVersion" TEXT DEFAULT 'v1',
    "thankYouMessage" TEXT,
    "doubleOptIn" BOOLEAN NOT NULL DEFAULT false,
    "startCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptInForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FormSubmission" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "payload" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "embedHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
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
    "disclosureText" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "formUrl" TEXT,
    "doubleOptInStatus" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QrCode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "scans" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClickToTextLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickToTextLink_pkey" PRIMARY KEY ("id")
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
    "voiceMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "voiceCostCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_agents" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "agentType" TEXT NOT NULL DEFAULT 'custom',
    "status" "VoiceAgentStatus" NOT NULL DEFAULT 'DRAFT',
    "displayName" TEXT,
    "purpose" TEXT,
    "phoneNumberId" TEXT,
    "directions" TEXT[] DEFAULT ARRAY['inbound', 'outbound']::TEXT[],
    "draftConfig" JSONB,
    "publishedVersionId" TEXT,
    "telnyxAssistantId" TEXT,
    "telnyxConnectionId" TEXT,
    "callsHandled" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'ok',
    "healthMessage" TEXT,
    "emergencyDisabled" BOOLEAN NOT NULL DEFAULT false,
    "multiPartyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundAiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "widgetEnabled" BOOLEAN NOT NULL DEFAULT false,
    "memoryConfigId" TEXT,
    "insightGroupId" TEXT,
    "observabilityConfigId" TEXT,
    "sourceSolutionSetupId" TEXT,
    "linkedAutomationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedPhoneNumberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postCallAutomationId" TEXT,
    "fallbackAutomationId" TEXT,
    "primaryFlowId" TEXT,
    "executionType" TEXT NOT NULL DEFAULT 'realtime_voice',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "voice_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_agent_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "changeLog" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "telnyxVersionId" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "deploymentStatus" TEXT NOT NULL DEFAULT 'local',
    "testStatus" TEXT,

    CONSTRAINT "voice_agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_agent_phone_numbers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_agent_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_knowledge_bases" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "telnyxBucketName" TEXT,
    "telnyxEmbeddingStatus" TEXT,
    "telnyxEmbeddingTaskId" TEXT,
    "lastEmbeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_knowledge_sources" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contentText" TEXT,
    "fileUrl" TEXT,
    "fileMeta" JSONB,
    "crawlUrl" TEXT,
    "extractedPreview" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "telnyxObjectKey" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_agent_knowledge_bases" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,

    CONSTRAINT "voice_agent_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_tools" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "toolType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "secretRef" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "retryPolicy" JSONB,
    "isAsync" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_agent_tools" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,

    CONSTRAINT "voice_agent_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_calendar_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "config" JSONB,
    "credentialsRef" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_services" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "calendarId" TEXT,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "voice_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_staff_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "calendarId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "timezone" TEXT,
    "config" JSONB,

    CONSTRAINT "voice_staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_routing_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_campaigns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "VoiceCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "callerIdNumberId" TEXT,
    "audienceType" TEXT NOT NULL DEFAULT 'list',
    "audienceConfig" JSONB,
    "scheduleConfig" JSONB,
    "callingRules" JSONB,
    "voicemailRules" JSONB,
    "followUpActions" JSONB,
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "dailyLimit" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "timezone" TEXT,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "qualifiedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_campaign_contacts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastOutcome" TEXT,
    "variables" JSONB,
    "excludedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_campaign_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_campaign_attempts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignContactId" TEXT NOT NULL,
    "callId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "voice_campaign_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_calls" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentVersionId" TEXT,
    "contactId" TEXT,
    "campaignId" TEXT,
    "direction" "VoiceCallDirection" NOT NULL,
    "status" "VoiceCallStatus" NOT NULL DEFAULT 'QUEUED',
    "outcome" TEXT,
    "fromE164" TEXT NOT NULL,
    "toE164" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "leadScore" INTEGER,
    "appointmentBooked" BOOLEAN NOT NULL DEFAULT false,
    "transferred" BOOLEAN NOT NULL DEFAULT false,
    "voicemailDetected" BOOLEAN NOT NULL DEFAULT false,
    "durationSeconds" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "providerCostCents" INTEGER NOT NULL DEFAULT 0,
    "aiMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "telnyxCallControlId" TEXT,
    "telnyxConversationId" TEXT,
    "telnyxCallSessionId" TEXT,
    "dynamicVariables" JSONB,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_call_legs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "legType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerLegId" TEXT,
    "fromE164" TEXT,
    "toE164" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "voice_call_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_call_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerEventId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_call_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_transfers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "ringSeconds" INTEGER,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "voicemailDetected" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "voice_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_recordings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storageUrl" TEXT,
    "format" TEXT,
    "channels" INTEGER NOT NULL DEFAULT 1,
    "durationSeconds" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "providerRecordingId" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_transcripts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "language" TEXT,
    "fullText" TEXT,
    "confidence" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_transcript_segments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "voice_transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_conversation_insights" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "summary" TEXT,
    "intent" TEXT,
    "sentiment" TEXT,
    "isLead" BOOLEAN,
    "leadScore" INTEGER,
    "qualification" JSONB,
    "topics" JSONB,
    "objections" JSONB,
    "actionItems" JSONB,
    "customFields" JSONB,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_conversation_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_tool_executions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT,
    "toolId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "isAsync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "voice_tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_appointments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT,
    "contactId" TEXT,
    "serviceName" TEXT,
    "staffName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "appointment_slot_holds" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "callId" TEXT,
    "contactId" TEXT,
    "phone" TEXT,
    "serviceName" TEXT,
    "staffName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'held',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAppointmentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_test_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentVersionId" TEXT,
    "testNumber" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "callId" TEXT,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "voice_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_compliance_profiles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "emergencyStop" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_compliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_usage_records" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callId" TEXT,
    "agentId" TEXT,
    "campaignId" TEXT,
    "category" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "providerCostCents" INTEGER NOT NULL DEFAULT 0,
    "billedCostCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_integration_secrets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretType" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_integration_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_remote_assistant_versions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "telnyxAssistantId" TEXT NOT NULL,
    "telnyxVersionId" TEXT NOT NULL,
    "name" TEXT,
    "label" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "voice_remote_assistant_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_canary_deploys" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "telnyxAssistantId" TEXT NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "percentage" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startAt" TIMESTAMP(3),
    "stopAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "voice_canary_deploys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_assistant_tests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "telnyxTestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "suiteName" TEXT,
    "configJson" JSONB,
    "criteriaJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_assistant_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_test_suites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_assistant_test_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "testId" TEXT,
    "suiteName" TEXT,
    "telnyxRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultsJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_assistant_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_assistant_tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "telnyxSynced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_assistant_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_ai_conversations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "callId" TEXT,
    "contactId" TEXT,
    "phoneNumberId" TEXT,
    "telnyxConversationId" TEXT,
    "channel" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "telnyxMessageId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_memory_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'none',
    "retentionDays" INTEGER,
    "excludeFields" JSONB,
    "configJson" JSONB,
    "telnyxPrivacyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_memory_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_insight_definitions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "telnyxInsightId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "jsonSchema" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_insight_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_insight_groups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "telnyxGroupId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "webhookUrl" TEXT,
    "insightIds" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_insight_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_scheduled_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "telnyxAssistantId" TEXT,
    "telnyxEventId" TEXT,
    "channel" TEXT NOT NULL,
    "endUserTarget" TEXT NOT NULL,
    "agentTarget" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT,
    "dynamicVariables" JSONB,
    "metadata" JSONB,
    "maxRetries" INTEGER,
    "retryIntervalSecs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "consentRecorded" BOOLEAN NOT NULL DEFAULT false,
    "enabledByPolicy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "voice_scheduled_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_mcp_servers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "telnyxMcpId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "configJson" JSONB,
    "credentialsRef" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_observability_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "configJson" JSONB,
    "langfuseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_observability_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_concurrency_allocations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "maxInboundAi" INTEGER NOT NULL DEFAULT 5,
    "maxOutboundAi" INTEGER NOT NULL DEFAULT 0,
    "maxTransferLegs" INTEGER NOT NULL DEFAULT 10,
    "softAlertPct" INTEGER NOT NULL DEFAULT 80,
    "hardSpendLimitCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_concurrency_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_failure_diagnostics" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "callId" TEXT,
    "category" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "detailsJson" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "voice_failure_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_transfer_destinations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "businessHoursJson" JSONB,
    "fallbackDestination" TEXT,
    "voicemailOnFail" BOOLEAN NOT NULL DEFAULT true,
    "returnToAiOnFail" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_transfer_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voice_widget_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "domainAllowlist" JSONB,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 30,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_widget_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "provider_webhook_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "eventType" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "link_click_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackingToken" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT,
    "campaignId" TEXT,
    "messageId" TEXT,
    "campaignMessageId" TEXT,
    "destinationUrl" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'image',
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "storageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "surveys" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "surveyType" TEXT NOT NULL DEFAULT 'poll',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "survey_responses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "grow_widgets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL DEFAULT 'popup',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "linkedFormId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grow_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contact_card_profiles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "email" TEXT,
    "address" TEXT,
    "extraFields" JSONB,
    "attachToWelcomeMms" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_card_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_messaging_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "businessHoursJson" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "awayMessage" TEXT,
    "awayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "awayAlways" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "optOutKeywords" TEXT DEFAULT 'STOP,UNSUBSCRIBE,CANCEL,END,QUIT',
    "optInKeywords" TEXT DEFAULT 'START,YES,UNSTOP',
    "helpKeywords" TEXT DEFAULT 'HELP,INFO',
    "reviewLinkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_messaging_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_to_sms_addresses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "phoneE164" TEXT,
    "fromNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_to_sms_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "description" TEXT,
    "stripeSessionId" TEXT,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'pending',
    "url" TEXT NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "human_calls" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "agentUserId" TEXT,
    "telnyxCallControlId" TEXT,
    "telnyxCallLegId" TEXT,
    "conferenceId" TEXT,
    "parkSlotId" TEXT,
    "queueId" TEXT,
    "contactId" TEXT,
    "recordingStartedAt" TIMESTAMP(3),
    "transcriptText" TEXT,
    "aiSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "recordingUrl" TEXT,
    "notes" TEXT,
    "disposition" TEXT,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "callerIdNumber" TEXT,
    "mediaMode" TEXT NOT NULL DEFAULT 'call_control',

    CONSTRAINT "human_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "human_call_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "humanCallId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_call_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "call_park_slots" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slotCode" TEXT NOT NULL,
    "humanCallId" TEXT,
    "telnyxCallControlId" TEXT,
    "parkedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "parkedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "fallbackTarget" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_park_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "conference_calls" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT,
    "telnyxConferenceId" TEXT,
    "hostUserId" TEXT,
    "hostHumanCallId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recordingUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "conference_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "conference_participants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "humanCallId" TEXT,
    "telnyxCallControlId" TEXT,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "status" TEXT NOT NULL DEFAULT 'joined',
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "conference_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voicemail_boxes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "queueId" TEXT,
    "phoneNumberId" TEXT,
    "greetingText" TEXT,
    "greetingUrl" TEXT,
    "afterHoursGreetingUrl" TEXT,
    "emailNotify" TEXT,
    "transcriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voicemail_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voicemail_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "fromE164" TEXT,
    "toE164" TEXT,
    "recordingUrl" TEXT,
    "durationSeconds" INTEGER,
    "transcriptText" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "forwardedTo" TEXT,
    "humanCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voicemail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "call_forwarding_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "phoneNumberId" TEXT,
    "mode" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "ringSeconds" INTEGER NOT NULL DEFAULT 25,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_forwarding_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "softphone_presence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "customLabel" TEXT,
    "queueAvailable" BOOLEAN NOT NULL DEFAULT true,
    "deviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastRegisteredAt" TIMESTAMP(3),
    "lastPushAckAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "softphone_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "softphone_devices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceKey" TEXT NOT NULL,
    "label" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'browser',
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPushAt" TIMESTAMP(3),
    "lastAckAt" TIMESTAMP(3),
    "lastIncomingCallId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "softphone_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "softphone_user_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extension" TEXT,
    "defaultCallerId" TEXT,
    "ringDesktop" BOOLEAN NOT NULL DEFAULT true,
    "ringMobile" BOOLEAN NOT NULL DEFAULT true,
    "forwardToCellular" TEXT,
    "dndEnabled" BOOLEAN NOT NULL DEFAULT false,
    "e911AddressJson" JSONB,
    "permissionsJson" JSONB,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "internationalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "softphone_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_notification_prefs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyEmail" TEXT,
    "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_limits" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_data_prefs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "messageRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "consentRetention" TEXT NOT NULL DEFAULT 'forever',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_data_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_phone_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultCallerIdNumber" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_phone_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'adjustment',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_object_mappings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "parentExternalId" TEXT,
    "fingerprint" TEXT,
    "syncHash" TEXT,
    "syncVersion" INTEGER NOT NULL DEFAULT 1,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "lastSyncedAt" TIMESTAMP(3),
    "lastCrmModifiedAt" TIMESTAMP(3),
    "lastInternalModifiedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "syncDirection" TEXT NOT NULL DEFAULT 'bidirectional',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_object_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_field_mappings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "internalField" TEXT NOT NULL,
    "externalField" TEXT NOT NULL,
    "transform" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'bidirectional',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_sync_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'bidirectional',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "objectType" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "statsJson" JSONB,
    "lastError" TEXT,
    "cursorJson" JSONB,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_sync_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "action" TEXT NOT NULL,
    "objectType" TEXT,
    "internalId" TEXT,
    "externalId" TEXT,
    "message" TEXT NOT NULL,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailJson" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_webhook_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "eventType" TEXT,
    "externalId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_dead_letters" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "objectType" TEXT,
    "internalId" TEXT,
    "externalId" TEXT,
    "payloadJson" JSONB,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "syncRunId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_action_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connectionId" TEXT,
    "source" TEXT NOT NULL,
    "actorUserId" TEXT,
    "automationFlowId" TEXT,
    "actionId" TEXT NOT NULL,
    "riskLevel" INTEGER NOT NULL DEFAULT 3,
    "inputSummaryJson" JSONB,
    "objectType" TEXT,
    "objectIdsJson" JSONB,
    "contactId" TEXT,
    "approvalId" TEXT,
    "policyJson" JSONB,
    "idempotencyKey" TEXT,
    "providerRequestId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'queued',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "reversible" BOOLEAN NOT NULL DEFAULT false,
    "undoJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "integration_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_action_approvals" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connectionId" TEXT,
    "actionId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "riskLevel" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approverUserId" TEXT,
    "previewJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_alerts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT,
    "connectionId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warn',
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailJson" JSONB,
    "audience" TEXT NOT NULL DEFAULT 'customer',
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_context_caches" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staleAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "integration_context_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3),
    "ownerExternalId" TEXT,
    "ownerName" TEXT,
    "priority" TEXT,
    "relatedDealId" TEXT,
    "relatedCompanyId" TEXT,
    "relatedTicketId" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "externalUrl" TEXT,
    "metadataJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_orders" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "contactId" TEXT,
    "orderNumber" TEXT,
    "status" TEXT,
    "total" TEXT,
    "currency" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdExternalAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "externalUrl" TEXT,
    "lineItemsJson" JSONB,
    "shippingJson" JSONB,
    "metadataJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_ai_integration_policies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "policyJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_ai_integration_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sender_pools_workspaceId_idx" ON "sender_pools"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhoneNumber_twilioSid_idx" ON "PhoneNumber"("twilioSid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PhoneNumber_workspaceId_e164_key" ON "PhoneNumber"("workspaceId", "e164");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "phone_number_assignments_userId_idx" ON "phone_number_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "phone_number_assignments_phoneNumberId_userId_key" ON "phone_number_assignments"("phoneNumberId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_tokenHash_key" ON "workspace_invites"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workspace_invites_email_idx" ON "workspace_invites"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_workspaceId_email_key" ON "workspace_invites"("workspaceId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "in_app_notifications_userId_createdAt_idx" ON "in_app_notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "in_app_notifications_workspaceId_userId_readAt_idx" ON "in_app_notifications"("workspaceId", "userId", "readAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contests_workspaceId_status_idx" ON "contests"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contest_entries_contestId_createdAt_idx" ON "contest_entries"("contestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contest_entries_contestId_phone_key" ON "contest_entries"("contestId", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_connections_workspaceId_idx" ON "integration_connections"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_workspaceId_provider_key" ON "integration_connections"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "call_queues_workspaceId_idx" ON "call_queues"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ivr_menus_workspaceId_idx" ON "ivr_menus"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PortRequest_workspaceId_status_idx" ON "PortRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PortRequest_workspaceId_createdAt_idx" ON "PortRequest"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_workspaceId_phone_key" ON "Contact"("workspaceId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactListMember_listId_contactId_key" ON "ContactListMember"("listId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactTag_tagId_contactId_key" ON "ContactTag"("tagId", "contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_workspaceId_category_idx" ON "Campaign"("workspaceId", "category");

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
CREATE INDEX IF NOT EXISTS "job_queue_status_priority_runAfter_queueName_idx" ON "job_queue"("status", "priority", "runAfter", "queueName");

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
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMessage_providerMessageId_key" ON "ConversationMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConversationMessage_providerMessageId_idx" ON "ConversationMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "solution_setups_workspaceId_solutionType_idx" ON "solution_setups"("workspaceId", "solutionType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "solution_setups_workspaceId_status_idx" ON "solution_setups"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "solution_setups_workspaceId_primaryFlowId_idx" ON "solution_setups"("workspaceId", "primaryFlowId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "solution_setups_workspaceId_solutionType_externalKey_key" ON "solution_setups"("workspaceId", "solutionType", "externalKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_events_workspaceId_type_createdAt_idx" ON "platform_events"("workspaceId", "type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_events_workspaceId_contactId_idx" ON "platform_events"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_events_workspaceId_idempotencyKey_key" ON "platform_events"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationFlow_workspaceId_sourceSolutionSetupId_idx" ON "AutomationFlow"("workspaceId", "sourceSolutionSetupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationFlow_workspaceId_ownerAgentId_idx" ON "AutomationFlow"("workspaceId", "ownerAgentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationFlow_workspaceId_ownershipKind_idx" ON "AutomationFlow"("workspaceId", "ownershipKind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_deployments_workspaceId_phoneNumberId_status_idx" ON "trigger_deployments"("workspaceId", "phoneNumberId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_deployments_workspaceId_status_eventType_idx" ON "trigger_deployments"("workspaceId", "status", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "trigger_deployments_flowId_triggerNodeId_key" ON "trigger_deployments"("flowId", "triggerNodeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationExecution_enrollmentKey_key" ON "AutomationExecution"("enrollmentKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationExecution_workspaceId_flowId_idx" ON "AutomationExecution"("workspaceId", "flowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationExecution_status_nextActionAt_idx" ON "AutomationExecution"("status", "nextActionAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationStepExecution_executionId_idx" ON "AutomationStepExecution"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationStepExecution_executionId_nodeId_key" ON "AutomationStepExecution"("executionId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Keyword_workspaceId_keyword_phoneNumber_key" ON "Keyword"("workspaceId", "keyword", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OptInForm_workspaceId_slug_key" ON "OptInForm"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FormSubmission_workspaceId_idx" ON "FormSubmission"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsentRecord_workspaceId_phone_idx" ON "ConsentRecord"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QrCode_workspaceId_idx" ON "QrCode"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClickToTextLink_workspaceId_idx" ON "ClickToTextLink"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceBrand_workspaceId_key" ON "ComplianceBrand"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceCampaign_workspaceId_key" ON "ComplianceCampaign"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_agents_workspaceId_status_idx" ON "voice_agents"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_agents_workspaceId_primaryFlowId_idx" ON "voice_agents"("workspaceId", "primaryFlowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_agent_versions_workspaceId_idx" ON "voice_agent_versions"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_agent_versions_agentId_version_key" ON "voice_agent_versions"("agentId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_agent_phone_numbers_workspaceId_idx" ON "voice_agent_phone_numbers"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_agent_phone_numbers_agentId_phoneNumberId_key" ON "voice_agent_phone_numbers"("agentId", "phoneNumberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_knowledge_bases_workspaceId_idx" ON "voice_knowledge_bases"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_knowledge_sources_knowledgeBaseId_idx" ON "voice_knowledge_sources"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_knowledge_sources_workspaceId_idx" ON "voice_knowledge_sources"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_agent_knowledge_bases_agentId_knowledgeBaseId_key" ON "voice_agent_knowledge_bases"("agentId", "knowledgeBaseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_tools_workspaceId_idx" ON "voice_tools"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_agent_tools_agentId_toolId_key" ON "voice_agent_tools"("agentId", "toolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_calendar_connections_workspaceId_idx" ON "voice_calendar_connections"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_services_workspaceId_idx" ON "voice_services"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_staff_members_workspaceId_idx" ON "voice_staff_members"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_routing_rules_workspaceId_priority_idx" ON "voice_routing_rules"("workspaceId", "priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_campaigns_workspaceId_status_idx" ON "voice_campaigns"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_campaign_contacts_workspaceId_campaignId_status_idx" ON "voice_campaign_contacts"("workspaceId", "campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_campaign_contacts_campaignId_phone_key" ON "voice_campaign_contacts"("campaignId", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_campaign_attempts_campaignId_status_idx" ON "voice_campaign_attempts"("campaignId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_campaign_attempts_workspaceId_idx" ON "voice_campaign_attempts"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_calls_workspaceId_startedAt_idx" ON "voice_calls"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_calls_workspaceId_status_idx" ON "voice_calls"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_calls_telnyxCallControlId_idx" ON "voice_calls"("telnyxCallControlId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_calls_agentId_idx" ON "voice_calls"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_call_legs_callId_idx" ON "voice_call_legs"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_call_events_callId_createdAt_idx" ON "voice_call_events"("callId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_call_events_providerEventId_key" ON "voice_call_events"("providerEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_transfers_callId_idx" ON "voice_transfers"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_recordings_callId_idx" ON "voice_recordings"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_transcripts_callId_idx" ON "voice_transcripts"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_transcript_segments_transcriptId_idx" ON "voice_transcript_segments"("transcriptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_conversation_insights_callId_idx" ON "voice_conversation_insights"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_tool_executions_callId_idx" ON "voice_tool_executions"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_tool_executions_workspaceId_createdAt_idx" ON "voice_tool_executions"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_appointments_workspaceId_startsAt_idx" ON "voice_appointments"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_slot_holds_workspaceId_startsAt_idx" ON "appointment_slot_holds"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_slot_holds_workspaceId_status_expiresAt_idx" ON "appointment_slot_holds"("workspaceId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_slot_holds_callId_idx" ON "appointment_slot_holds"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_test_runs_workspaceId_agentId_idx" ON "voice_test_runs"("workspaceId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_compliance_profiles_workspaceId_key" ON "voice_compliance_profiles"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_usage_records_workspaceId_createdAt_idx" ON "voice_usage_records"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_usage_records_workspaceId_category_idx" ON "voice_usage_records"("workspaceId", "category");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_integration_secrets_workspaceId_name_key" ON "voice_integration_secrets"("workspaceId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_remote_assistant_versions_workspaceId_idx" ON "voice_remote_assistant_versions"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_remote_assistant_versions_agentId_telnyxVersionId_key" ON "voice_remote_assistant_versions"("agentId", "telnyxVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_canary_deploys_workspaceId_status_idx" ON "voice_canary_deploys"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_canary_deploys_agentId_idx" ON "voice_canary_deploys"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_assistant_tests_workspaceId_status_idx" ON "voice_assistant_tests"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_assistant_tests_agentId_idx" ON "voice_assistant_tests"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_assistant_tests_telnyxTestId_idx" ON "voice_assistant_tests"("telnyxTestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_test_suites_workspaceId_name_key" ON "voice_test_suites"("workspaceId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_assistant_test_runs_workspaceId_createdAt_idx" ON "voice_assistant_test_runs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_assistant_test_runs_testId_idx" ON "voice_assistant_test_runs"("testId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_assistant_tags_workspaceId_idx" ON "voice_assistant_tags"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_assistant_tags_agentId_tag_key" ON "voice_assistant_tags"("agentId", "tag");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_workspaceId_telnyxConversationId_idx" ON "voice_ai_conversations"("workspaceId", "telnyxConversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_workspaceId_createdAt_idx" ON "voice_ai_conversations"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_agentId_idx" ON "voice_ai_conversations"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_callId_idx" ON "voice_ai_conversations"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_ai_conversation_messages_conversationId_createdAt_idx" ON "voice_ai_conversation_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_ai_conversation_messages_workspaceId_idx" ON "voice_ai_conversation_messages"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_memory_configs_workspaceId_idx" ON "voice_memory_configs"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_memory_configs_agentId_idx" ON "voice_memory_configs"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_insight_definitions_workspaceId_status_idx" ON "voice_insight_definitions"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_insight_definitions_telnyxInsightId_idx" ON "voice_insight_definitions"("telnyxInsightId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_insight_groups_workspaceId_status_idx" ON "voice_insight_groups"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_insight_groups_telnyxGroupId_idx" ON "voice_insight_groups"("telnyxGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_scheduled_events_workspaceId_scheduledAt_idx" ON "voice_scheduled_events"("workspaceId", "scheduledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_scheduled_events_agentId_status_idx" ON "voice_scheduled_events"("agentId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_scheduled_events_telnyxEventId_idx" ON "voice_scheduled_events"("telnyxEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_mcp_servers_workspaceId_status_idx" ON "voice_mcp_servers"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_mcp_servers_telnyxMcpId_idx" ON "voice_mcp_servers"("telnyxMcpId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_observability_configs_workspaceId_idx" ON "voice_observability_configs"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_observability_configs_agentId_idx" ON "voice_observability_configs"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_concurrency_allocations_workspaceId_key" ON "voice_concurrency_allocations"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_failure_diagnostics_workspaceId_createdAt_idx" ON "voice_failure_diagnostics"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_failure_diagnostics_agentId_idx" ON "voice_failure_diagnostics"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_failure_diagnostics_callId_idx" ON "voice_failure_diagnostics"("callId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_transfer_destinations_workspaceId_agentId_idx" ON "voice_transfer_destinations"("workspaceId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voice_transfer_destinations_workspaceId_name_agentId_key" ON "voice_transfer_destinations"("workspaceId", "name", "agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_widget_configs_workspaceId_status_idx" ON "voice_widget_configs"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voice_widget_configs_agentId_idx" ON "voice_widget_configs"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "provider_webhook_events_providerEventId_key" ON "provider_webhook_events"("providerEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "provider_webhook_events_workspaceId_createdAt_idx" ON "provider_webhook_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "link_click_events_workspaceId_createdAt_idx" ON "link_click_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "link_click_events_trackingToken_idx" ON "link_click_events"("trackingToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "media_assets_workspaceId_createdAt_idx" ON "media_assets"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "surveys_workspaceId_status_idx" ON "surveys"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "survey_responses_surveyId_submittedAt_idx" ON "survey_responses"("surveyId", "submittedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "survey_responses_workspaceId_idx" ON "survey_responses"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "grow_widgets_slug_key" ON "grow_widgets"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grow_widgets_workspaceId_status_idx" ON "grow_widgets"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contact_card_profiles_workspaceId_key" ON "contact_card_profiles"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_messaging_settings_workspaceId_key" ON "workspace_messaging_settings"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_to_sms_addresses_workspaceId_active_idx" ON "email_to_sms_addresses"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "email_to_sms_addresses_workspaceId_localPart_key" ON "email_to_sms_addresses"("workspaceId", "localPart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_links_workspaceId_status_idx" ON "payment_links"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_links_stripeSessionId_idx" ON "payment_links"("stripeSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "human_calls_workspaceId_startedAt_idx" ON "human_calls"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "human_calls_telnyxCallControlId_idx" ON "human_calls"("telnyxCallControlId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "human_calls_queueId_idx" ON "human_calls"("queueId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "human_call_events_humanCallId_createdAt_idx" ON "human_call_events"("humanCallId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "human_call_events_workspaceId_createdAt_idx" ON "human_call_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "call_park_slots_workspaceId_status_idx" ON "call_park_slots"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "call_park_slots_workspaceId_slotCode_key" ON "call_park_slots"("workspaceId", "slotCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conference_calls_workspaceId_status_idx" ON "conference_calls"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conference_participants_conferenceId_idx" ON "conference_participants"("conferenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conference_participants_workspaceId_idx" ON "conference_participants"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voicemail_boxes_workspaceId_idx" ON "voicemail_boxes"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voicemail_messages_boxId_isRead_idx" ON "voicemail_messages"("boxId", "isRead");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voicemail_messages_workspaceId_createdAt_idx" ON "voicemail_messages"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "call_forwarding_rules_workspaceId_active_idx" ON "call_forwarding_rules"("workspaceId", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "softphone_presence_workspaceId_status_idx" ON "softphone_presence"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "softphone_presence_workspaceId_userId_key" ON "softphone_presence"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "softphone_devices_workspaceId_userId_active_idx" ON "softphone_devices"("workspaceId", "userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "softphone_devices_workspaceId_userId_deviceKey_key" ON "softphone_devices"("workspaceId", "userId", "deviceKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "softphone_user_settings_workspaceId_userId_key" ON "softphone_user_settings"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "push_subscriptions_workspaceId_userId_idx" ON "push_subscriptions"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_userId_endpoint_key" ON "push_subscriptions"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_notification_prefs_workspaceId_userId_key" ON "workspace_notification_prefs"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_limits_workspaceId_key" ON "workspace_limits"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_data_prefs_workspaceId_key" ON "workspace_data_prefs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_phone_settings_workspaceId_key" ON "workspace_phone_settings"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "credit_ledger_entries_workspaceId_createdAt_idx" ON "credit_ledger_entries"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_entries_stripeSessionId_key" ON "credit_ledger_entries"("stripeSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_status_createdAt_idx" ON "support_tickets"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_fingerprint_idx" ON "crm_object_mappings"("workspaceId", "provider", "fingerprint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_objectType_syncSta_idx" ON "crm_object_mappings"("workspaceId", "provider", "objectType", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_objectType_interna_key" ON "crm_object_mappings"("workspaceId", "provider", "objectType", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_objectType_externa_key" ON "crm_object_mappings"("workspaceId", "provider", "objectType", "externalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_field_mappings_workspaceId_provider_idx" ON "crm_field_mappings"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_field_mappings_workspaceId_provider_objectType_internal_key" ON "crm_field_mappings"("workspaceId", "provider", "objectType", "internalField", "direction");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_sync_runs_workspaceId_provider_createdAt_idx" ON "crm_sync_runs"("workspaceId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_sync_runs_status_createdAt_idx" ON "crm_sync_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_sync_events_syncRunId_createdAt_idx" ON "crm_sync_events"("syncRunId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_sync_events_workspaceId_provider_createdAt_idx" ON "crm_sync_events"("workspaceId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_audit_logs_workspaceId_createdAt_idx" ON "crm_audit_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_audit_logs_workspaceId_provider_createdAt_idx" ON "crm_audit_logs"("workspaceId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_webhook_events_workspaceId_provider_status_createdAt_idx" ON "crm_webhook_events"("workspaceId", "provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_dead_letters_workspaceId_provider_createdAt_idx" ON "crm_dead_letters"("workspaceId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_dead_letters_resolvedAt_idx" ON "crm_dead_letters"("resolvedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_action_logs_workspaceId_provider_createdAt_idx" ON "integration_action_logs"("workspaceId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_action_logs_workspaceId_source_result_idx" ON "integration_action_logs"("workspaceId", "source", "result");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_action_logs_workspaceId_contactId_idx" ON "integration_action_logs"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_action_logs_workspaceId_idempotencyKey_key" ON "integration_action_logs"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_action_approvals_workspaceId_status_expiresAt_idx" ON "ai_action_approvals"("workspaceId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_action_approvals_workspaceId_payloadHash_idx" ON "ai_action_approvals"("workspaceId", "payloadHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_alerts_workspaceId_acknowledgedAt_createdAt_idx" ON "integration_alerts"("workspaceId", "acknowledgedAt", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_alerts_workspaceId_kind_idx" ON "integration_alerts"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_context_caches_workspaceId_refreshedAt_idx" ON "integration_context_caches"("workspaceId", "refreshedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_context_caches_workspaceId_contactId_key" ON "integration_context_caches"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_tasks_workspaceId_status_dueAt_idx" ON "integration_tasks"("workspaceId", "status", "dueAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_tasks_workspaceId_contactId_idx" ON "integration_tasks"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_tasks_workspaceId_provider_externalId_key" ON "integration_tasks"("workspaceId", "provider", "externalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_orders_workspaceId_status_createdAt_idx" ON "integration_orders"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_orders_workspaceId_contactId_idx" ON "integration_orders"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_orders_workspaceId_orderNumber_idx" ON "integration_orders"("workspaceId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "integration_orders_workspaceId_provider_externalId_key" ON "integration_orders"("workspaceId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_ai_integration_policies_workspaceId_key" ON "workspace_ai_integration_policies"("workspaceId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sender_pools" ADD CONSTRAINT "sender_pools_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

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
    ALTER TABLE "phone_number_assignments" ADD CONSTRAINT "phone_number_assignments_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "phone_number_assignments" ADD CONSTRAINT "phone_number_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contests" ADD CONSTRAINT "contests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "call_queues" ADD CONSTRAINT "call_queues_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ivr_menus" ADD CONSTRAINT "ivr_menus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PortRequest" ADD CONSTRAINT "PortRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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
    ALTER TABLE "solution_setups" ADD CONSTRAINT "solution_setups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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
    ALTER TABLE "AutomationFlow" ADD CONSTRAINT "AutomationFlow_sourceSolutionSetupId_fkey" FOREIGN KEY ("sourceSolutionSetupId") REFERENCES "solution_setups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AutomationFlow" ADD CONSTRAINT "AutomationFlow_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "trigger_deployments" ADD CONSTRAINT "trigger_deployments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "trigger_deployments" ADD CONSTRAINT "trigger_deployments_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "trigger_deployments" ADD CONSTRAINT "trigger_deployments_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AutomationStepExecution" ADD CONSTRAINT "AutomationStepExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "OptInForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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
    ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ClickToTextLink" ADD CONSTRAINT "ClickToTextLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agents" ADD CONSTRAINT "voice_agents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agents" ADD CONSTRAINT "voice_agents_sourceSolutionSetupId_fkey" FOREIGN KEY ("sourceSolutionSetupId") REFERENCES "solution_setups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_versions" ADD CONSTRAINT "voice_agent_versions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_versions" ADD CONSTRAINT "voice_agent_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_phone_numbers" ADD CONSTRAINT "voice_agent_phone_numbers_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_phone_numbers" ADD CONSTRAINT "voice_agent_phone_numbers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_knowledge_bases" ADD CONSTRAINT "voice_knowledge_bases_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_knowledge_sources" ADD CONSTRAINT "voice_knowledge_sources_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "voice_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_knowledge_sources" ADD CONSTRAINT "voice_knowledge_sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_knowledge_bases" ADD CONSTRAINT "voice_agent_knowledge_bases_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_knowledge_bases" ADD CONSTRAINT "voice_agent_knowledge_bases_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "voice_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_knowledge_bases" ADD CONSTRAINT "voice_agent_knowledge_bases_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_tools" ADD CONSTRAINT "voice_tools_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_tools" ADD CONSTRAINT "voice_agent_tools_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_tools" ADD CONSTRAINT "voice_agent_tools_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "voice_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_agent_tools" ADD CONSTRAINT "voice_agent_tools_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_calendar_connections" ADD CONSTRAINT "voice_calendar_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_services" ADD CONSTRAINT "voice_services_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "voice_calendar_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_services" ADD CONSTRAINT "voice_services_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_staff_members" ADD CONSTRAINT "voice_staff_members_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "voice_calendar_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_staff_members" ADD CONSTRAINT "voice_staff_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_routing_rules" ADD CONSTRAINT "voice_routing_rules_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_routing_rules" ADD CONSTRAINT "voice_routing_rules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaign_contacts" ADD CONSTRAINT "voice_campaign_contacts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "voice_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaign_contacts" ADD CONSTRAINT "voice_campaign_contacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaign_attempts" ADD CONSTRAINT "voice_campaign_attempts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "voice_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaign_attempts" ADD CONSTRAINT "voice_campaign_attempts_campaignContactId_fkey" FOREIGN KEY ("campaignContactId") REFERENCES "voice_campaign_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_campaign_attempts" ADD CONSTRAINT "voice_campaign_attempts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_agentVersionId_fkey" FOREIGN KEY ("agentVersionId") REFERENCES "voice_agent_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "voice_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_call_legs" ADD CONSTRAINT "voice_call_legs_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_call_legs" ADD CONSTRAINT "voice_call_legs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_call_events" ADD CONSTRAINT "voice_call_events_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_call_events" ADD CONSTRAINT "voice_call_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transfers" ADD CONSTRAINT "voice_transfers_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transfers" ADD CONSTRAINT "voice_transfers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_recordings" ADD CONSTRAINT "voice_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_recordings" ADD CONSTRAINT "voice_recordings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transcripts" ADD CONSTRAINT "voice_transcripts_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transcripts" ADD CONSTRAINT "voice_transcripts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transcript_segments" ADD CONSTRAINT "voice_transcript_segments_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "voice_transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transcript_segments" ADD CONSTRAINT "voice_transcript_segments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_conversation_insights" ADD CONSTRAINT "voice_conversation_insights_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_conversation_insights" ADD CONSTRAINT "voice_conversation_insights_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_tool_executions" ADD CONSTRAINT "voice_tool_executions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_tool_executions" ADD CONSTRAINT "voice_tool_executions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "voice_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_tool_executions" ADD CONSTRAINT "voice_tool_executions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_appointments" ADD CONSTRAINT "voice_appointments_callId_fkey" FOREIGN KEY ("callId") REFERENCES "voice_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_appointments" ADD CONSTRAINT "voice_appointments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "appointment_slot_holds" ADD CONSTRAINT "appointment_slot_holds_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_test_runs" ADD CONSTRAINT "voice_test_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_test_runs" ADD CONSTRAINT "voice_test_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_compliance_profiles" ADD CONSTRAINT "voice_compliance_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_usage_records" ADD CONSTRAINT "voice_usage_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_integration_secrets" ADD CONSTRAINT "voice_integration_secrets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_remote_assistant_versions" ADD CONSTRAINT "voice_remote_assistant_versions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_remote_assistant_versions" ADD CONSTRAINT "voice_remote_assistant_versions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_canary_deploys" ADD CONSTRAINT "voice_canary_deploys_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_canary_deploys" ADD CONSTRAINT "voice_canary_deploys_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_assistant_tests" ADD CONSTRAINT "voice_assistant_tests_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_assistant_tests" ADD CONSTRAINT "voice_assistant_tests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_test_suites" ADD CONSTRAINT "voice_test_suites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_assistant_test_runs" ADD CONSTRAINT "voice_assistant_test_runs_testId_fkey" FOREIGN KEY ("testId") REFERENCES "voice_assistant_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_assistant_test_runs" ADD CONSTRAINT "voice_assistant_test_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_assistant_tags" ADD CONSTRAINT "voice_assistant_tags_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_assistant_tags" ADD CONSTRAINT "voice_assistant_tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_ai_conversations" ADD CONSTRAINT "voice_ai_conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_ai_conversations" ADD CONSTRAINT "voice_ai_conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_ai_conversation_messages" ADD CONSTRAINT "voice_ai_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "voice_ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_ai_conversation_messages" ADD CONSTRAINT "voice_ai_conversation_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_memory_configs" ADD CONSTRAINT "voice_memory_configs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_memory_configs" ADD CONSTRAINT "voice_memory_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_insight_definitions" ADD CONSTRAINT "voice_insight_definitions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_insight_groups" ADD CONSTRAINT "voice_insight_groups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_scheduled_events" ADD CONSTRAINT "voice_scheduled_events_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_scheduled_events" ADD CONSTRAINT "voice_scheduled_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_mcp_servers" ADD CONSTRAINT "voice_mcp_servers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_observability_configs" ADD CONSTRAINT "voice_observability_configs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_observability_configs" ADD CONSTRAINT "voice_observability_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_concurrency_allocations" ADD CONSTRAINT "voice_concurrency_allocations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_failure_diagnostics" ADD CONSTRAINT "voice_failure_diagnostics_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_failure_diagnostics" ADD CONSTRAINT "voice_failure_diagnostics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transfer_destinations" ADD CONSTRAINT "voice_transfer_destinations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_transfer_destinations" ADD CONSTRAINT "voice_transfer_destinations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_widget_configs" ADD CONSTRAINT "voice_widget_configs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voice_widget_configs" ADD CONSTRAINT "voice_widget_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "provider_webhook_events" ADD CONSTRAINT "provider_webhook_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "surveys" ADD CONSTRAINT "surveys_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "grow_widgets" ADD CONSTRAINT "grow_widgets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_card_profiles" ADD CONSTRAINT "contact_card_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_messaging_settings" ADD CONSTRAINT "workspace_messaging_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "email_to_sms_addresses" ADD CONSTRAINT "email_to_sms_addresses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "human_calls" ADD CONSTRAINT "human_calls_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "human_call_events" ADD CONSTRAINT "human_call_events_humanCallId_fkey" FOREIGN KEY ("humanCallId") REFERENCES "human_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "human_call_events" ADD CONSTRAINT "human_call_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "call_park_slots" ADD CONSTRAINT "call_park_slots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "conference_calls" ADD CONSTRAINT "conference_calls_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "conference_participants" ADD CONSTRAINT "conference_participants_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conference_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "conference_participants" ADD CONSTRAINT "conference_participants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voicemail_boxes" ADD CONSTRAINT "voicemail_boxes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voicemail_messages" ADD CONSTRAINT "voicemail_messages_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "voicemail_boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "voicemail_messages" ADD CONSTRAINT "voicemail_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "call_forwarding_rules" ADD CONSTRAINT "call_forwarding_rules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "softphone_presence" ADD CONSTRAINT "softphone_presence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "softphone_devices" ADD CONSTRAINT "softphone_devices_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "softphone_user_settings" ADD CONSTRAINT "softphone_user_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_notification_prefs" ADD CONSTRAINT "workspace_notification_prefs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_limits" ADD CONSTRAINT "workspace_limits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_data_prefs" ADD CONSTRAINT "workspace_data_prefs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_phone_settings" ADD CONSTRAINT "workspace_phone_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_object_mappings" ADD CONSTRAINT "crm_object_mappings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_field_mappings" ADD CONSTRAINT "crm_field_mappings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_sync_runs" ADD CONSTRAINT "crm_sync_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_sync_events" ADD CONSTRAINT "crm_sync_events_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "crm_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_sync_events" ADD CONSTRAINT "crm_sync_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_audit_logs" ADD CONSTRAINT "crm_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_webhook_events" ADD CONSTRAINT "crm_webhook_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "crm_dead_letters" ADD CONSTRAINT "crm_dead_letters_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_action_logs" ADD CONSTRAINT "integration_action_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ai_action_approvals" ADD CONSTRAINT "ai_action_approvals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_alerts" ADD CONSTRAINT "integration_alerts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_context_caches" ADD CONSTRAINT "integration_context_caches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_tasks" ADD CONSTRAINT "integration_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "integration_orders" ADD CONSTRAINT "integration_orders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "workspace_ai_integration_policies" ADD CONSTRAINT "workspace_ai_integration_policies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

