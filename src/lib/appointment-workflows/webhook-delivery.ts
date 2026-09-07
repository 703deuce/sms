import "server-only";

import { createHmac } from "node:crypto";
import { assertSafeWebhookUrl } from "@/lib/voice/url-safety";
import { webhookHostForLog } from "./webhook-log";

export { webhookHostForLog };

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 8_192;

export type AppointmentWebhookPayload = {
  event: string;
  workflowId: string;
  workflowStepId: string;
  stepExecutionId: string;
  workspaceId: string;
  appointmentId: string;
  appointmentType: string | null;
  status: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  staffId: string | null;
  staffName: string | null;
  locationId: string | null;
  locationName: string | null;
  contactId: string | null;
  paymentStatus: string | null;
  triggeredAt: string;
};

export async function deliverAppointmentWorkflowWebhook(input: {
  url: string;
  secret?: string;
  payload: AppointmentWebhookPayload;
  idempotencyKey: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const safeUrl = await assertSafeWebhookUrl(input.url);
  const body = JSON.stringify(input.payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Transovo-Idempotency-Key": input.idempotencyKey,
    "X-Transovo-Event": input.payload.event,
  };
  if (input.secret) {
    const signature = createHmac("sha256", input.secret).update(body).digest("hex");
    headers["X-Transovo-Signature"] = `sha256=${signature}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(safeUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "error",
    });
    await res.arrayBuffer().then((buf) => buf.byteLength > MAX_RESPONSE_BYTES && undefined);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Webhook returned HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook delivery failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

