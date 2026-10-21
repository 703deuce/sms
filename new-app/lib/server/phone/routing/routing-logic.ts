/** Pure helpers for webhook + unit tests (no I/O). */

export function extractGatherDigits(payload: Record<string, unknown>) {
  return String(
    (payload as { digits?: string }).digits ||
      (payload as { dtmf_digits?: string }).dtmf_digits ||
      "",
  )
    .replace(/\D/g, "")
    .slice(-1);
}

export function simultaneousRaceLost(
  bridgeWinnerControlId: string | undefined,
  outboundControlId: string,
) {
  return Boolean(bridgeWinnerControlId && bridgeWinnerControlId !== outboundControlId);
}

export function shouldTrySequentialOnHangup(input: {
  simultaneous: boolean;
  queueLength: number;
  bridgeWinnerControlId?: string;
  outboundControlId: string;
}) {
  if (input.simultaneous) {
    if (simultaneousRaceLost(input.bridgeWinnerControlId, input.outboundControlId)) {
      return false;
    }
    return false;
  }
  return input.queueLength > 0;
}

export type FallbackActionParsed = {
  type: "voicemail" | "forward_phone" | "announcement" | "hangup" | "replay_menu" | "conversational_ivr";
  destinationE164?: string;
  destinationId?: string;
  destinationWorkspacePhoneId?: string;
  announcementText?: string;
  menuId?: string;
};

export function parseFallbackJson(raw: unknown): FallbackActionParsed | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = String(o.type || "");
  if (type === "voicemail") return { type: "voicemail" };
  if (type === "conversational_ivr") return { type: "conversational_ivr" };
  if (type === "hangup") return { type: "hangup" };
  if (type === "replay_menu" && o.menuId) return { type: "replay_menu", menuId: String(o.menuId) };
  if (type === "forward_phone") {
    if (o.destinationId) {
      return { type: "forward_phone", destinationId: String(o.destinationId) };
    }
    if (o.destinationE164) {
      return { type: "forward_phone", destinationE164: String(o.destinationE164) };
    }
    const refKind = String(o.destinationRefKind || "");
    if (refKind === "external_phone" && o.destinationRefE164) {
      return { type: "forward_phone", destinationE164: String(o.destinationRefE164) };
    }
    if (refKind === "workspace_number" && o.destinationRefPhoneNumberId) {
      return {
        type: "forward_phone",
        destinationWorkspacePhoneId: String(o.destinationRefPhoneNumberId),
      };
    }
  }
  if (type === "announcement" && o.announcementText) {
    return { type: "announcement", announcementText: String(o.announcementText) };
  }
  return null;
}
