import "server-only";

import { getPrisma } from "@/lib/db";
import { legalPublicSiteUrl } from "@/lib/legal/public-site";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { queryAfterHoursAnalytics } from "./analytics-query";
import { resolveVoiceV3AgentConfigForAgent } from "../config/from-published-agent";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function sendAfterHoursDigestForWorkspace(workspaceId: string): Promise<{ ok: boolean }> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, publishedVersionId: true },
  });
  if (!agent) return { ok: false };

  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId,
    agentId: agent.id,
    publishedVersionId: agent.publishedVersionId,
  });
  const digest = config.afterHoursNotifications?.dailyDigest;
  if (!digest?.enabled) return { ok: true };

  const to = digest.recipientEmail?.trim();
  if (!to) return { ok: false };

  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - 1);
  const snapshot = await queryAfterHoursAnalytics({
    workspaceId,
    from: fromDate,
    to: toDate,
  });

  const base = legalPublicSiteUrl() || process.env.APP_URL?.replace(/\/$/, "") || "";
  const callsHref = `${base}/voice/calls`;
  const gapsHref = `${base}/voice/knowledge?tab=gaps`;

  const subject = `Your after-hours summary — ${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}`;
  const html = `
<h2>Your after-hours summary</h2>
<p>${snapshot.kpis.afterHoursCalls} calls handled</p>
<ul>
<li>${snapshot.kpis.appointmentsBooked} appointments booked</li>
<li>${snapshot.kpis.messagesAndCallbacks} messages &amp; callbacks</li>
<li>${snapshot.kpis.emergencyEscalations} emergency escalations</li>
<li>${snapshot.kpis.failedTransfers} failed emergency transfers</li>
<li>${snapshot.kpis.spamOrSolicitors} spam/solicitor calls</li>
</ul>
<p><strong>Needs attention:</strong> ${snapshot.kpis.needsAttention}</p>
<p><a href="${callsHref}">Review calls</a> · <a href="${gapsHref}">Knowledge gaps (${snapshot.knowledgeGaps.open})</a></p>`;

  await sendTransactionalEmail({
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: `After-hours summary: ${snapshot.kpis.afterHoursCalls} calls. Review: ${callsHref}`,
  });

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const cfg = asRecord(ws?.customFieldsConfig);
  const voiceDigest = asRecord(cfg.voiceAfterHoursDigest);
  voiceDigest.lastSentAt = new Date().toISOString();
  cfg.voiceAfterHoursDigest = voiceDigest;
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customFieldsConfig: cfg as object },
  });

  return { ok: true };
}
