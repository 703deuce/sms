import "server-only";

import { legalPublicSiteUrl } from "@/lib/legal/public-site";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchVoiceV3Notification } from "./dispatch";
import { fmtCallDuration, fmtCallPhone } from "@/lib/voice/calls/display";

export async function notifyVoiceV3CallCompleted(input: {
  config: VoiceV3AgentConfig;
  workspaceId: string;
  callId: string;
  callerName?: string | null;
  callerPhone: string;
  durationSeconds?: number | null;
  summary?: string | null;
}): Promise<void> {
  const notifications = input.config.afterHoursNotifications;
  if (!notifications?.recipients?.length) return;

  const baseUrl = legalPublicSiteUrl();
  const callDetailHref = baseUrl
    ? `${baseUrl}/voice/calls/${input.callId}`
    : `/voice/calls/${input.callId}`;
  const brand = input.config.businessName?.trim() || "Transovo";
  const name = input.callerName?.trim() || "Caller";
  const phone = fmtCallPhone(input.callerPhone);
  const duration = fmtCallDuration(input.durationSeconds);
  const summary = input.summary?.trim() || "Call completed";

  const smsBody = `${brand} — Call completed\n${name}\n${phone}\n${duration}\n${summary.slice(0, 120)}`;
  const subject = `${brand} — Call completed`;
  const html = `
<h2>Call completed</h2>
<p><strong>Caller</strong><br/>${name}</p>
<p><strong>Phone</strong><br/>${phone}</p>
<p><strong>Duration</strong><br/>${duration}</p>
<p><strong>Summary</strong><br/>${summary}</p>
<p><a href="${callDetailHref}">View call</a></p>`.trim();
  const text = [
    "Call completed",
    `Caller: ${name}`,
    `Phone: ${phone}`,
    `Duration: ${duration}`,
    `Summary: ${summary}`,
    `View call: ${callDetailHref}`,
  ].join("\n");

  await dispatchVoiceV3Notification(notifications, {
    workspaceId: input.workspaceId,
    callId: input.callId,
    event: "call.completed",
    idempotencyKey: `call.completed:${input.callId}`,
    smsBody,
    emailSubject: subject,
    emailHtml: html,
    emailText: text,
    callDetailHref,
  });
}
