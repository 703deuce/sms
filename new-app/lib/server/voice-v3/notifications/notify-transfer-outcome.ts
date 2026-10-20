import "server-only";

import { legalPublicSiteUrl } from "@/lib/legal/public-site";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchVoiceV3Notification } from "./dispatch";
import {
  formatTransferEmail,
  formatTransferSms,
  type TransferAttemptLine,
} from "./format-transfer-notification";

function routeLooksEmergency(routeId: string, routeLabel?: string | null): boolean {
  const hay = `${routeId} ${routeLabel || ""}`.toLowerCase();
  return hay.includes("emergency") || hay.includes("urgent") || hay.includes("escalat");
}

export async function notifyVoiceV3TransferOutcome(input: {
  config: VoiceV3AgentConfig;
  workspaceId: string;
  callId: string;
  transferRequestId: string;
  routeId: string;
  routeLabel?: string | null;
  callerName?: string | null;
  callerPhone: string;
  reason?: string | null;
  connectedDestinationLabel?: string | null;
  attempts: TransferAttemptLine[];
  status: "transfer_connected" | "transfer_exhausted";
}): Promise<void> {
  const notifications = input.config.afterHoursNotifications;
  if (!notifications?.recipients?.length) return;

  const isEmergency = routeLooksEmergency(input.routeId, input.routeLabel);
  const event =
    input.status === "transfer_connected" ? "transfer.connected" : "transfer.failed";

  const baseUrl = legalPublicSiteUrl();
  const callDetailHref = baseUrl
    ? `${baseUrl}/voice/calls/${input.callId}`
    : `/voice/calls/${input.callId}`;
  const receivedAt = new Date();

  const smsBody = formatTransferSms({
    businessLabel: input.config.businessName,
    callerName: input.callerName,
    callerPhone: input.callerPhone,
    reason: input.reason,
    connectedLabel: input.connectedDestinationLabel,
    attempts: input.attempts,
    exhausted: input.status === "transfer_exhausted",
    receivedAt,
  });

  const email = formatTransferEmail({
    businessLabel: input.config.businessName,
    callerName: input.callerName,
    callerPhone: input.callerPhone,
    reason: input.reason,
    connectedLabel: input.connectedDestinationLabel,
    attempts: input.attempts,
    exhausted: input.status === "transfer_exhausted",
    receivedAt,
    callDetailHref,
  });

  await dispatchVoiceV3Notification(notifications, {
    workspaceId: input.workspaceId,
    callId: input.callId,
    event,
    idempotencyKey: `${event}:${input.transferRequestId}`,
    smsBody,
    emailSubject: email.subject,
    emailHtml: email.html,
    emailText: email.text,
    callDetailHref,
  });

  if (isEmergency) {
    const emergencySms = formatTransferSms({
      businessLabel: input.config.businessName,
      callerName: input.callerName,
      callerPhone: input.callerPhone,
      reason: input.reason,
      connectedLabel: input.connectedDestinationLabel,
      attempts: input.attempts,
      exhausted: input.status === "transfer_exhausted",
      receivedAt,
    });
    const emergencyEmail = formatTransferEmail({
      businessLabel: input.config.businessName,
      callerName: input.callerName,
      callerPhone: input.callerPhone,
      reason: input.reason,
      connectedLabel: input.connectedDestinationLabel,
      attempts: input.attempts,
      exhausted: input.status === "transfer_exhausted",
      receivedAt,
      callDetailHref,
    });
    await dispatchVoiceV3Notification(notifications, {
      workspaceId: input.workspaceId,
      callId: input.callId,
      event: "emergency",
      idempotencyKey: `emergency:${input.transferRequestId}:${input.status}`,
      smsBody: emergencySms,
      emailSubject: emergencyEmail.subject,
      emailHtml: emergencyEmail.html,
      emailText: emergencyEmail.text,
      callDetailHref,
    });
  }
}
