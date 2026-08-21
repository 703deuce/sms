-- Marketplace billing catalog + per-number service subscriptions
-- Apply after prisma schema sync or via: npm run db:push

ALTER TABLE premium_number_reservations ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;
ALTER TABLE premium_number_reservations ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE premium_number_reservations ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT DEFAULT 'none';
ALTER TABLE premium_number_reservations ADD COLUMN IF NOT EXISTS "stripeRefundId" TEXT;
CREATE INDEX IF NOT EXISTS premium_number_reservations_stripeSessionId_idx ON premium_number_reservations("stripeSessionId");

CREATE TABLE IF NOT EXISTS marketplace_billing_products (
  id TEXT PRIMARY KEY,
  "productKey" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  description TEXT,
  "amountCents" INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  "billingInterval" TEXT NOT NULL DEFAULT 'month',
  "includedUsageMinutes" INTEGER,
  "stripeProductId" TEXT,
  "stripePriceId" TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_billing_price_history (
  id TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES marketplace_billing_products(id) ON DELETE CASCADE,
  "stripePriceId" TEXT NOT NULL UNIQUE,
  "amountCents" INTEGER NOT NULL,
  "activeForNewPurchases" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketplace_billing_price_history_productId_idx ON marketplace_billing_price_history("productId", "createdAt");

CREATE TABLE IF NOT EXISTS number_service_subscriptions (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "phoneNumberId" TEXT NOT NULL REFERENCES "PhoneNumber"(id) ON DELETE CASCADE,
  "productKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL REFERENCES marketplace_billing_products(id) ON DELETE RESTRICT,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT UNIQUE,
  "stripePriceId" TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "includedMinutesPerPeriod" INTEGER,
  "minutesUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
  "usagePeriodStart" TIMESTAMPTZ,
  "usagePeriodEnd" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS number_service_subscriptions_workspace_phone_idx ON number_service_subscriptions("workspaceId", "phoneNumberId");
CREATE INDEX IF NOT EXISTS number_service_subscriptions_phone_service_idx ON number_service_subscriptions("phoneNumberId", "productKey");
CREATE INDEX IF NOT EXISTS number_service_subscriptions_stripe_sub_idx ON number_service_subscriptions("stripeSubscriptionId");

CREATE TABLE IF NOT EXISTS marketplace_stripe_refunds (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "reservationId" TEXT REFERENCES premium_number_reservations(id) ON DELETE SET NULL,
  "phoneNumberId" TEXT,
  "stripePaymentIntentId" TEXT,
  "stripeRefundId" TEXT NOT NULL UNIQUE,
  "amountCents" INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketplace_stripe_refunds_workspace_idx ON marketplace_stripe_refunds("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS marketplace_stripe_refunds_reservation_idx ON marketplace_stripe_refunds("reservationId");
