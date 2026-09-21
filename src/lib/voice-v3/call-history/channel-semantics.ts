import "server-only";

/**
 * Telnyx dual-channel recordings: channel A (index 0) = first call leg, channel B = remaining legs.
 * @see https://developers.telnyx.com/api-reference/call-commands/recording-start
 *
 * For inbound PSTN → SIP forward, the PSTN caller is usually leg A, but we confirm with
 * native-transcript overlap before labeling caller/agent (cert can override via metadata).
 */

export type ChannelRole = "caller" | "agent" | "channel_0" | "channel_1";

export type ChannelSemanticsSource =
  | "native_overlap"
  | "telnyx_inbound_default"
  | "cert_metadata"
  | "unresolved";

export type ResolvedChannelMap = {
  /** Deepgram/Telnyx channel index → customer-facing speaker id */
  byChannel: Record<number, ChannelRole>;
  source: ChannelSemanticsSource;
  confidence: "high" | "low";
};

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function overlapScore(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const w of ta) {
    if (tb.has(w)) hit += 1;
  }
  return hit / Math.max(ta.size, tb.size);
}

export function resolveDualChannelSpeakerMap(input: {
  channelTexts: Array<{ channel: number; text: string }>;
  nativeCallerText?: string;
  nativeAgentText?: string;
  callDirection?: string | null;
  certChannelMap?: Record<string, "caller" | "agent"> | null;
}): ResolvedChannelMap {
  if (input.certChannelMap && Object.keys(input.certChannelMap).length >= 2) {
    const byChannel: Record<number, ChannelRole> = {};
    for (const [k, v] of Object.entries(input.certChannelMap)) {
      const idx = Number(k);
      if (Number.isFinite(idx)) byChannel[idx] = v;
    }
    return { byChannel, source: "cert_metadata", confidence: "high" };
  }

  const ch0 = input.channelTexts.find((c) => c.channel === 0)?.text ?? "";
  const ch1 = input.channelTexts.find((c) => c.channel === 1)?.text ?? "";

  if (input.nativeCallerText?.trim() && input.nativeAgentText?.trim()) {
    const scoreA =
      overlapScore(ch0, input.nativeCallerText) + overlapScore(ch1, input.nativeAgentText);
    const scoreB =
      overlapScore(ch1, input.nativeCallerText) + overlapScore(ch0, input.nativeAgentText);
    if (Math.abs(scoreA - scoreB) > 0.05) {
      const swap = scoreB > scoreA;
      return {
        byChannel: swap ? { 0: "agent", 1: "caller" } : { 0: "caller", 1: "agent" },
        source: "native_overlap",
        confidence: "high",
      };
    }
  }

  const inbound =
    String(input.callDirection || "").toUpperCase() === "INBOUND" ||
    String(input.callDirection || "").toLowerCase() === "inbound";
  if (inbound && ch0.trim() && ch1.trim()) {
    return {
      byChannel: { 0: "caller", 1: "agent" },
      source: "telnyx_inbound_default",
      confidence: "low",
    };
  }

  return {
    byChannel: { 0: "channel_0", 1: "channel_1" },
    source: "unresolved",
    confidence: "low",
  };
}

export function mapChannelRoleToSegmentSpeaker(role: ChannelRole): string {
  if (role === "caller" || role === "agent") return role;
  return role;
}
