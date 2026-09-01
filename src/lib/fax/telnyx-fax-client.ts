import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import type { TelnyxFaxPayload } from "./types";

export function getTelnyxFaxApplicationId(): string {
  const id = process.env.TELNYX_FAX_APPLICATION_ID?.trim();
  if (!id) throw new Error("TELNYX_FAX_APPLICATION_ID is not configured");
  return id;
}

export async function sendTelnyxFax(input: {
  from: string;
  to: string;
  mediaUrl: string;
  connectionId?: string | null;
  clientState?: Record<string, unknown>;
}) {
  const connectionId = input.connectionId || getTelnyxFaxApplicationId();
  const body: Record<string, unknown> = {
    connection_id: connectionId,
    from: input.from,
    to: input.to,
    media_url: input.mediaUrl,
  };
  if (input.clientState) {
    body.client_state = Buffer.from(JSON.stringify(input.clientState)).toString("base64");
  }
  const res = await telnyxRequest<{ data: TelnyxFaxPayload }>("/faxes", {
    method: "POST",
    body,
  });
  return res.data;
}

export async function getTelnyxFax(faxId: string) {
  const res = await telnyxRequest<{ data: TelnyxFaxPayload }>(`/faxes/${encodeURIComponent(faxId)}`);
  return res.data;
}

export async function cancelTelnyxFax(faxId: string) {
  await telnyxRequest(`/faxes/${encodeURIComponent(faxId)}/actions/cancel`, { method: "POST", body: {} });
}

export function mapTelnyxFaxStatus(status: string | undefined): string {
  const s = String(status || "").toLowerCase();
  if (s === "queued" || s === "pending") return "queued";
  if (s === "media.processed" || s === "media_processed") return "media_processed";
  if (s === "sending" || s === "in_progress") return "sending";
  if (s === "delivered" || s === "completed" || s === "success") return "delivered";
  if (s === "failed" || s === "failure") return "failed";
  if (s === "received") return "received";
  return s || "queued";
}
