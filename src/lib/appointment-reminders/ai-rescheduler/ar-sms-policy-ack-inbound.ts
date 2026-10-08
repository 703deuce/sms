import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import type { ArSmsContextInterpretation } from "./context-agent/ar-sms-context-schema";
import {
  type ArSmsActionKind,
  evaluateArSmsActionPolicy,
  resolveArCancelSmsPolicy,
  resolveArRescheduleSmsPolicy,
} from "./ar-sms-action-policy";
import type { AiReschedulerConfig } from "./types";
import {
  awaitingPolicyAcceptance,
  buildLatePolicyWarningCopy,
  createPolicyWarningRecord,
  fingerprintArSmsPolicy,
  getArSmsPolicyAck,
  hasValidAcceptedPolicyAck,
  interpretPolicyAckResponse,
  markPolicyAckAccepted,
  markPolicyAckDeclined,
  mergePolicyAckIntoMetadata,
} from "./ar-sms-policy-ack";

export type ArPolicyAckInboundResult =
  | { handled: true; replyText: string }
  | { handled: false };

async function loadAppointmentMeta(workspaceId: string, appointmentId: string) {
  const row = await getPrisma().voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    select: { metadata: true, startsAt: true },
  });
  if (!row) return null;
  return {
    startsAt: row.startsAt,
    meta: (row.metadata || {}) as AppointmentMetadata,
  };
}

async function persistMeta(workspaceId: string, appointmentId: string, meta: AppointmentMetadata) {
  await getPrisma().voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: meta as object },
  });
}

export async function ensureArSmsPolicyWarningDelivered(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  conversationId?: string;
  action: ArSmsActionKind;
  ar: AiReschedulerConfig;
  whenLabel: string;
  startsAt: Date;
}): Promise<
  | { required: false }
  | { required: true; alreadyAccepted: true }
  | { required: true; alreadyAccepted: false; replyText: string; delivered: boolean }
> {
  const policy =
    input.action === "cancel"
      ? resolveArCancelSmsPolicy(input.ar)
      : resolveArRescheduleSmsPolicy(input.ar);
  const evaluation = evaluateArSmsActionPolicy({
    action: input.action,
    startsAt: input.startsAt,
    policy,
  });
  if (!evaluation.requiresPolicyWarning || !evaluation.penaltySummary) {
    return { required: false };
  }

  const loaded = await loadAppointmentMeta(input.workspaceId, input.appointmentId);
  if (!loaded) return { required: false };

  const fingerprint = fingerprintArSmsPolicy(
    input.action,
    policy,
    evaluation.penaltySummary,
  );

  if (
    hasValidAcceptedPolicyAck({
      meta: loaded.meta,
      action: input.action,
      evaluation,
      policy,
    })
  ) {
    return { required: true, alreadyAccepted: true };
  }

  const existing = getArSmsPolicyAck(loaded.meta);
  if (
    existing &&
    existing.action === input.action &&
    existing.phase === "warning_delivered" &&
    existing.policyFingerprint === fingerprint
  ) {
    const replyText = buildLatePolicyWarningCopy({
      action: input.action,
      penaltySummary: evaluation.penaltySummary,
      whenLabel: input.whenLabel,
      cutoffMinutes: evaluation.cutoffMinutes,
    });
    return { required: true, alreadyAccepted: false, replyText, delivered: false };
  }

  const record = createPolicyWarningRecord({
    operationId: `ar_pol_${createId()}`,
    action: input.action,
    policy,
    penaltySummary: evaluation.penaltySummary,
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
  });
  await persistMeta(
    input.workspaceId,
    input.appointmentId,
    mergePolicyAckIntoMetadata(loaded.meta, record),
  );

  const replyText = buildLatePolicyWarningCopy({
    action: input.action,
    penaltySummary: evaluation.penaltySummary,
    whenLabel: input.whenLabel,
    cutoffMinutes: evaluation.cutoffMinutes,
  });
  return { required: true, alreadyAccepted: false, replyText, delivered: true };
}

export async function tryHandleArSmsPolicyAckInbound(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  conversationId?: string;
  body: string;
  providerMessageId?: string;
  contextInterpretation?: ArSmsContextInterpretation | null;
  whenLabel: string;
  ar: AiReschedulerConfig;
  onCancelAccepted?: () => Promise<string>;
  onRescheduleAccepted?: () => Promise<string>;
}): Promise<ArPolicyAckInboundResult> {
  const loaded = await loadAppointmentMeta(input.workspaceId, input.appointmentId);
  if (!loaded) return { handled: false };

  const ack = getArSmsPolicyAck(loaded.meta);
  if (!ack || ack.phase !== "warning_delivered") {
    return { handled: false };
  }

  const decision = interpretPolicyAckResponse({
    body: input.body,
    contextInterpretation: input.contextInterpretation,
  });

  if (decision === "other") {
    const policy =
      ack.action === "cancel"
        ? resolveArCancelSmsPolicy(input.ar)
        : resolveArRescheduleSmsPolicy(input.ar);
    const evaluation = evaluateArSmsActionPolicy({
      action: ack.action,
      startsAt: loaded.startsAt,
      policy,
    });
    if (!evaluation.penaltySummary) return { handled: false };
    return {
      handled: true,
      replyText: buildLatePolicyWarningCopy({
        action: ack.action,
        penaltySummary: evaluation.penaltySummary,
        whenLabel: input.whenLabel,
        cutoffMinutes: evaluation.cutoffMinutes,
      }),
    };
  }

  if (decision === "decline") {
    const declined = markPolicyAckDeclined(ack, { messageText: input.body });
    await persistMeta(
      input.workspaceId,
      input.appointmentId,
      mergePolicyAckIntoMetadata(loaded.meta, declined),
    );
    return {
      handled: true,
      replyText: "No problem — we'll keep your appointment as scheduled. Reply anytime if you need help.",
    };
  }

  const accepted = markPolicyAckAccepted(ack, {
    messageText: input.body,
    providerMessageId: input.providerMessageId,
  });
  await persistMeta(
    input.workspaceId,
    input.appointmentId,
    mergePolicyAckIntoMetadata(loaded.meta, accepted),
  );

  if (ack.action === "cancel" && input.onCancelAccepted) {
    return { handled: true, replyText: await input.onCancelAccepted() };
  }
  if (ack.action === "reschedule" && input.onRescheduleAccepted) {
    return { handled: true, replyText: await input.onRescheduleAccepted() };
  }

  return {
    handled: true,
    replyText:
      ack.action === "cancel"
        ? "Thanks — reply YES when you're ready to confirm cancellation."
        : "Thanks — what day or time works better?",
  };
}

export function isPolicyWarningPendingForAction(
  meta: AppointmentMetadata | null | undefined,
  action: ArSmsActionKind,
): boolean {
  return awaitingPolicyAcceptance(meta, action);
}

export async function tryHandleArSmsPolicyAckForAppointment(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  conversationId?: string;
  body: string;
  providerMessageId?: string;
  contextInterpretation?: ArSmsContextInterpretation | null;
  whenLabel: string;
  ar: AiReschedulerConfig;
  onCancelAccepted: () => Promise<string>;
  onRescheduleAccepted: () => Promise<string>;
}): Promise<ArPolicyAckInboundResult> {
  return tryHandleArSmsPolicyAckInbound({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
    body: input.body,
    providerMessageId: input.providerMessageId,
    contextInterpretation: input.contextInterpretation,
    whenLabel: input.whenLabel,
    ar: input.ar,
    onCancelAccepted: input.onCancelAccepted,
    onRescheduleAccepted: input.onRescheduleAccepted,
  });
}
