import "server-only";

import type { MctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";
import {
  requirePlatformSenderAssignmentForOutbound,
  touchPlatformSenderAssignment,
  type PlatformSenderClaimResult,
} from "@/lib/mctb/messaging/platform-sender-assignment";

export type PlatformOutboundGateResult =
  | { ok: true; claim: PlatformSenderClaimResult }
  | { ok: false; reason: "PLATFORM_SENDER_PAIR_COLLISION"; ownerWorkspaceId: string };

export async function gateMctbPlatformOutboundSend(input: {
  workspaceId: string;
  route: MctbOutboundSmsRoute;
  consumerE164: string;
  conversationId?: string | null;
  missedCallEventId?: string | null;
}): Promise<PlatformOutboundGateResult> {
  if (input.route.senderMode !== "PLATFORM" || !input.route.phoneNumberId) {
    return { ok: true, claim: { status: "NOT_PLATFORM" } };
  }

  const claim = await requirePlatformSenderAssignmentForOutbound({
    workspaceId: input.workspaceId,
    consumerE164: input.consumerE164,
    platformPhoneNumberId: input.route.phoneNumberId,
    conversationId: input.conversationId,
    missedCallEventId: input.missedCallEventId,
  });

  if (claim.status === "COLLISION") {
    return { ok: false, reason: "PLATFORM_SENDER_PAIR_COLLISION", ownerWorkspaceId: claim.ownerWorkspaceId };
  }

  return { ok: true, claim };
}

export async function touchMctbPlatformAssignmentAfterOutbound(input: {
  workspaceId: string;
  route: MctbOutboundSmsRoute;
  consumerE164: string;
  conversationId?: string | null;
  claim: PlatformSenderClaimResult;
}) {
  if (input.route.senderMode !== "PLATFORM" || !input.route.phoneNumberId) return;
  if (input.claim.status !== "CLAIMED" && input.claim.status !== "REUSED") return;
  await touchPlatformSenderAssignment({
    assignmentId: input.claim.assignmentId,
    workspaceId: input.workspaceId,
    consumerE164: input.consumerE164,
    platformPhoneNumberId: input.route.phoneNumberId,
    conversationId: input.conversationId,
  });
}
