import { describe, expect, it } from "vitest";
import type { ArSmsReplySession } from "@/lib/domain";
import {
  groupArSessionsByWorkspace,
  pickPrimaryArReplySessionForInbound,
  resolveArInboundPrimarySession,
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

describe("shared platform sender — inbound session routing", () => {
  it("prefers in-flight RESCHEDULING over newer AWAITING_REPLY (same workspace)", () => {
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
    const resolved = resolveArInboundPrimarySession([awaitingNewer, rescheduling]);
    expect(resolved.status).toBe("ok");
    if (resolved.status === "ok") {
      expect(resolved.session.id).toBe("s_resched");
    }
  });

  it("fails closed when two AWAITING_REPLY sessions target different appointments", () => {
    const older = session({
      id: "s1",
      appointmentId: "appt_a",
      lifecycleState: "AWAITING_REPLY",
      lastUsedAt: new Date("2026-10-01T12:00:00Z"),
    });
    const newer = session({
      id: "s2",
      appointmentId: "appt_b",
      lifecycleState: "AWAITING_REPLY",
      lastUsedAt: new Date("2026-10-08T12:00:00Z"),
    });
    expect(pickPrimaryArReplySessionForInbound([older, newer])?.appointmentId).toBe("appt_b");
    const resolved = resolveArInboundPrimarySession([older, newer]);
    expect(resolved.status).toBe("ambiguous_appointment");
    if (resolved.status === "ambiguous_appointment") {
      expect(resolved.appointmentIds.sort()).toEqual(["appt_a", "appt_b"]);
    }
  });

  it("uses most recent COMPLETED session when several completed appointments share the sender", () => {
    const older = session({
      id: "s_old",
      appointmentId: "appt_old",
      lifecycleState: "COMPLETED",
      lastUsedAt: new Date("2026-10-01T12:00:00Z"),
    });
    const newer = session({
      id: "s_new",
      appointmentId: "appt_new",
      lifecycleState: "COMPLETED",
      lastUsedAt: new Date("2026-10-09T01:13:43Z"),
    });
    const resolved = resolveArInboundPrimarySession([older, newer]);
    expect(resolved.status).toBe("ok");
    if (resolved.status === "ok") {
      expect(resolved.session.id).toBe("s_new");
    }
  });

  it("groups sessions by workspace for cross-tenant collision detection", () => {
    const byWs = groupArSessionsByWorkspace([
      session({ id: "a", workspaceId: "ws_a" }),
      session({ id: "b", workspaceId: "ws_b" }),
    ]);
    expect(byWs.size).toBe(2);
  });
});
