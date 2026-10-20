import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import { legalPublicSiteUrl } from "@/lib/legal/public-site";
import { formatCallbackEmail, formatCallbackSms } from "./format-callback-notification";
import { dispatchVoiceV3Notification } from "./dispatch";

export async function notifyVoiceV3CallbackRequested(input: {
  config: VoiceV3AgentConfig;
  workspaceId: string;
  callId: string;
  callbackRequestId: string;
  callerName?: string | null;
  callerPhone: string;
  reason?: string | null;
  collectedLines?: string[];
}): Promise<void> {
  const notifications = input.config.afterHoursNotifications;
  if (!notifications?.recipients?.length) return;

  const baseUrl = legalPublicSiteUrl();
  const callDetailHref = baseUrl
    ? `${baseUrl}/voice/calls/${input.callId}`
    : `/voice/calls/${input.callId}`;
  const receivedAt = new Date();

  const smsBody = formatCallbackSms({
    businessLabel: input.config.businessName,
    callerName: input.callerName,
    callerPhone: input.callerPhone,
    reason: input.reason,
    receivedAt,
  });

  const email = formatCallbackEmail({
    businessLabel: input.config.businessName,
    callerName: input.callerName,
    callerPhone: input.callerPhone,
    reason: input.reason,
    collectedLines: input.collectedLines ?? [],
    receivedAt,
    callDetailHref,
  });

  await dispatchVoiceV3Notification(notifications, {
    workspaceId: input.workspaceId,
    callId: input.callId,
    event: "callback.requested",
    idempotencyKey: `callback.requested:${input.callbackRequestId}`,
    smsBody,
    emailSubject: email.subject,
    emailHtml: email.html,
    emailText: email.text,
    callDetailHref,
  });
}
