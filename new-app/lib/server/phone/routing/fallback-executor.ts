import { getPrisma } from "@/lib/server/db";
import { leaveVoicemailOnCall } from "@/lib/server/phone/voicemail-runtime";
import { dialDestination } from "./forwarding-service";
import { hangupCall, speakOnCall } from "./telnyx-call-control";
import { getCallContextFromSession } from "./session-state";
import { parseFallbackJson, type FallbackActionParsed } from "./routing-logic";

export type FallbackAction = FallbackActionParsed;

export { parseFallbackJson };

export async function executeFallback(input: {
  workspaceId: string;
  humanCallId: string;
  inboundControlId: string;
  phoneNumberId: string | null;
  action: FallbackAction;
  routingSessionId?: string;
}) {
  if (input.action.type === "voicemail") {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      telnyxCallControlId: input.inboundControlId,
      phoneNumberId: input.phoneNumberId,
    });
    return;
  }
  if (input.action.type === "hangup") {
    await hangupCall(input.inboundControlId);
    return;
  }
  if (input.action.type === "announcement" && input.action.announcementText) {
    await speakOnCall(input.inboundControlId, input.action.announcementText, {
      kind: "cf_fallback",
      stage: "announce_then_hangup",
      humanCallId: input.humanCallId,
      workspaceId: input.workspaceId,
    });
    return;
  }
  if (input.action.type === "forward_phone" && input.routingSessionId) {
    const ctx = await getCallContextFromSession(input.routingSessionId);
    let destinationE164 = input.action.destinationE164;
    if (!destinationE164) {
      const { resolveForwardingDestinationById, resolveForwardingDestinationRef, inboundCallContext } =
        await import("./resolve-destination");
      const callCtx = await inboundCallContext(input.workspaceId, input.phoneNumberId);
      if (input.action.destinationId) {
        const resolved = await resolveForwardingDestinationById(
          input.workspaceId,
          input.action.destinationId,
          callCtx,
        );
        destinationE164 = resolved?.dialE164;
      } else if (input.action.destinationWorkspacePhoneId) {
        const resolved = await resolveForwardingDestinationRef(
          input.workspaceId,
          {
            kind: "workspace_number",
            phoneNumberId: input.action.destinationWorkspacePhoneId,
          },
          callCtx,
        );
        destinationE164 = resolved.dialE164;
      }
    }
    if (destinationE164) {
      await dialDestination({
        sessionId: input.routingSessionId,
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        inboundControlId: input.inboundControlId,
        businessLineE164: ctx?.businessLineE164 || "",
        callerE164: ctx?.callerE164 || "",
        destinationE164,
        press1: true,
      });
    }
    return;
  }
  if (input.action.type === "replay_menu" && input.action.menuId) {
    const { startAutoAttendantFlow } = await import("./menu-executor");
    const ctx = input.routingSessionId
      ? await getCallContextFromSession(input.routingSessionId)
      : null;
    await startAutoAttendantFlow({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      phoneNumberId: input.phoneNumberId,
      inboundControlId: input.inboundControlId,
      businessLineE164: ctx?.businessLineE164 || "",
      callerE164: ctx?.callerE164 || "",
      menuId: input.action.menuId,
      menuDepth: 0,
    });
  }
}

export async function resolveNoAnswerFallback(
  workspaceId: string,
  phoneNumberId: string | null,
): Promise<FallbackAction> {
  if (!phoneNumberId) return { type: "voicemail" };
  const policy = await getPrisma().phoneNumberAnsweringPolicy.findUnique({
    where: { phoneNumberId },
  });
  const parsed = parseFallbackJson(
    (policy?.scheduleJson as { noAnswerFallback?: unknown } | null)?.noAnswerFallback,
  );
  if (!parsed) return { type: "voicemail" };
  if (parsed.type === "forward_phone" && !parsed.destinationE164) {
    const { resolveForwardingDestinationById, resolveForwardingDestinationRef, inboundCallContext } =
      await import("./resolve-destination");
    const callCtx = await inboundCallContext(workspaceId, phoneNumberId);
    if (parsed.destinationId) {
      const resolved = await resolveForwardingDestinationById(
        workspaceId,
        parsed.destinationId,
        callCtx,
      );
      if (resolved) return { type: "forward_phone", destinationE164: resolved.dialE164 };
    }
    if (parsed.destinationWorkspacePhoneId) {
      const resolved = await resolveForwardingDestinationRef(
        workspaceId,
        { kind: "workspace_number", phoneNumberId: parsed.destinationWorkspacePhoneId },
        callCtx,
      );
      return { type: "forward_phone", destinationE164: resolved.dialE164 };
    }
  }
  return parsed;
}
