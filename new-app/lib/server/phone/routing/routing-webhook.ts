import { getPrisma } from "@/lib/server/db";
import { decodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { handleIvrGatherEnded } from "./menu-executor";
import { handleScreeningGather, dialDestination } from "./forwarding-service";
import { gatherUsingSpeak, bridgeCalls, hangupCall } from "./telnyx-call-control";
import {
  recordBridgedConversation,
  recordMissedForward,
  recordLegEnded,
  bridgedMinutesFromPayload,
} from "./usage-accounting";
import { claimSimultaneousWinner, getCallContextFromSession } from "./session-state";
import { executeFallback, resolveNoAnswerFallback } from "./fallback-executor";

function hangupCause(payload: Record<string, unknown>) {
  return String(payload.hangup_cause || payload.sip_hangup_cause || "");
}

export async function processCallForwardingWebhookEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; result?: unknown }> {
  const clientState = decodeTelnyxClientState(input.eventPayload.client_state);
  const kind = String(clientState.kind || "");
  if (!kind.startsWith("cf_")) return { handled: false };

  const eventControlId = input.eventPayload.call_control_id
    ? String(input.eventPayload.call_control_id)
    : "";

  if (input.eventType === "call.gather.ended") {
    const digits = String(
      (input.eventPayload as { digits?: string }).digits ||
        (input.eventPayload as { dtmf_digits?: string }).dtmf_digits ||
        "",
    );
    if (kind === "cf_ivr" && clientState.menuId) {
      const call = await getPrisma().humanCall.findUnique({
        where: { id: String(clientState.humanCallId) },
      });
      if (!call) return { handled: true };
      const result = await handleIvrGatherEnded({
        workspaceId: String(clientState.workspaceId),
        menuId: String(clientState.menuId),
        digits,
        humanCallId: call.id,
        inboundControlId: eventControlId,
        businessLineE164: call.to,
        callerE164: call.from,
        phoneNumberId: call.phoneNumberId,
        routingSessionId: String(clientState.routingSessionId || ""),
        clientState,
      });
      return { handled: true, result };
    }
    if (
      (kind === "cf_outbound" || kind === "cf_screening") &&
      (clientState.press1Required || kind === "cf_screening")
    ) {
      await handleScreeningGather({
        outboundControlId: eventControlId,
        digit: digits.slice(-1),
        clientState,
      });
      return { handled: true };
    }
    if (kind === "cf_mctb_consent" && clientState.humanCallId) {
      const { handleMctbPress1GatherEnded } = await import("@/lib/server/mctb/press1-consent");
      await handleMctbPress1GatherEnded({
        workspaceId: String(clientState.workspaceId),
        humanCallId: String(clientState.humanCallId),
        inboundControlId: eventControlId,
        phoneNumberId: clientState.phoneNumberId ? String(clientState.phoneNumberId) : null,
        digit: digits,
        routingSessionId: clientState.routingSessionId
          ? String(clientState.routingSessionId)
          : undefined,
        after: typeof clientState.after === "string" ? clientState.after : undefined,
      });
      return { handled: true };
    }
  }

  if (input.eventType === "call.answered" && kind === "cf_outbound") {
    if (clientState.press1Required) {
      const screening =
        typeof clientState.screeningText === "string" && clientState.screeningText.trim()
          ? clientState.screeningText
          : "You have a business call. Press 1 to accept or 2 to decline.";
      await gatherUsingSpeak({
        callControlId: eventControlId,
        text: screening,
        validDigits: "12",
        clientState: { ...clientState, kind: "cf_screening" },
      });
      return { handled: true };
    }
    if (clientState.simultaneous && clientState.parentCallControlId) {
      const sessionId = String(clientState.routingSessionId || "");
      const won = sessionId
        ? await claimSimultaneousWinner(sessionId, eventControlId)
        : true;
      if (won) {
        await bridgeCalls(String(clientState.parentCallControlId), eventControlId);
        const losers = await getPrisma().phoneCallLeg.findMany({
          where: {
            sessionId,
            direction: "outbound",
            callControlId: { not: eventControlId },
            status: { in: ["dialing", "ringing", "answered"] },
          },
        });
        for (const leg of losers) {
          await hangupCall(leg.callControlId).catch(() => undefined);
        }
      } else {
        await hangupCall(eventControlId).catch(() => undefined);
      }
      return { handled: true };
    }
  }

  if (input.eventType === "call.speak.ended") {
    if (clientState.stage === "greeting_done") {
      const dest = String(clientState.destinationE164 || "");
      const sessionId = String(clientState.routingSessionId || "");
      const ctx = sessionId ? await getCallContextFromSession(sessionId) : null;
      if (dest && clientState.parentCallControlId) {
        await dialDestination({
          sessionId,
          workspaceId: String(clientState.workspaceId),
          humanCallId: String(clientState.humanCallId),
          inboundControlId: String(clientState.parentCallControlId),
          businessLineE164: ctx?.businessLineE164 || "",
          callerE164: ctx?.callerE164 || "",
          destinationE164: dest,
        });
      }
      return { handled: true };
    }
    if (clientState.kind === "cf_announcement" && clientState.after === "hangup") {
      await hangupCall(eventControlId);
      return { handled: true };
    }
    if (clientState.kind === "cf_fallback" && clientState.stage === "announce_then_hangup") {
      await hangupCall(eventControlId);
      return { handled: true };
    }
    if (clientState.kind === "cf_hangup" && clientState.stage === "goodbye") {
      await hangupCall(eventControlId);
      return { handled: true };
    }
  }

  if (input.eventType === "call.bridged" && clientState.workspaceId) {
    const mins = bridgedMinutesFromPayload(input.eventPayload);
    await recordBridgedConversation(String(clientState.workspaceId), mins);
    if (eventControlId) {
      await getPrisma().phoneCallLeg.updateMany({
        where: { callControlId: eventControlId },
        data: { status: "bridged" },
      });
    }
    return { handled: true };
  }

  if (input.eventType === "call.hangup") {
    if (eventControlId) {
      await recordLegEnded(eventControlId, input.eventPayload);
    }

    if (kind === "cf_outbound") {
      const queue = (clientState.sequentialQueue || []) as Array<{
        e164: string;
        press1: boolean;
        timeout: number;
      }>;
      const sessionId = String(clientState.routingSessionId || "");
      const state = sessionId
        ? await getPrisma().phoneCallRoutingSession.findUnique({ where: { id: sessionId } })
        : null;
      const winner = (state?.stateJson as { bridgeWinnerControlId?: string })?.bridgeWinnerControlId;
      if (clientState.simultaneous && winner && winner !== eventControlId) {
        return { handled: true };
      }

      if (clientState.simultaneous && sessionId && !winner) {
        const activeOutbound = await getPrisma().phoneCallLeg.count({
          where: {
            sessionId,
            direction: "outbound",
            status: { in: ["dialing", "ringing", "answered"] },
          },
        });
        if (activeOutbound === 0 && clientState.parentCallControlId) {
          const ctx = await getCallContextFromSession(sessionId);
          if (ctx) {
            const fb = await resolveNoAnswerFallback(ctx.workspaceId, ctx.phoneNumberId);
            await executeFallback({
              workspaceId: ctx.workspaceId,
              humanCallId: ctx.humanCallId,
              inboundControlId: String(clientState.parentCallControlId),
              phoneNumberId: ctx.phoneNumberId,
              action: fb,
              routingSessionId: sessionId,
            });
          }
          return { handled: true };
        }
      }

      if (queue.length && clientState.parentCallControlId) {
        const next = queue[0];
        const ctx = sessionId ? await getCallContextFromSession(sessionId) : null;
        await dialDestination({
          sessionId,
          workspaceId: String(clientState.workspaceId),
          humanCallId: String(clientState.humanCallId),
          inboundControlId: String(clientState.parentCallControlId),
          businessLineE164: ctx?.businessLineE164 || String(clientState.businessLineE164 || ""),
          callerE164: ctx?.callerE164 || String(clientState.callerE164 || ""),
          destinationE164: next.e164,
          press1: next.press1,
          sequentialQueue: queue.slice(1),
        });
        return { handled: true };
      }

      const cause = hangupCause(input.eventPayload);
      const normal = cause === "normal_clearing" || cause === "user_busy" || cause === "";
      if (!normal && clientState.workspaceId && !clientState.simultaneous) {
        await recordMissedForward(String(clientState.workspaceId));
      }

      if (
        clientState.parentCallControlId &&
        !queue.length &&
        !clientState.simultaneous &&
        sessionId
      ) {
        const ctx = await getCallContextFromSession(sessionId);
        if (ctx) {
          const fb = await resolveNoAnswerFallback(ctx.workspaceId, ctx.phoneNumberId);
          await executeFallback({
            workspaceId: ctx.workspaceId,
            humanCallId: ctx.humanCallId,
            inboundControlId: String(clientState.parentCallControlId),
            phoneNumberId: ctx.phoneNumberId,
            action: fb,
            routingSessionId: sessionId,
          });
        }
      }
    }
  }

  phoneServerLog("call-forwarding", "webhook_event", {
    eventType: input.eventType,
    kind,
  });

  if (clientState.workspaceId) {
    void import("@/lib/server/mctb/recovery-scheduler").then(({ processDueMctbRecoverySends }) =>
      processDueMctbRecoverySends({ workspaceId: String(clientState.workspaceId) }).catch(
        () => undefined,
      ),
    );
  }

  return { handled: true };
}
