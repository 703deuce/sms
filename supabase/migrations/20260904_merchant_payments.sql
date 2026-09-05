-- Merchant payment connections (Stripe Connect / Square) — separate from SaaS billing

CREATE TABLE IF NOT EXISTS merchant_payment_connections (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected',
  "merchantAccountId" TEXT,
  "defaultLocationId" TEXT,
  "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
  "accessTokenEnc" TEXT,
  "refreshTokenEnc" TEXT,
  "tokenExpiresAt" TIMESTAMPTZ,
  "connectedAt" TIMESTAMPTZ,
  "disconnectedAt" TIMESTAMPTZ,
  "providerMetadata" JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId", provider)
);

CREATE INDEX IF NOT EXISTS merchant_payment_connections_workspace_idx
  ON merchant_payment_connections("workspaceId");
CREATE INDEX IF NOT EXISTS merchant_payment_connections_merchant_idx
  ON merchant_payment_connections("merchantAccountId");

CREATE TABLE IF NOT EXISTS appointment_merchant_payments (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "appointmentId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "paymentMode" TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  "totalPriceCents" INTEGER NOT NULL,
  "amountDueCents" INTEGER NOT NULL,
  "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
  "balanceDueCents" INTEGER NOT NULL DEFAULT 0,
  "providerPaymentId" TEXT,
  "providerSessionId" TEXT,
  "idempotencyKey" TEXT UNIQUE,
  "refundAmountCents" INTEGER NOT NULL DEFAULT 0,
  "refundStatus" TEXT,
  "paidAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "canceledAt" TIMESTAMPTZ,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_merchant_payments_workspace_appt_idx
  ON appointment_merchant_payments("workspaceId", "appointmentId");
CREATE INDEX IF NOT EXISTS appointment_merchant_payments_appt_idx
  ON appointment_merchant_payments("appointmentId");
CREATE INDEX IF NOT EXISTS appointment_merchant_payments_provider_payment_idx
  ON appointment_merchant_payments("providerPaymentId");
CREATE INDEX IF NOT EXISTS appointment_merchant_payments_provider_session_idx
  ON appointment_merchant_payments("providerSessionId");
