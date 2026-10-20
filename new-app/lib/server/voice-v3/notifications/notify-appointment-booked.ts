import "server-only";

import { legalPublicSiteUrl } from "@/lib/legal/public-site";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchVoiceV3Notification } from "./dispatch";
import { fmtCallPhone } from "@/lib/voice/calls/display";

export async function notifyVoiceV3AppointmentBooked(input: {
  config: VoiceV3AgentConfig;
  workspaceId: string;
  callId: string;
  appointmentId: string;
  callerName?: string | null;
  callerPhone: string;
  bookedTimeLabel?: string | null;
  serviceLabel?: string | null;
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
  const when = input.bookedTimeLabel?.trim() || "Scheduled";
  const service = input.serviceLabel?.trim() || "Appointment";

  const smsBody = `${brand} — Appointment booked\n${name}\n${phone}\n${service}\n${when}`;
  const subject = `${brand} — Appointment booked`;
  const html = `
<h2>Appointment booked</h2>
<p><strong>Caller</strong><br/>${name}</p>
<p><strong>Phone</strong><br/>${phone}</p>
<p><strong>Service</strong><br/>${service}</p>
<p><strong>When</strong><br/>${when}</p>
<p><a href="${callDetailHref}">View call</a></p>`.trim();
  const text = [
    "Appointment booked",
    `Caller: ${name}`,
    `Phone: ${phone}`,
    `Service: ${service}`,
    `When: ${when}`,
    `View call: ${callDetailHref}`,
  ].join("\n");

  await dispatchVoiceV3Notification(notifications, {
    workspaceId: input.workspaceId,
    callId: input.callId,
    event: "appointment.booked",
    idempotencyKey: `appointment.booked:${input.appointmentId}`,
    smsBody,
    emailSubject: subject,
    emailHtml: html,
    emailText: text,
    callDetailHref,
  });
}
