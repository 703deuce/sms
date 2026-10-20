export function maskTransferE164(e164: string | null | undefined): string | null {
  const v = e164?.trim();
  if (!v) return null;
  if (v.length <= 4) return "***";
  return `${v.slice(0, -4).replace(/\d/g, "*")}${v.slice(-4)}`;
}

export type VoiceV3TransferBillingTelemetry = {
  transfer_request_id: string;
  route_id: string;
  provider: "livekit" | "telnyx";
  routing: "single" | "waterfall";
  outcome: string;
  waterfall_attempt_count: number;
  destination_ids: string[];
  modes: string[];
  ringing_duration_ms?: number;
  warm_consult_duration_ms?: number;
  connected_duration_ms?: number;
};

export function logVoiceV3TransferEvent(
  event: string,
  fields: Record<string, unknown>,
): void {
  const safe = { ...fields };
  if (typeof safe.dial_target === "string") {
    safe.dial_target = maskTransferE164(safe.dial_target.replace(/^tel:/, ""));
  }
  if (typeof safe.outbound_caller_id_e164 === "string") {
    safe.outbound_caller_id_e164 = maskTransferE164(safe.outbound_caller_id_e164);
  }
  console.log(event, safe);
}

/** Usage/billing row — no raw phone numbers or trunk secrets. */
export function logVoiceV3TransferBillingUsage(payload: VoiceV3TransferBillingTelemetry): void {
  logVoiceV3TransferEvent("VOICE_V3_TRANSFER_BILLING_USAGE", payload as Record<string, unknown>);
}
