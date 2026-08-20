/**
 * Marketplace ops alerts — structured logs + optional webhook fan-out.
 * Set MARKETPLACE_ALERT_WEBHOOK_URL for Slack/PagerDuty/etc.
 */

export type MarketplaceAlertSeverity = "info" | "warning" | "critical";

export type MarketplaceAlertCategory =
  | "number_purchase_failed"
  | "payment_failed"
  | "stripe_webhook_failed"
  | "provider_api_failed"
  | "forwarding_failed"
  | "voicemail_failed"
  | "transcription_failed"
  | "http_5xx";

export type MarketplaceAlertInput = {
  severity: MarketplaceAlertSeverity;
  category: MarketplaceAlertCategory;
  message: string;
  workspaceId?: string;
  userId?: string;
  reservationId?: string;
  phoneNumber?: string;
  provider?: string;
  error?: string;
  context?: Record<string, unknown>;
};

const WEBHOOK_URL = process.env.MARKETPLACE_ALERT_WEBHOOK_URL?.trim() || "";

export async function emitMarketplaceAlert(input: MarketplaceAlertInput): Promise<void> {
  const payload = {
    scope: "marketplace_alert",
    ts: new Date().toISOString(),
    severity: input.severity,
    category: input.category,
    message: input.message,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    reservation_id: input.reservationId,
    phone_number: input.phoneNumber,
    provider: input.provider,
    error: input.error,
    context: input.context ?? {},
  };

  const line = JSON.stringify(payload);
  if (input.severity === "critical") {
    console.error(line);
  } else if (input.severity === "warning") {
    console.warn(line);
  } else {
    console.info(line);
  }

  if (!WEBHOOK_URL) return;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[${input.severity.toUpperCase()}] ${input.category}: ${input.message}`,
        ...payload,
      }),
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        scope: "marketplace_alert",
        delivery: "webhook_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
