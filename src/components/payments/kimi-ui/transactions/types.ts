export type TransactionRow = {
  id: string;
  appointmentId: string;
  appointmentTitle: string;
  customerName: string;
  customerPhone: string;
  provider: "stripe" | "square";
  status: "succeeded" | "refunded" | "partially_refunded" | "pending" | "failed";
  paymentMode: "booking" | "payment_link" | "deposit";
  currency: string;
  totalPriceCents: number;
  amountPaidCents: number;
  refundAmountCents: number;
  paidAt: string | null;
  createdAt: string;
};

export const mockTransactions: TransactionRow[] = [
  {
    id: "txn_1024",
    appointmentId: "apt_8012",
    appointmentTitle: "Water Heater Estimate",
    customerName: "Sarah Johnson",
    customerPhone: "+1 (571) 402-1183",
    provider: "stripe",
    status: "succeeded",
    paymentMode: "booking",
    currency: "usd",
    totalPriceCents: 15000,
    amountPaidCents: 15000,
    refundAmountCents: 0,
    paidAt: "2026-09-10T18:43:00Z",
    createdAt: "2026-09-10T18:41:00Z",
  },
  {
    id: "txn_1023",
    appointmentId: "apt_8011",
    appointmentTitle: "Initial Consultation",
    customerName: "Anthony Rivera",
    customerPhone: "+1 (703) 555-0164",
    provider: "square",
    status: "partially_refunded",
    paymentMode: "payment_link",
    currency: "usd",
    totalPriceCents: 25000,
    amountPaidCents: 25000,
    refundAmountCents: 10000,
    paidAt: "2026-09-09T14:03:00Z",
    createdAt: "2026-09-08T20:12:00Z",
  },
  {
    id: "txn_1022",
    appointmentId: "apt_8009",
    appointmentTitle: "HVAC Maintenance Visit",
    customerName: "Maria Chen",
    customerPhone: "+1 (571) 555-0190",
    provider: "stripe",
    status: "succeeded",
    paymentMode: "deposit",
    currency: "usd",
    totalPriceCents: 18000,
    amountPaidCents: 5000,
    refundAmountCents: 0,
    paidAt: "2026-09-08T12:20:00Z",
    createdAt: "2026-09-08T12:19:00Z",
  },
  {
    id: "txn_1021",
    appointmentId: "apt_8006",
    appointmentTitle: "Kitchen Remodel Walkthrough",
    customerName: "David Okafor",
    customerPhone: "+1 (240) 555-0177",
    provider: "stripe",
    status: "refunded",
    paymentMode: "booking",
    currency: "usd",
    totalPriceCents: 7500,
    amountPaidCents: 7500,
    refundAmountCents: 7500,
    paidAt: "2026-09-06T16:52:00Z",
    createdAt: "2026-09-06T16:50:00Z",
  },
  {
    id: "txn_1020",
    appointmentId: "apt_8004",
    appointmentTitle: "Annual Plumbing Inspection",
    customerName: "Priya Patel",
    customerPhone: "+1 (202) 555-0143",
    provider: "square",
    status: "succeeded",
    paymentMode: "booking",
    currency: "usd",
    totalPriceCents: 9500,
    amountPaidCents: 9500,
    refundAmountCents: 0,
    paidAt: "2026-09-05T09:31:00Z",
    createdAt: "2026-09-05T09:30:00Z",
  },
  {
    id: "txn_1019",
    appointmentId: "apt_8002",
    appointmentTitle: "Water Heater Estimate",
    customerName: "Tom Nguyen",
    customerPhone: "+1 (571) 555-0121",
    provider: "stripe",
    status: "pending",
    paymentMode: "payment_link",
    currency: "usd",
    totalPriceCents: 15000,
    amountPaidCents: 0,
    refundAmountCents: 0,
    paidAt: null,
    createdAt: "2026-09-04T21:07:00Z",
  },
  {
    id: "txn_1018",
    appointmentId: "apt_7998",
    appointmentTitle: "Bathroom Fixture Install",
    customerName: "Elena Morales",
    customerPhone: "+1 (301) 555-0119",
    provider: "stripe",
    status: "failed",
    paymentMode: "deposit",
    currency: "usd",
    totalPriceCents: 12000,
    amountPaidCents: 0,
    refundAmountCents: 0,
    paidAt: null,
    createdAt: "2026-09-03T15:44:00Z",
  },
  {
    id: "txn_1017",
    appointmentId: "apt_7995",
    appointmentTitle: "Initial Consultation",
    customerName: "James Whitfield",
    customerPhone: "+1 (703) 555-0132",
    provider: "square",
    status: "succeeded",
    paymentMode: "booking",
    currency: "usd",
    totalPriceCents: 20000,
    amountPaidCents: 20000,
    refundAmountCents: 0,
    paidAt: "2026-09-02T11:18:00Z",
    createdAt: "2026-09-02T11:16:00Z",
  },
  {
    id: "txn_1016",
    appointmentId: "apt_7991",
    appointmentTitle: "HVAC Maintenance Visit",
    customerName: "Grace Kim",
    customerPhone: "+1 (571) 555-0174",
    provider: "stripe",
    status: "succeeded",
    paymentMode: "deposit",
    currency: "usd",
    totalPriceCents: 18000,
    amountPaidCents: 5000,
    refundAmountCents: 0,
    paidAt: "2026-08-30T13:58:00Z",
    createdAt: "2026-08-30T13:57:00Z",
  },
  {
    id: "txn_1015",
    appointmentId: "apt_7988",
    appointmentTitle: "Annual Plumbing Inspection",
    customerName: "Robert Alvarez",
    customerPhone: "+1 (202) 555-0188",
    provider: "square",
    status: "succeeded",
    paymentMode: "booking",
    currency: "usd",
    totalPriceCents: 9500,
    amountPaidCents: 9500,
    refundAmountCents: 0,
    paidAt: "2026-08-28T17:26:00Z",
    createdAt: "2026-08-28T17:24:00Z",
  },
];

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function appointmentHref(id: string) {
  return `/appointments/${id}`;
}

export function providerDashboardHref(provider: "stripe" | "square", txnId: string) {
  return provider === "stripe"
    ? `https://dashboard.stripe.com/payments/${txnId}`
    : `https://squareup.com/dashboard/sales/transactions/${txnId}`;
}
