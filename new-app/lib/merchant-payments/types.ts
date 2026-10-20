/**
 * Merchant appointment payments — separate from Transovo PlatformBilling (SaaS subscriptions).
 */

export const MERCHANT_PAYMENT_TRANSACTION_TYPE = "appointment_merchant_payment";

export type MerchantPaymentProvider = "STRIPE" | "SQUARE";

export type MerchantConnectionStatus =
  | "not_connected"
  | "onboarding_incomplete"
  | "needs_attention"
  | "connected"
  | "disabled";

export type MerchantPaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "abandoned"
  | "refunded"
  | "partially_refunded";

export type MerchantConnectionView = {
  provider: MerchantPaymentProvider;
  status: MerchantConnectionStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  merchantAccountId: string | null;
  defaultLocationId: string | null;
  connectedAt: string | null;
  lastError: string | null;
  canAcceptPayments: boolean;
};

export type CreateMerchantPaymentInput = {
  workspaceId: string;
  appointmentId: string;
  payment: {
    mode: "deposit" | "full";
    priceCents: number;
    depositCents?: number;
    depositPercent?: number;
    currency?: string;
    provider: MerchantPaymentProvider;
  };
  customerEmail?: string;
  description?: string;
  idempotencyKey?: string;
};

export type MerchantPaymentResult = {
  configured: boolean;
  provider: MerchantPaymentProvider;
  paymentRequired: boolean;
  checkoutUrl: string | null;
  sessionId: string | null;
  /** Square Web Payments SDK config for client tokenization */
  square?: {
    applicationId: string;
    locationId: string;
    amountCents: number;
    currency: string;
    sandbox?: boolean;
  };
  paymentRecordId: string | null;
  error: string | null;
};

export type SquarePaymentTokenInput = {
  workspaceId: string;
  appointmentId: string;
  sourceId: string;
  idempotencyKey: string;
};

export type RefundMerchantPaymentInput = {
  workspaceId: string;
  appointmentId: string;
  amountCents?: number;
  reason?: string;
};

export const PAYMENT_HOLD_MINUTES = 30;
