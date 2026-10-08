import assert from "node:assert/strict";
import type { ArSmsReplySession } from "@/lib/domain";
import {
  groupArSessionsByWorkspace,
  pickPrimaryArReplySessionForInbound,
} from "./ar-inbound-session-routing";

function session(partial: Partial<ArSmsReplySession> & { id: string }): ArSmsReplySession {
  return {
    id: partial.id,
    workspaceId: partial.workspaceId ?? "ws_a",
    contactId: partial.contactId ?? "ct_1",
    appointmentId: partial.appointmentId ?? "appt_1",
    conversationId: partial.conversationId ?? null,
    platformPhoneNumberId: partial.platformPhoneNumberId ?? "pn_1",
    provider: partial.provider ?? "telnyx",
    consumerE164: partial.consumerE164 ?? "+17035550101",
    lifecycleState: partial.lifecycleState ?? "AWAITING_REPLY",
    timelineType: partial.timelineType ?? "reminder",
    calendarConnectionId: partial.calendarConnectionId ?? null,
    providerCalendarId: partial.providerCalendarId ?? null,
    providerEventId: partial.providerEventId ?? null,
    calendarProvider: partial.calendarProvider ?? null,
    replyEligibleUntil: partial.replyEligibleUntil ?? null,
    lastOutboundMessageId: partial.lastOutboundMessageId ?? "msg_1",
    lastOutboundProviderMessageId: partial.lastOutboundProviderMessageId ?? null,
    lastUsedAt: partial.lastUsedAt ?? new Date(),
    completedAt: partial.completedAt ?? null,
    pendingSendReason: partial.pendingSendReason ?? null,
    createdAt: partial.createdAt ?? new Date(),
    updatedAt: partial.updatedAt ?? new Date(),
  };
}

const rescheduling = session({
  id: "s_resched",
  appointmentId: "appt_old",
  lifecycleState: "RESCHEDULING",
  lastUsedAt: new Date("2026-10-01T12:00:00Z"),
});
const awaitingNewer = session({
  id: "s_await",
  appointmentId: "appt_new",
  lifecycleState: "AWAITING_REPLY",
  lastUsedAt: new Date("2026-10-08T12:00:00Z"),
});

assert.equal(
  pickPrimaryArReplySessionForInbound([awaitingNewer, rescheduling])?.id,
  "s_resched",
  "prefers RESCHEDULING over newer AWAITING_REPLY",
);

const byWs = groupArSessionsByWorkspace([
  session({ id: "a", workspaceId: "ws_a" }),
  session({ id: "b", workspaceId: "ws_b" }),
]);
assert.equal(byWs.size, 2, "groups sessions by workspace");

console.log("persistent-conversation.test.ts: ok");
