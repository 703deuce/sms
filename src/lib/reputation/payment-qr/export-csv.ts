import type { PaymentQrAnalytics } from "./types";

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  cash_app: "Cash App",
  venmo: "Venmo",
  paypal: "PayPal",
  zelle: "Zelle",
};

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function pct(rate: number | null): string {
  if (rate == null) return "";
  return `${(rate * 100).toFixed(1)}%`;
}

export function buildPaymentQrAnalyticsCsv(
  analytics: PaymentQrAnalytics,
  meta: { campaignName: string; days: number }
): string {
  const lines: string[] = [];

  lines.push("Pay & Review Page Analytics Export");
  lines.push(`Campaign: ${csvCell(meta.campaignName)}`);
  lines.push(`Period: Last ${meta.days} days`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Summary");
  lines.push(["Metric", "Value"].map(csvCell).join(","));
  lines.push(["Page views", analytics.pageViews].map(csvCell).join(","));
  lines.push(["Unique visitors", analytics.uniqueVisitors].map(csvCell).join(","));
  lines.push(["QR scans", analytics.qrScans].map(csvCell).join(","));
  lines.push(["Payment-link clicks", analytics.paymentLinkClicks].map(csvCell).join(","));
  lines.push(["Google review clicks", analytics.googleReviewClicks].map(csvCell).join(","));
  lines.push(["Facebook review clicks", analytics.facebookReviewClicks].map(csvCell).join(","));
  lines.push(["Social link clicks", analytics.socialLinkClicks].map(csvCell).join(","));
  lines.push("");
  lines.push("Conversion rates");
  lines.push(
    ["Scan to page view", pct(analytics.conversionRates.scanToPageView)].map(csvCell).join(",")
  );
  lines.push(
    ["Page view to payment click", pct(analytics.conversionRates.pageViewToPaymentClick)]
      .map(csvCell)
      .join(",")
  );
  lines.push(
    ["Page view to review click", pct(analytics.conversionRates.pageViewToReviewClick)]
      .map(csvCell)
      .join(",")
  );
  lines.push("");
  lines.push("Payment-link clicks by provider");
  lines.push(["Provider", "Clicks"].map(csvCell).join(","));
  for (const [provider, count] of Object.entries(analytics.providerClicks)) {
    lines.push([PROVIDER_LABELS[provider] ?? provider, count].map(csvCell).join(","));
  }
  lines.push("");
  lines.push("Amount selections");
  lines.push(["Amount (cents)", "Count"].map(csvCell).join(","));
  for (const [cents, count] of Object.entries(analytics.amountSelections)) {
    lines.push([cents, count].map(csvCell).join(","));
  }
  lines.push("");
  lines.push("Recent activity");
  lines.push(
    ["Time", "Event", "Provider", "Amount cents", "Device"]
      .map(csvCell)
      .join(",")
  );
  for (const row of analytics.recentActivity) {
    lines.push(
      [
        row.createdAt,
        row.eventType,
        row.provider ?? "",
        row.amountSelectedCents ?? "",
        row.deviceCategory ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return lines.join("\n");
}
