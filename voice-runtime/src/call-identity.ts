import type { JobContext } from "@livekit/agents";
import { RoomEvent, type RemoteParticipant } from "@livekit/rtc-node";
import { resolveFallbackInboundCalledNumber } from "@/lib/telephony/provisioning";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseDispatchAttributes, parseRoomMetadata, type RoomMetadata } from "./metadata";

function normalizeCalledE164(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  try {
    return normalizeE164(phone.trim());
  } catch {
    return phone.trim();
  }
}

export type InboundSipCallIdentity = {
  participant: RemoteParticipant;
  parsedMeta: RoomMetadata | null;
  fromE164?: string;
  toE164?: string;
  sipAttributes: Record<string, string>;
  toE164Source: string;
};

function readParticipantAttributes(participant: RemoteParticipant): Record<string, string> {
  return Object.fromEntries(Object.entries(participant.attributes || {}));
}

function extractCallNumbers(
  attrs: Record<string, string>,
  meta: RoomMetadata | null,
  participant: RemoteParticipant,
): { fromE164?: string; toE164?: string; toE164Source: string } {
  const fromE164 =
    meta?.fromE164 ||
    attrs["sip.phoneNumber"] ||
    attrs.fromE164 ||
    attrs.callerNumber ||
    participant.identity;

  const trunkNumber =
    attrs["sip.trunkPhoneNumber"] || attrs["sip.trunkNumber"] || attrs.trunkPhoneNumber;
  const toE164 =
    meta?.toE164 ||
    trunkNumber ||
    attrs["sip.calledNumber"] ||
    attrs.calledNumber ||
    attrs.toE164;

  let toE164Source = "unknown";
  if (meta?.toE164) toE164Source = "room_metadata";
  else if (trunkNumber) toE164Source = "sip.trunkPhoneNumber";
  else if (attrs["sip.calledNumber"] || attrs.calledNumber) toE164Source = "sip.calledNumber";

  return { fromE164, toE164, toE164Source };
}

async function waitForSipAttributes(
  participant: RemoteParticipant,
  room: JobContext["room"],
  timeoutMs = 10_000,
): Promise<Record<string, string>> {
  const read = () => readParticipantAttributes(participant);
  let attrs = read();
  if (attrs["sip.trunkPhoneNumber"] || attrs["sip.phoneNumber"] || attrs["sip.trunkID"]) {
    return attrs;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(read());
    }, timeoutMs);

    const onChanged = (_changed: Record<string, string>, p: { identity: string }) => {
      if (p.identity !== participant.identity) return;
      attrs = read();
      if (attrs["sip.trunkPhoneNumber"] || attrs["sip.phoneNumber"] || attrs["sip.trunkID"]) {
        cleanup();
        resolve(attrs);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      room.off(RoomEvent.ParticipantAttributesChanged, onChanged);
    };

    room.on(RoomEvent.ParticipantAttributesChanged, onChanged);
  });
}

/** Connect, wait for SIP participant + attrs, resolve called/caller numbers. */
export async function resolveInboundSipCallIdentity(
  ctx: JobContext,
): Promise<InboundSipCallIdentity> {
  await ctx.connect();

  const participant = await ctx.waitForParticipant();
  const sipAttributes = await waitForSipAttributes(participant, ctx.room);

  const parsedMeta =
    parseRoomMetadata(ctx.room.metadata) || parseDispatchAttributes(sipAttributes);

  let { fromE164, toE164, toE164Source } = extractCallNumbers(
    sipAttributes,
    parsedMeta,
    participant,
  );

  if (!toE164) {
    const fallback = await resolveFallbackInboundCalledNumber({
      trunkId: sipAttributes["sip.trunkID"],
      ruleId: sipAttributes["sip.ruleID"],
    });
    if (fallback) {
      toE164 = fallback;
      toE164Source = "fallback";
    }
  }

  toE164 = normalizeCalledE164(toE164);

  return {
    participant,
    parsedMeta,
    fromE164,
    toE164,
    sipAttributes,
    toE164Source,
  };
}
