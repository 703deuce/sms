-- Port-out production table (Transovo-normalized lifecycle).
CREATE TABLE IF NOT EXISTS port_out_requests (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  phone TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerPortOutId" TEXT,
  "destinationCarrier" TEXT,
  "destinationType" TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING_FOR_CARRIER',
  "purchasedAt" TIMESTAMPTZ,
  "initiatedAt" TIMESTAMPTZ,
  "carrierRequestReceivedAt" TIMESTAMPTZ,
  "authorizedAt" TIMESTAMPTZ,
  "focDate" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "rejectionCategory" TEXT,
  "rejectionDetailsInternal" TEXT,
  "customerActionRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "guaranteeEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  "guaranteeReviewStatus" TEXT,
  "refundStatus" TEXT,
  "returnedToInventoryAt" TIMESTAMPTZ,
  "voicePortStatus" TEXT,
  "messagingPortStatus" TEXT,
  "authorizedContactEmail" TEXT,
  "authorizedContactName" TEXT,
  "authorizedContactPhone" TEXT,
  "preferredTransferDate" TIMESTAMPTZ,
  "statusHistoryJson" JSONB NOT NULL DEFAULT '[]',
  "providerPayloadJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS port_out_requests_workspace_status_idx
  ON port_out_requests ("workspaceId", status);
CREATE INDEX IF NOT EXISTS port_out_requests_workspace_phone_idx
  ON port_out_requests ("workspaceId", "phoneNumberId");
CREATE INDEX IF NOT EXISTS port_out_requests_phone_status_idx
  ON port_out_requests ("phoneNumberId", status);
CREATE INDEX IF NOT EXISTS port_out_requests_provider_port_out_id_idx
  ON port_out_requests ("providerPortOutId");
