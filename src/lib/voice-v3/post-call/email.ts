import "server-only";

import { getPrisma } from "@/lib/db";
import { fmtCallDuration, fmtCallPhone } from "@/lib/voice/calls/display";
import { legalPublicSiteUrl } from "@/lib/legal/public-site";
import { loadVoiceV3NotificationsConfigForCall } from "@/lib/voice-v3/notifications/load-config-for-call";
import { dispatchVoiceV3Notification } from "@/lib/voice-v3/notifications/dispatch";
import type { VoiceV3StructuredSummary } from "./summary";
import type { VoiceV3PostCallSystemFacts } from "./system-facts";

function shouldSkipSummaryEmail(facts: VoiceV3PostCallSystemFacts, summary: VoiceV3StructuredSummary): boolean {
  if (summary.outcome === "SPAM" || summary.outcome === "SOLICITOR") return true;
  if (facts.screeningOutcome === "UNWANTED_SOLICITATION") return true;
  const o = String(facts.outcome || "").toLowerCase();
  if (o.includes("spam") || o.includes("solicitation")) return true;
  return false;
}

function outcomeLabel(outcome: string): string {
  return outcome.replace(/_/g, " ").toLowerCase();
}

export async function sendVoiceV3PostCallSummaryEmail(input: {
  callId: string;
  workspaceId: string;
  summary: VoiceV3StructuredSummary;
  facts: VoiceV3PostCallSystemFacts;
}): Promise<void> {
  if (shouldSkipSummaryEmail(input.facts, input.summary)) return;

  const loaded = await loadVoiceV3NotificationsConfigForCall(input.callId);
  if (!loaded) return;

  const notifications = loaded.config.afterHoursNotifications;
  if (!notifications?.recipients?.length) return;

  const baseUrl = legalPublicSiteUrl() || process.env.APP_URL?.replace(/\/$/, "") || "";
  const callDetailHref = baseUrl
    ? `${baseUrl}/voice/calls/${input.callId}`
    : `/voice/calls/${input.callId}`;
  const brand = loaded.config.businessName?.trim() || "Transovo";
  const callerLabel = input.facts.callerName || fmtCallPhone(input.facts.callerE164 || "") || "Caller";
  const duration = fmtCallDuration(input.facts.durationSeconds);

  const subjectPrefix =
    input.summary.urgency === "URGENT" ? "URGENT after-hours call: " : "After-hours call: ";
  const subject = `${subjectPrefix}${callerLabel} — ${input.summary.headline}`;

  const outcome = outcomeLabel(input.summary.outcome);
  const html = `
<h2>After-hours call summary</h2>
<p><strong>${callerLabel}</strong><br/>${fmtCallPhone(input.facts.callerE164 || "")}<br/>${duration}</p>
<p><strong>${outcome}</strong></p>
<p>${input.summary.summary}</p>
${
  input.summary.actionRequired
    ? `<p><strong>Action needed</strong><br/>${(input.summary.actionItems || []).join("<br/>")}</p>`
    : ""
}
<p><a href="${callDetailHref}">View call</a></p>
<p><em>Handled by your ${brand} after-hours receptionist.</em></p>`.trim();

  const text = [
    "After-hours call summary",
    callerLabel,
    input.summary.summary,
    input.summary.actionRequired ? `Action: ${(input.summary.actionItems || []).join("; ")}` : "",
    `View call: ${callDetailHref}`,
  ]
    .filter(Boolean)
    .join("\n");

  await dispatchVoiceV3Notification(notifications, {
    workspaceId: input.workspaceId,
    callId: input.callId,
    event: "call.completed",
    idempotencyKey: `post-call-summary:${input.callId}`,
    smsBody: `${brand} — ${input.summary.headline.slice(0, 100)}`,
    emailSubject: subject,
    emailHtml: html,
    emailText: text,
    callDetailHref,
  });

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: input.callId }, select: { metadata: true } });
  const prev =
    call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prev,
        voiceV3PostCallEmail: { sentAt: new Date().toISOString(), idempotencyKey: `post-call-summary:${input.callId}` },
      } as object,
    },
  });
}
