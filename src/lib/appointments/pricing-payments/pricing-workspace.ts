import type { AppointmentTypeConfig, CommerceDefaults, PaymentRequirement } from "@/lib/appointments/types";
import { calculatePaymentAmounts } from "@/lib/merchant-payments/amounts";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";

export type OfferingKind = "Service" | "Meeting" | "Class" | "Workshop";

export type OfferingPaymentRow = {
  id: string;
  name: string;
  kind: OfferingKind;
  priceCents: number;
  priceLabel: string;
  collectionLabel: string;
  collectionMode: string;
  depositLabel: string;
  accessLabel: string;
  status: "ready" | "no_provider" | "no_price" | "setup_issue";
  statusLabel: string;
  usesDefault: boolean;
  config: AppointmentTypeConfig;
};

export function formatMoney(cents: number, currency = "usd"): string {
  if (!cents) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

export function normalizePaymentMode(mode?: PaymentRequirement["mode"]): "none" | "full" | "deposit" {
  if (!mode || mode === "none" || mode === "optional" || mode === "save_card") return "none";
  if (mode === "full" || mode === "pay_what_you_want" || mode === "customer_choice") return "full";
  if (
    mode === "deposit" ||
    mode === "deposit_fixed" ||
    mode === "deposit_percent"
  ) {
    return "deposit";
  }
  return "none";
}

export function collectionLabel(payment?: PaymentRequirement, defaults?: CommerceDefaults): string {
  const mode = payment?.mode ? normalizePaymentMode(payment.mode) : defaults?.paymentMode || "none";
  if (mode === "full") return "Full payment";
  if (mode === "deposit") return "Deposit";
  if (payment?.mode === "none" && (payment.priceCents || 0) > 0) return "Pay later";
  return "Free";
}

export function depositLabel(payment?: PaymentRequirement, defaults?: CommerceDefaults): string {
  const mode = payment?.mode ? normalizePaymentMode(payment.mode) : defaults?.paymentMode;
  if (mode !== "deposit") return "—";
  const cents =
    payment?.depositCents ??
    (payment?.depositPercent
      ? Math.round((payment.priceCents || 0) * (payment.depositPercent / 100))
      : defaults?.depositCents);
  const pct = payment?.depositPercent ?? defaults?.depositPercent;
  if (cents) return formatMoney(cents);
  if (pct) return `${pct}%`;
  return "—";
}

export function effectivePayment(
  config: AppointmentTypeConfig,
  defaults?: CommerceDefaults,
): PaymentRequirement | undefined {
  if (config.payment?.mode) return config.payment;
  if (!defaults?.paymentMode || defaults.paymentMode === "none") return config.payment;
  return {
    mode: defaults.paymentMode,
    priceCents: config.payment?.priceCents,
    depositCents: defaults.depositType === "fixed" ? defaults.depositCents : undefined,
    depositPercent: defaults.depositType === "percent" ? defaults.depositPercent : undefined,
    provider: defaults.defaultProvider,
    currency: config.payment?.currency || "usd",
  };
}

export function resolveOfferingKind(
  config?: AppointmentTypeConfig | null,
  segment?: string,
): OfferingKind {
  const kind = resolveBookingTypeKind(config);
  if (kind === "MEETING") return "Meeting";
  if (kind === "CLASS") {
    return config?.classPresentation === "workshop_event" || segment === "workshop"
      ? "Workshop"
      : "Class";
  }
  return "Service";
}

export function buildOfferingRows(
  types: Array<{
    id: string;
    name: string;
    durationMinutes?: number;
    config?: AppointmentTypeConfig | null;
    active?: boolean;
  }>,
  defaults: CommerceDefaults | undefined,
  packageLinks: Map<string, number>,
  membershipLinks: Map<string, number>,
  providerReady: boolean,
): OfferingPaymentRow[] {
  return types
    .filter((t) => t.config?.enabled !== false && t.active !== false)
    .map((type) => {
      const config = (type.config || {}) as AppointmentTypeConfig;
      const payment = effectivePayment(config, defaults);
      const priceCents = payment?.priceCents || 0;
      const hasExplicit = Boolean(config.payment?.mode);
      const usesDefault = !hasExplicit && Boolean(defaults?.paymentMode);
      const mode = payment?.mode || "none";
      const needsProvider =
        normalizePaymentMode(mode) !== "none" && normalizePaymentMode(mode) !== undefined;
      let status: OfferingPaymentRow["status"] = "ready";
      let statusLabel = "Ready";
      if (needsProvider && !payment?.provider) {
        status = "no_provider";
        statusLabel = "No provider";
      } else if (needsProvider && !providerReady) {
        status = "setup_issue";
        statusLabel = "Provider not ready";
      } else if (needsProvider && priceCents <= 0) {
        status = "no_price";
        statusLabel = "Price missing";
      }
      const pkg = packageLinks.get(type.id) || 0;
      const mem = membershipLinks.get(type.id) || 0;
      const accessParts: string[] = [];
      if (pkg) accessParts.push("Packages");
      if (mem) accessParts.push("Membership");
      return {
        id: type.id,
        name: type.name,
        kind: resolveOfferingKind(config),
        priceCents,
        priceLabel: formatMoney(priceCents),
        collectionLabel: collectionLabel(payment, defaults),
        collectionMode: normalizePaymentMode(mode),
        depositLabel: depositLabel(payment, defaults),
        accessLabel: accessParts.length ? accessParts.join(" + ") : "—",
        status,
        statusLabel,
        usesDefault,
        config,
      };
    });
}

export function checkoutBreakdown(payment: PaymentRequirement) {
  const normalized: PaymentRequirement = {
    ...payment,
    mode:
      payment.mode === "deposit_fixed" || payment.mode === "deposit_percent"
        ? "deposit"
        : payment.mode === "deposit"
          ? "deposit"
          : payment.mode === "full"
            ? "full"
            : "none",
  };
  if (normalized.mode === "none") {
    return {
      totalCents: payment.priceCents || 0,
      dueNowCents: 0,
      balanceCents: payment.priceCents || 0,
      label: (payment.priceCents || 0) > 0 ? "Pay later" : "Free",
    };
  }
  const amounts = calculatePaymentAmounts({
    mode: normalized.mode as "deposit" | "full",
    priceCents: payment.priceCents || 0,
    depositCents: payment.depositCents,
    depositPercent: payment.depositPercent,
    currency: payment.currency,
    provider: payment.provider || "stripe",
  });
  return {
    totalCents: amounts.totalPriceCents,
    dueNowCents: amounts.amountDueCents,
    balanceCents: amounts.balanceDueCents,
    label: normalized.mode === "deposit" ? "Deposit checkout" : "Full payment",
  };
}

export function offeringEditorHref(row: OfferingPaymentRow): string {
  switch (row.kind) {
    case "Meeting":
      return `/appointments/meetings/${row.id}?section=pricing-access`;
    case "Class":
      return `/appointments/classes/${row.id}?section=pricing`;
    case "Workshop":
      return `/appointments/workshops/${row.id}?section=pricing`;
    default:
      return `/appointments/services/${row.id}?section=pricing-access`;
  }
}

export function defaultCollectionSummary(
  defaults: CommerceDefaults | undefined,
  offeringRows: OfferingPaymentRow[],
): string {
  const mode = defaults?.paymentMode || "none";
  const label = collectionLabel({ mode, priceCents: 0 }, defaults);
  const custom = offeringRows.filter((r) => !r.usesDefault).length;
  return `${label}${custom ? ` · ${custom} custom` : ""}`;
}
