import "server-only";

import { getPrisma } from "@/lib/db";
import type { ArLunaConversationMessage } from "./v3-workflow/luna-conversation-context";
import { formatSnapshotForContextAgentUserMessage } from "./ar-sms-snapshot-format";

export { formatSnapshotForContextAgentUserMessage };
import { loadArSmsConversationForLuna } from "./v3-workflow/luna-conversation-context";
import { buildArLunaVerifiedContextBlock } from "./ar-sms-luna-context";
import { loadArCustomerAppointmentsSummaryForLuna } from "@/lib/appointment-reminders/messaging/persistent-conversation";

export type ArSmsSharedTurnSnapshot = {
  latestCustomerMessage: string;
  conversationHistory: ArLunaConversationMessage[];
  verifiedContextBlock: string;
  relatedAppointmentsSummary: string;
  sessionLifecycleState: string;
  appointmentId: string;
  replySessionId: string;
  workspaceId: string;
  contactId: string;
  conversationId?: string;
  providerMessageId?: string;
};

/**
 * Single canonical snapshot per inbound turn — shared by Context Agent and Appointment Agent.
 */
export async function buildArSmsSharedTurnSnapshot(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId: string;
  conversationId?: string;
  message: string;
  providerMessageId?: string;
  sessionLifecycleState: string;
}): Promise<
  | { ok: true; snapshot: ArSmsSharedTurnSnapshot }
  | { ok: false; reason: string }
> {
  let conversationHistory: ArLunaConversationMessage[] = [];
  if (input.conversationId) {
    const loaded = await loadArSmsConversationForLuna({
      workspaceId: input.workspaceId,
      replySessionId: input.replySessionId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      currentMessage: input.message,
      currentProviderMessageId: input.providerMessageId,
    });
    if (!loaded.sessionOk) {
      return { ok: false, reason: loaded.reason };
    }
    conversationHistory = loaded.messages;
  } else {
    const trimmed = (input.message || "").trim();
    if (trimmed) conversationHistory = [{ role: "user", content: trimmed }];
  }

  const verifiedContextBlock = await buildArLunaVerifiedContextBlock({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    sessionLifecycleState: input.sessionLifecycleState,
  });

  const relatedAppointmentsSummary = await loadArCustomerAppointmentsSummaryForLuna({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
  });

  return {
    ok: true,
    snapshot: {
      latestCustomerMessage: input.message,
      conversationHistory,
      verifiedContextBlock,
      relatedAppointmentsSummary,
      sessionLifecycleState: input.sessionLifecycleState,
      appointmentId: input.appointmentId,
      replySessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      providerMessageId: input.providerMessageId,
    },
  };
}

