/** Merchant appointment payments — separate from Transovo platform billing. */

export type MerchantPaymentProvider = "STRIPE" | "SQUARE";

export type MerchantConnectionStatus =
  | "not_connected"
  | "onboarding_incomplete"
  | "needs_attention"
  | "connected"
  | "disabled";

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

export const MOCK_CONNECTIONS: MerchantConnectionView[] = [
  {
    provider: "STRIPE",
    status: "connected",
    chargesEnabled: true,
    payoutsEnabled: true,
    onboardingComplete: true,
    merchantAccountId: "acct_1Qa4TuRiversideDental",
    defaultLocationId: null,
    connectedAt: "2026-08-21T15:42:00Z",
    lastError: null,
    canAcceptPayments: true,
  },
  {
    provider: "SQUARE",
    status: "not_connected",
    chargesEnabled: false,
    payoutsEnabled: false,
    onboardingComplete: false,
    merchantAccountId: null,
    defaultLocationId: null,
    connectedAt: null,
    lastError: null,
    canAcceptPayments: false,
  },
];

export const NOT_CONNECTED_CONNECTIONS: MerchantConnectionView[] = [
  { ...MOCK_CONNECTIONS[0], status: "not_connected", chargesEnabled: false, payoutsEnabled: false, onboardingComplete: false, merchantAccountId: null, connectedAt: null, canAcceptPayments: false },
  MOCK_CONNECTIONS[1],
];

export const integrationsTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "Calendars", href: "/integrations?provider=calendar" },
  { label: "Payments", href: "/integrations?provider=stripe" },
];
