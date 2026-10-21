import "server-only";

import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { resolvePlatformInboundDestination } from "@/lib/messaging/platform-inbound-destination";
import { dispatchPlatformMctbInboundSms } from "@/lib/messaging/platform-mctb-inbound-dispatch";
import { telnyxEventType } from "@/lib/server/telnyx/webhook-auth";

function parseTelnyxInboundSms(payload: unknown): {
  from: string | null;
  to: string | null;
  body: string;
  providerMessageId: string | null;
  mediaUrls: string[];
} {
  const root = (payload || {}) as Record<string, unknown>;
  const data = (root.data || {}) as Record<string, unknown>;
  const eventPayload = (data.payload || {}) as Record<string, unknown>;
  const from = typeof eventPayload.from === "string"
    ? eventPayload.from
    : typeof (eventPayload.from as { phone_number?: string })?.phone_number === "string"
      ? (eventPayload.from as { phone_number: string }).phone_number
      : null;
  const toList = eventPayload.to as Array<{ phone_number?: string }> | undefined;
  const to =
    typeof eventPayload.to === "string"
      ? eventPayload.to
      : Array.isArray(toList) && toList[0]?.phone_number
        ? toList[0].phone_number
        : null;
  const body = String(eventPayload.text || eventPayload.body || "");
  const providerMessageId = String(eventPayload.id || data.id || "");
  const media = (eventPayload.media || []) as Array<{ url?: string }>;
  const mediaUrls = media.map((m) => m.url).filter((u): u is string => Boolean(u));
  return {
    from,
    to,
    body,
    providerMessageId: providerMessageId || null,
    mediaUrls,
  };
}

export async function handleTelnyxMessagingWebhook(payload: unknown) {
  const eventType = telnyxEventType(payload);
  if (eventType && eventType !== "message.received") {
    return { ok: true as const, skipped: true as const, reason: "not_inbound", eventType };
  }

  const parsed = parseTelnyxInboundSms(payload);
  if (!parsed.to || !parsed.from) {
    return { ok: true as const, skipped: true as const, reason: "missing_from_or_to" };
  }
  if (!parsed.providerMessageId) {
    return { ok: false as const, error: "missing_provider_message_id" };
  }

  let fromE164 = parsed.from;
  let toE164 = parsed.to;
  try {
    fromE164 = normalizeE164(parsed.from);
  } catch {
    // keep
  }
  try {
    toE164 = normalizeE164(parsed.to);
  } catch {
    // keep
  }

  const destination = await resolvePlatformInboundDestination(toE164);
  if (destination) {
    const core = await dispatchPlatformMctbInboundSms({
      channel: "telnyx",
      destination,
      fromE164,
      body: parsed.body,
      providerMessageId: parsed.providerMessageId,
      mediaUrls: parsed.mediaUrls,
    });
    return { ok: true as const, platformSender: true, ...core };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: toE164, status: "Active" },
    select: { workspaceId: true },
  });
  if (!phone) {
    return { ok: true as const, skipped: true as const, reason: "unmatched_destination" };
  }

  return { ok: true as const, skipped: true as const, reason: "workspace_number_not_platform" };
}
