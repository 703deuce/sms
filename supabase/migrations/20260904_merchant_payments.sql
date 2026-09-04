-- Merchant payment connections (Stripe Connect / Square) — separate from SaaS billing

CREATE TABLE IF NOT EXISTS merchant_payment_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected',
  merchant_account_id TEXT,
  default_location_id TEXT,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  provider_metadata JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS merchant_payment_connections_workspace_idx
  ON merchant_payment_connections(workspace_id);
CREATE INDEX IF NOT EXISTS merchant_payment_connections_merchant_idx
  ON merchant_payment_connections(merchant_account_id);

CREATE TABLE IF NOT EXISTS appointment_merchant_payments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  appointment_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_mode TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  total_price_cents INTEGER NOT NULL,
  amount_due_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  balance_due_cents INTEGER NOT NULL DEFAULT 0,
  provider_payment_id TEXT,
  provider_session_id TEXT,
  idempotency_key TEXT UNIQUE,
  refund_amount_cents INTEGER NOT NULL DEFAULT 0,
  refund_status TEXT,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_merchant_payments_workspace_appt_idx
  ON appointment_merchant_payments(workspace_id, appointment_id);
CREATE INDEX IF NOT EXISTS appointment_merchant_payments_appt_idx
  ON appointment_merchant_payments(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_merchant_payments_provider_payment_idx
  ON appointment_merchant_payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS appointment_merchant_payments_provider_session_idx
  ON appointment_merchant_payments(provider_session_id);
