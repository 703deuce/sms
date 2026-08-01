import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function enrollCampaignAudience(
  workspaceId: string,
  campaignId: string,
  audience: {
    listId?: string;
    segmentId?: string;
    phones?: string[];
    contactIds?: string[];
    excludeResponders?: boolean;
    requireConsent?: boolean;
  },
) {
  const prisma = getPrisma();
  const campaign = await prisma.voiceCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const phones = new Set<string>();
  const variablesByPhone = new Map<string, Record<string, unknown>>();

  if (audience.listId) {
    const members = await prisma.contactListMember.findMany({
      where: { listId: audience.listId },
    });
    for (const m of members) {
      const c = await prisma.contact.findUnique({ where: { id: m.contactId } });
      if (c?.phone) {
        phones.add(c.phone);
        variablesByPhone.set(c.phone, {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
        });
      }
    }
  }

  if (audience.segmentId) {
    // Segments store filter JSON; resolve by listing subscribed contacts as a practical default.
    const contacts = await prisma.contact.findMany({
      where: { workspaceId, status: "SUBSCRIBED" },
      take: 10_000,
    });
    for (const c of contacts) {
      if (!c.phone) continue;
      phones.add(c.phone);
      variablesByPhone.set(c.phone, {
        firstName: c.firstName,
        lastName: c.lastName,
      });
    }
  }

  if (audience.contactIds?.length) {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId, id: { in: audience.contactIds } },
    });
    for (const c of contacts) {
      if (!c.phone) continue;
      phones.add(c.phone);
      variablesByPhone.set(c.phone, {
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
      });
    }
  }

  if (audience.phones?.length) {
    for (const p of audience.phones) phones.add(p);
  }

  let enrolled = 0;
  for (const phone of phones) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId, phone },
    });
    if (suppressed) continue;

    let contactId: string | null = null;
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone } },
    });
    if (contact) {
      contactId = contact.id;
      if (audience.requireConsent && contact.status !== "SUBSCRIBED") continue;
      if (audience.excludeResponders) {
        const prior = await prisma.voiceCampaignContact.findFirst({
          where: {
            campaignId,
            phone,
            status: { in: ["completed", "qualified"] },
          },
        });
        if (prior) continue;
      }
    }

    try {
      await prisma.voiceCampaignContact.create({
        data: {
          workspaceId,
          campaignId,
          phone,
          contactId,
          status: "pending",
          variables: (variablesByPhone.get(phone) || {}) as object,
        },
      });
      enrolled += 1;
    } catch {
      // duplicate phone in campaign
    }
  }

  await prisma.voiceCampaign.update({
    where: { id: campaignId },
    data: { totalContacts: { increment: enrolled }, audienceConfig: audience as object },
  });

  return { enrolled };
}

export async function startCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.voiceCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId },
  });
  if (compliance?.emergencyStop) throw new Error("Emergency stop active");

  const pending = await prisma.voiceCampaignContact.count({
    where: { campaignId, status: "pending" },
  });
  if (!pending) throw new Error("No contacts enrolled. Add audience first.");

  const schedule = (campaign.scheduleConfig || {}) as {
    startAt?: string;
    runAt?: string;
  };
  const startAt = schedule.startAt || schedule.runAt;
  if (startAt && new Date(startAt).getTime() > Date.now() + 5_000) {
    await prisma.voiceCampaign.update({
      where: { id: campaignId },
      data: { status: "SCHEDULED" },
    });
    await enqueueJob({
      jobType: "voice_campaign_batch",
      queueName: "voice-calls",
      workspaceId,
      payload: { campaignId, workspaceId },
      idempotencyKey: `voice-campaign-start-${campaignId}-${startAt}`,
      runAfter: new Date(startAt),
    });
    return { ok: true, pending, status: "SCHEDULED", startAt };
  }

  await prisma.voiceCampaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  await enqueueJob({
    jobType: "voice_campaign_batch",
    queueName: "voice-calls",
    workspaceId,
    payload: { campaignId, workspaceId },
    idempotencyKey: `voice-campaign-run-${campaignId}-${Date.now()}`,
  });
  return { ok: true, pending, status: "RUNNING" };
}

export async function pauseCampaign(workspaceId: string, campaignId: string) {
  await getPrisma().voiceCampaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: "PAUSED" },
  });
  return { ok: true };
}

export async function resumeCampaign(workspaceId: string, campaignId: string) {
  await getPrisma().voiceCampaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: "RUNNING" },
  });
  await enqueueJob({
    jobType: "voice_campaign_batch",
    queueName: "voice-calls",
    workspaceId,
    payload: { campaignId, workspaceId },
    idempotencyKey: `voice-campaign-resume-${campaignId}-${Date.now()}`,
  });
  return { ok: true };
}

export async function cancelCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  await prisma.voiceCampaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  await prisma.voiceCampaignContact.updateMany({
    where: { campaignId, status: "pending" },
    data: { status: "cancelled" },
  });
  return { ok: true };
}

/** Enforce local calling hours before dialing a campaign contact. */
export function isWithinCallingWindow(campaign: {
  timezone?: string | null;
  callingRules?: unknown;
}): { allowed: boolean; reason?: string } {
  const rules = (campaign.callingRules || {}) as {
    startHour?: number;
    endHour?: number;
    daysOfWeek?: number[];
  };
  const tz = campaign.timezone || "America/New_York";
  const now = new Date();
  let hour = now.getUTCHours();
  let day = now.getUTCDay();
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(now);
    hour = Number(parts.find((p) => p.type === "hour")?.value || hour);
    const wd = parts.find((p) => p.type === "weekday")?.value || "";
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    if (wd in map) day = map[wd];
  } catch {
    // keep UTC
  }
  const start = rules.startHour ?? 9;
  const end = rules.endHour ?? 20;
  if (hour < start || hour >= end) {
    return { allowed: false, reason: `Outside calling hours ${start}:00–${end}:00 (${tz})` };
  }
  if (rules.daysOfWeek?.length && !rules.daysOfWeek.includes(day)) {
    return { allowed: false, reason: "Outside allowed days of week" };
  }
  return { allowed: true };
}

export async function applyVoicemailPolicy(
  workspaceId: string,
  callId: string,
  campaignId: string,
) {
  const prisma = getPrisma();
  const campaign = await prisma.voiceCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;

  const rules = (campaign.voicemailRules || {}) as Record<string, unknown>;
  const action = String(rules.action || "hangup");
  const preventRepeat = Boolean(rules.preventRepeatDrops ?? true);

  await prisma.voiceCall.update({
    where: { id: callId },
    data: { voicemailDetected: true, outcome: "voicemail" },
  });

  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return;

  const contact = await prisma.voiceCampaignContact.findFirst({
    where: { campaignId, phone: call.toE164 },
  });

  if (contact?.lastOutcome === "voicemail" && preventRepeat && action.includes("leave")) {
    if (call.telnyxCallControlId) {
      const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
      await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
    return;
  }

  if (contact) {
    const maxAttempts = campaign.maxAttempts || 3;
    const nextStatus =
      contact.attemptCount >= maxAttempts ? "max_attempts" : "pending";
    await prisma.voiceCampaignContact.update({
      where: { id: contact.id },
      data: {
        status: action === "stop" ? "completed" : nextStatus,
        lastOutcome: "voicemail",
      },
    });
  }

  if (action === "sms_followup" && rules.smsBody) {
    const { sendQuickSms } = await import("@/lib/sms/send-quick");
    await sendQuickSms({
      workspaceId,
      to: call.toE164,
      body: String(rules.smsBody),
    }).catch(() => undefined);
  }

  if (
    (action === "leave_prerecorded" || action === "leave_message") &&
    call.telnyxCallControlId
  ) {
    const audioUrl = String(rules.audioUrl || rules.prerecordedUrl || "");
    if (audioUrl) {
      const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
      await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/playback_start`, {
        method: "POST",
        body: { audio_url: audioUrl },
      }).catch(() => undefined);
      return;
    }
  }

  if (action === "leave_personalized" && call.telnyxCallControlId) {
    const text = String(
      rules.messageTemplate ||
        rules.personalizedText ||
        "Hi, this is a quick follow-up. Please call us back when you can.",
    );
    const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
    await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/speak`, {
      method: "POST",
      body: { payload: text, voice: "female", language: "en-US" },
    }).catch(() => undefined);
    return;
  }

  if (action === "retry_later" && contact) {
    await prisma.voiceCampaignContact.update({
      where: { id: contact.id },
      data: { status: "pending", lastOutcome: "voicemail_retry" },
    });
  }

  if (
    (action === "hangup" || action === "sms_followup" || action === "retry_later") &&
    call.telnyxCallControlId
  ) {
    const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
    await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }
}
