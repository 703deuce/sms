import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { dialOutboundCall } from "./telnyx/assistant-sync";
import { getPublishedConfig } from "./agent-service";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
/** Midnight (start of local day) for a campaign timezone. */
export function startOfDayInTimezone(timezone: string, now = new Date()): Date {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    // Approximate: construct a UTC instant that is midnight in that zone via iterative offset.
    const guess = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      minute: "numeric",
    }).formatToParts(guess);
    const hour = Number(local.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(local.find((p) => p.type === "minute")?.value || 0);
    return new Date(guess.getTime() - (hour * 60 + minute) * 60_000);
  } catch {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
}

function contactTimezone(
  contact: { variables?: unknown; contactId?: string | null },
  contactRow?: { customFields?: unknown; timezone?: string | null } | null,
  campaignTz?: string | null,
) {
  const vars = (contact.variables || {}) as Record<string, unknown>;
  if (typeof vars.timezone === "string" && vars.timezone) return vars.timezone;
  if (contactRow && "timezone" in contactRow && contactRow.timezone) {
    return String(contactRow.timezone);
  }
  const cf = (contactRow?.customFields || {}) as Record<string, unknown>;
  if (typeof cf.timezone === "string" && cf.timezone) return cf.timezone;
  return campaignTz || "America/New_York";
}

export async function initiateOutboundCall(input: {
  workspaceId: string;
  agentId: string;
  toPhone: string;
  contactId?: string;
  campaignId?: string;
  isTest?: boolean;
  dynamicVariables?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const testableStatuses = ["ACTIVE", "TESTING", "DRAFT"];
  if (input.isTest) {
    if (!testableStatuses.includes(agent.status)) {
      throw new Error("Agent is not available for testing");
    }
  } else if (agent.status !== "ACTIVE" && agent.status !== "TESTING") {
    throw new Error("Agent is not active");
  }

  const phone = normalizeE164(input.toPhone);

  // Compliance checks
  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (compliance?.emergencyStop) {
    throw new Error("Voice emergency stop is active");
  }

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId: input.workspaceId, phone },
  });
  if (suppressed) {
    throw new Error("Number is on suppression list");
  }

  const complianceSettings = (compliance?.settings || {}) as {
    internationalBlocked?: boolean;
    blockedPrefixes?: string[];
    spendLimitCents?: number | null;
    requiredDisclosureText?: string;
  };
  if (complianceSettings.internationalBlocked !== false) {
    // Allow US/CA (+1) by default when international is blocked.
    if (!phone.startsWith("+1")) {
      throw new Error("International calling is blocked for this workspace");
    }
  }
  for (const prefix of complianceSettings.blockedPrefixes || []) {
    const p = prefix.startsWith("+") ? prefix : `+${prefix}`;
    if (phone.startsWith(p) || phone.replace("+", "").startsWith(prefix.replace("+", ""))) {
      throw new Error(`Destination blocked by prefix ${prefix}`);
    }
  }
  if (complianceSettings.spendLimitCents) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const spent = await prisma.voiceCall.aggregate({
      where: { workspaceId: input.workspaceId, startedAt: { gte: startOfMonth } },
      _sum: { costCents: true },
    });
    if ((spent._sum.costCents || 0) >= complianceSettings.spendLimitCents) {
      throw new Error("Monthly voice spend limit reached");
    }
  }

  let fromE164 = "";
  let phoneNumberId: string | null = agent.phoneNumberId;

  if (phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId: input.workspaceId },
    });
    fromE164 = pn?.e164 || "";
  }
  if (!fromE164) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId: input.workspaceId, status: "Active" },
    });
    fromE164 = pn?.e164 || "";
    phoneNumberId = pn?.id || null;
  }
  if (!fromE164) throw new Error("No outbound caller ID configured");

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: agent.id,
      agentVersionId: agent.publishedVersionId,
      contactId: input.contactId,
      campaignId: input.campaignId,
      direction: "OUTBOUND",
      status: "QUEUED",
      fromE164,
      toE164: phone,
      phoneNumberId,
      isTest: input.isTest ?? false,
      dynamicVariables: input.dynamicVariables as object,
    },
  });

  const config = await getPublishedConfig(agent.id);

  const dial = await dialOutboundCall({
    workspaceId: input.workspaceId,
    callId: call.id,
    fromE164,
    toE164: phone,
    assistantId: agent.telnyxAssistantId,
    connectionId: agent.telnyxConnectionId,
  });

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      telnyxCallControlId: dial.callControlId,
      status: "INITIATED",
    },
  });

  return { call, dial };
}

export async function processVoiceCampaignBatch() {
  const prisma = getPrisma();
  const { isWithinCallingWindow } = await import("./campaigns");
  const campaigns = await prisma.voiceCampaign.findMany({
    where: { status: { in: ["RUNNING", "SCHEDULED"] } },
    take: 10,
  });

  let initiated = 0;
  for (const campaign of campaigns) {
    if (campaign.status === "SCHEDULED") {
      const schedule = (campaign.scheduleConfig || {}) as { startAt?: string; runAt?: string };
      const startAt = schedule.startAt || schedule.runAt;
      if (startAt && new Date(startAt).getTime() > Date.now()) continue;
      await prisma.voiceCampaign.update({
        where: { id: campaign.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });
    }

    const window = isWithinCallingWindow(campaign);
    if (!window.allowed) continue;

    if (campaign.dailyLimit) {
      const startOfDay = startOfDayInTimezone(campaign.timezone || "America/New_York");
      const todayCount = await prisma.voiceCall.count({
        where: {
          campaignId: campaign.id,
          createdAt: { gte: startOfDay },
        },
      });
      if (todayCount >= campaign.dailyLimit) continue;
    }

    const compliance = await prisma.voiceComplianceProfile.findUnique({
      where: { workspaceId: campaign.workspaceId },
    });
    if (compliance?.emergencyStop) continue;

    const running = await prisma.voiceCall.count({
      where: {
        campaignId: campaign.id,
        status: { in: ["QUEUED", "INITIATED", "RINGING", "ANSWERED", "IN_PROGRESS"] },
      },
    });
    if (running >= campaign.concurrency) continue;

    // Rotate through pending contacts so TZ/cooldown skips don't starve later rows.
    const candidates = await prisma.voiceCampaignContact.findMany({
      where: {
        campaignId: campaign.id,
        status: "pending",
        attemptCount: { lt: campaign.maxAttempts || 3 },
      },
      orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
      take: 50,
    });
    if (!candidates.length) {
      const stillPending = await prisma.voiceCampaignContact.count({
        where: { campaignId: campaign.id, status: "pending" },
      });
      if (!stillPending) {
        await prisma.voiceCampaign.update({
          where: { id: campaign.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
      continue;
    }

    const rules = (campaign.callingRules || {}) as {
      frequencyCapHours?: number;
      crossCampaignCooldownHours?: number;
    };
    const cooldownHours = Number(
      rules.crossCampaignCooldownHours || rules.frequencyCapHours || 0,
    );

    let dialedThisCampaign = false;
    for (const contact of candidates) {
      if (dialedThisCampaign) break;
      if (running + (dialedThisCampaign ? 1 : 0) >= campaign.concurrency) break;

      // DNC / suppression check
      const suppressed = await prisma.suppression.findFirst({
        where: {
          workspaceId: campaign.workspaceId,
          OR: [
            { phone: contact.phone },
            { suppressionKey: `p:${contact.phone}` },
            { suppressionKey: `${campaign.workspaceId}:p:${contact.phone}` },
          ],
        },
      });
      if (suppressed) {
        await prisma.voiceCampaignContact.update({
          where: { id: contact.id },
          data: { status: "suppressed", lastOutcome: "dnc" },
        });
        continue;
      }

      const contactRow = contact.contactId
        ? await prisma.contact.findUnique({ where: { id: contact.contactId } })
        : null;
      const recipientTz = contactTimezone(contact, contactRow, campaign.timezone);
      const recipientWindow = isWithinCallingWindow({
        timezone: recipientTz,
        callingRules: campaign.callingRules,
      });
      if (!recipientWindow.allowed) {
        // Bump updatedAt so the next batch rotates past this contact.
        await prisma.voiceCampaignContact.update({
          where: { id: contact.id },
          data: { updatedAt: new Date() },
        });
        continue;
      }

      if (cooldownHours > 0) {
        const since = new Date(Date.now() - cooldownHours * 3600_000);
        const recent = await prisma.voiceCall.findFirst({
          where: {
            workspaceId: campaign.workspaceId,
            toE164: contact.phone,
            createdAt: { gte: since },
          },
          orderBy: { createdAt: "desc" },
        });
        if (recent) {
          await prisma.voiceCampaignContact.update({
            where: { id: contact.id },
            data: { updatedAt: new Date() },
          });
          continue;
        }
      }

      try {
        await initiateOutboundCall({
          workspaceId: campaign.workspaceId,
          agentId: campaign.agentId,
          toPhone: contact.phone,
          contactId: contact.contactId,
          campaignId: campaign.id,
          dynamicVariables: {
            ...((contact.variables as Record<string, unknown>) || {}),
            timezone: recipientTz,
          },
        });

        await prisma.voiceCampaignContact.update({
          where: { id: contact.id },
          data: { status: "in_progress", attemptCount: { increment: 1 } },
        });
        initiated += 1;
        dialedThisCampaign = true;
      } catch (err) {
        await prisma.voiceCampaignContact.update({
          where: { id: contact.id },
          data: {
            status: "failed",
            lastOutcome: err instanceof Error ? err.message : "failed",
          },
        });
      }
    }
  }

  return { initiated };
}

export async function completeMockCall(callId: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call || call.status === "COMPLETED") return;

  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      status: "COMPLETED",
      answeredAt: new Date(),
      endedAt: new Date(),
      durationSeconds: 45,
      outcome: "completed",
    },
  });

  await prisma.voiceTranscript.create({
    data: {
      workspaceId: call.workspaceId,
      callId: call.id,
      provider: "telnyx",
      status: "completed",
      fullText: "Mock call transcript for testing.",
      language: "en-US",
    },
  });

  const { processPostCall } = await import("./post-call");
  await processPostCall(callId);
}
