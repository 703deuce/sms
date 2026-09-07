export type UsageRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  outbound: number;
  costCents: number;
  smsSegments: number;
  mmsMessages: number;
};

export type Metrics = {
  balance: number;
  creditsRemaining: number;
  messagesSentPeriod: number;
};

export type Billing = {
  plan: string;
  balanceCents: number;
  balance: number;
  creditTrackingEnabled: boolean;
  stripeConfigured: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type LedgerEntry = {
  id: string;
  amountCents: number;
  balanceAfterCents?: number | null;
  description: string;
  source: string;
  createdAt: string;
};

export type Estimate = {
  currency: string;
  periodLabel: string;
  lineItems: Array<{ id: string; label: string; amountCents: number; detail?: string }>;
  subtotalCents: number;
  estimatedTaxCents: number;
  totalCents: number;
  notes: string[];
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountDue: number;
    amountPaid: number;
    created: number;
    hostedInvoiceUrl: string | null;
    pdf: string | null;
  }>;
};

export const mockMetrics: Metrics = {
  balance: 214.5,
  creditsRemaining: 21450,
  messagesSentPeriod: 1284,
};

export const mockBilling: Billing = {
  plan: "growth",
  balanceCents: 21450,
  balance: 214.5,
  creditTrackingEnabled: true,
  stripeConfigured: true,
  stripeCustomerId: "cus_Qx8K2mA1bT",
  stripeSubscriptionId: "sub_1Pa9LmKdR4",
};

export const mockUsage: UsageRow[] = [
  {
    id: "u1",
    periodStart: "2025-10-01T00:00:00Z",
    periodEnd: "2025-10-31T23:59:59Z",
    outbound: 1284,
    costCents: 4860,
    smsSegments: 1392,
    mmsMessages: 24,
  },
  {
    id: "u2",
    periodStart: "2025-09-01T00:00:00Z",
    periodEnd: "2025-09-30T23:59:59Z",
    outbound: 1107,
    costCents: 4211,
    smsSegments: 1180,
    mmsMessages: 19,
  },
  {
    id: "u3",
    periodStart: "2025-08-01T00:00:00Z",
    periodEnd: "2025-08-31T23:59:59Z",
    outbound: 968,
    costCents: 3610,
    smsSegments: 1012,
    mmsMessages: 11,
  },
];

export const mockLedger: LedgerEntry[] = [
  {
    id: "l1",
    amountCents: 5000,
    balanceAfterCents: 26450,
    description: "Credit purchase",
    source: "stripe_checkout",
    createdAt: "2025-10-12T15:24:00Z",
  },
  {
    id: "l2",
    amountCents: -4860,
    balanceAfterCents: 21450,
    description: "Appointment reminder SMS usage — October",
    source: "usage_settlement",
    createdAt: "2025-10-31T23:59:00Z",
  },
  {
    id: "l3",
    amountCents: 2500,
    balanceAfterCents: 26310,
    description: "Credit purchase",
    source: "stripe_checkout",
    createdAt: "2025-09-08T10:02:00Z",
  },
  {
    id: "l4",
    amountCents: -4211,
    balanceAfterCents: 23810,
    description: "Appointment reminder SMS usage — September",
    source: "usage_settlement",
    createdAt: "2025-09-30T23:59:00Z",
  },
  {
    id: "l5",
    amountCents: 1000,
    balanceAfterCents: 28021,
    description: "Promotional credit",
    source: "adjustment",
    createdAt: "2025-08-15T09:41:00Z",
  },
  {
    id: "l6",
    amountCents: -3610,
    balanceAfterCents: 27021,
    description: "Appointment reminder SMS usage — August",
    source: "usage_settlement",
    createdAt: "2025-08-31T23:59:00Z",
  },
];

export const mockEstimate: Estimate = {
  currency: "usd",
  periodLabel: "November 2025",
  lineItems: [
    { id: "li1", label: "Growth plan", amountCents: 4900, detail: "Monthly subscription" },
    { id: "li2", label: "Reminder SMS usage", amountCents: 4860, detail: "1,284 messages · 1,392 segments" },
    { id: "li3", label: "MMS messages", amountCents: 360, detail: "24 messages" },
  ],
  subtotalCents: 10120,
  estimatedTaxCents: 0,
  totalCents: 10120,
  notes: [
    "Usage charges are estimated from the current billing period and may change before invoicing.",
    "Credit balance is applied automatically to usage before card charges.",
  ],
  invoices: [
    {
      id: "in_1Pa9Lm001",
      number: "TV-2025-0042",
      status: "paid",
      amountDue: 0,
      amountPaid: 9760,
      created: 1761868800,
      hostedInvoiceUrl: "https://invoice.stripe.com/i/example1",
      pdf: "https://pay.stripe.com/invoice/example1/pdf",
    },
    {
      id: "in_1P9xKq002",
      number: "TV-2025-0038",
      status: "paid",
      amountDue: 0,
      amountPaid: 9111,
      created: 1759276800,
      hostedInvoiceUrl: "https://invoice.stripe.com/i/example2",
      pdf: "https://pay.stripe.com/invoice/example2/pdf",
    },
    {
      id: "in_1P8fRt003",
      number: "TV-2025-0031",
      status: "paid",
      amountDue: 0,
      amountPaid: 8510,
      created: 1756598400,
      hostedInvoiceUrl: "https://invoice.stripe.com/i/example3",
      pdf: "https://pay.stripe.com/invoice/example3/pdf",
    },
  ],
};

export const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Team", href: "/settings/users" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Calendar", href: "/settings/calendar" },
  { label: "Meetings", href: "/settings/ai-notetaker" },
  { label: "Security", href: "/settings/security" },
  { label: "Billing", href: "/settings/billing" },
];

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(iso: string | number) {
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function titleCasePlan(plan: string) {
  if (!plan) return "—";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
