import type { PhoneNumber } from "@/lib/types";
import { getPrisma } from "@/lib/db";
import {
  readPersonalCallSettings,
  type IncomingCallHandling,
  type ForwardMode,
  type CallerIdDisplay,
  type VaultIncomingMode,
} from "@/lib/numbers/personal-call-settings";
import {
  derivePersonalServiceState,
  personalServiceLabel,
  readPersonalSettings,
} from "@/lib/workspace/personal-service";
import { loadPhoneNumbers } from "@/lib/workspace-data";

export type PersonalNumberRow = PhoneNumber & {
  serviceState: string;
  serviceLabel: string;
  voicemailEnabled: boolean;
  parkedSince: string | null;
  portAwayExpiresAt: string | null;
  forwardingEnabled: boolean;
  forwardRingSeconds: number;
  forwardUnansweredAction: "voicemail" | "end";
  directVoicemail: boolean;
  vaultIncomingMode: VaultIncomingMode;
  incomingCallHandling: IncomingCallHandling;
  forwardMode: ForwardMode;
  forwardTargets: string[];
  callerIdDisplay: CallerIdDisplay;
  callScreeningEnabled: boolean;
  announcementText: string;
  parkedMessageText: string;
  portOutAccountNumber: string | null;
  portOutPin: string | null;
  portOutLocked: boolean;
  voicemailSecondaryEmail: string | null;
};

export function mapPersonalNumber(number: PhoneNumber): PersonalNumberRow {
  const settings = readPersonalSettings(number);
  const state = derivePersonalServiceState(number);
  const callSettings = readPersonalCallSettings(number);
  return {
    ...number,
    serviceState: state,
    serviceLabel: personalServiceLabel(
      state as import("@/lib/workspace/types").PersonalServiceState,
      number,
    ),
    voicemailEnabled: callSettings.voicemailEnabled,
    parkedSince: (settings.parkedSince as string) || null,
    portAwayExpiresAt: (settings.portAwayWindowExpiresAt as string) || null,
    forwardingEnabled: callSettings.forwardingEnabled,
    forwardRingSeconds: callSettings.forwardRingSeconds,
    forwardUnansweredAction: callSettings.forwardUnansweredAction,
    directVoicemail: callSettings.directVoicemail,
    vaultIncomingMode: callSettings.vaultIncomingMode,
    incomingCallHandling: callSettings.incomingCallHandling,
    forwardMode: callSettings.forwardMode,
    forwardTargets: callSettings.forwardTargets,
    callerIdDisplay: callSettings.callerIdDisplay,
    callScreeningEnabled: callSettings.callScreeningEnabled,
    announcementText: callSettings.announcementText,
    parkedMessageText: callSettings.parkedMessageText,
    portOutAccountNumber: callSettings.portOutAccountNumber,
    portOutPin: callSettings.portOutPin,
    portOutLocked: callSettings.portOutLocked,
    voicemailSecondaryEmail: callSettings.voicemailSecondaryEmail,
  };
}

export async function loadPersonalNumbers(workspaceId: string): Promise<PersonalNumberRow[]> {
  const numbers = await loadPhoneNumbers(workspaceId);
  return numbers.map(mapPersonalNumber);
}

export async function loadPersonalNumber(
  workspaceId: string,
  numberId: string,
): Promise<PersonalNumberRow | null> {
  const numbers = await loadPersonalNumbers(workspaceId);
  return numbers.find((n) => n.id === numberId) ?? null;
}

export async function loadParkedNumbers(workspaceId: string): Promise<PersonalNumberRow[]> {
  return (await loadPersonalNumbers(workspaceId)).filter(
    (n) => n.serviceState === "PARKED" || readPersonalSettings(n).parked === true,
  );
}

export type PersonalActivityRow = {
  id: string;
  caller: string;
  calledNumber: string;
  calledNumberId: string | null;
  date: string;
  time: string;
  durationSeconds: number;
  outcome: string;
  forwardDestination: string | null;
  ringDurationSeconds: number | null;
  answered: boolean;
  voicemail: boolean;
  blocked: boolean;
  failureReason: string | null;
  disposition: string | null;
};

function parseCallNotes(notes: string | null | undefined): {
  forwardDestination: string | null;
  ringSeconds: number | null;
  personalForward: boolean;
} {
  const text = notes || "";
  const destMatch = text.match(/number_forward:([^\s\]]+)/);
  const ringMatch = text.match(/\[ring_seconds:(\d+)\]/);
  return {
    forwardDestination: destMatch?.[1]?.replace(/,/g, " → ") ?? null,
    ringSeconds: ringMatch ? Number(ringMatch[1]) : null,
    personalForward: text.includes("[personal_forward:"),
  };
}

function deriveCallOutcome(
  status: string,
  disposition: string | null,
  voicemail: boolean,
  notes: string | null,
): string {
  if (disposition?.toLowerCase().includes("block")) return "Blocked";
  if (voicemail) return "Voicemail";
  if (status === "completed" || status === "answered") return "Answered";
  if (notes?.includes("forwarding failed") || notes?.includes("destination busy")) {
    return "Forwarding failed";
  }
  if (status === "no-answer" || status === "missed") return "Missed";
  if (status === "busy") return "Busy";
  if (status === "failed") return "Failed";
  return status;
}

export async function loadPersonalCallActivity(
  workspaceId: string,
  options?: { numberId?: string; limit?: number },
): Promise<PersonalActivityRow[]> {
  const prisma = getPrisma();
  const limit = options?.limit ?? 50;
  const numbers = await loadPersonalNumbers(workspaceId);
  const e164ById = new Map(numbers.map((n) => [n.number, n.id]));

  const calls = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      direction: "inbound",
      ...(options?.numberId
        ? { to: numbers.find((n) => n.id === options.numberId)?.number ?? undefined }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      from: true,
      to: true,
      status: true,
      startedAt: true,
      answeredAt: true,
      endedAt: true,
      disposition: true,
      notes: true,
    },
  });

  const blockedPhones = new Set(
    (
      await prisma.suppression.findMany({
        where: { workspaceId },
        select: { phone: true, suppressionKey: true },
      })
    )
      .map((s: { phone: string | null; suppressionKey: string }) =>
        s.phone || s.suppressionKey?.replace(/^p:/, ""),
      )
      .filter(Boolean) as string[],
  );

  return calls.map((c: {
    id: string;
    from: string;
    to: string;
    status: string;
    startedAt: Date;
    answeredAt: Date | null;
    endedAt: Date | null;
    disposition: string | null;
    notes: string | null;
  }) => {
    const started = c.startedAt;
    const ended = c.endedAt;
    const durationSeconds =
      ended && started ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : 0;
    const parsed = parseCallNotes(c.notes);
    const voicemail =
      c.disposition?.toLowerCase().includes("voicemail") ||
      c.notes?.includes("voicemail") ||
      false;
    const answered = Boolean(c.answeredAt) || c.status === "completed";
    const blocked = blockedPhones.has(c.from);

    return {
      id: c.id,
      caller: c.from,
      calledNumber: c.to,
      calledNumberId: e164ById.get(c.to) ?? null,
      date: started.toISOString().slice(0, 10),
      time: started.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      durationSeconds,
      outcome: deriveCallOutcome(c.status, c.disposition, voicemail, c.notes),
      forwardDestination: parsed.forwardDestination,
      ringDurationSeconds: parsed.ringSeconds,
      answered,
      voicemail,
      blocked,
      failureReason:
        c.status === "failed" ? c.disposition || "Call failed" : null,
      disposition: c.disposition,
    };
  });
}

export type PersonalAnalyticsSummary = {
  totalCalls: number;
  answered: number;
  missed: number;
  voicemails: number;
  forwardedMinutes: number;
  averageDurationSeconds: number;
  byNumber: Array<{ numberId: string; e164: string; label: string; calls: number }>;
  byDay: Array<{ date: string; calls: number }>;
  byHour: Array<{ hour: number; calls: number }>;
  periodDays: number;
};

export async function loadPersonalAnalytics(
  workspaceId: string,
  periodDays = 30,
  numberId?: string,
  options?: { offsetDays?: number },
): Promise<PersonalAnalyticsSummary> {
  const prisma = getPrisma();
  const offsetDays = options?.offsetDays ?? 0;
  const periodEnd = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const since = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const numbers = await loadPersonalNumbers(workspaceId);
  const filterE164 = numberId ? numbers.find((n) => n.id === numberId)?.number : undefined;

  const calls = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      direction: "inbound",
      startedAt: { gte: since, lte: periodEnd },
      ...(filterE164 ? { to: filterE164 } : {}),
    },
    select: {
      id: true,
      to: true,
      status: true,
      startedAt: true,
      answeredAt: true,
      endedAt: true,
      disposition: true,
      notes: true,
    },
  });

  let totalDuration = 0;
  let answered = 0;
  let missed = 0;
  let voicemails = 0;
  let forwardedSeconds = 0;
  const byNumberMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();
  const byHourMap = new Map<number, number>();

  for (const c of calls) {
    const duration =
      c.endedAt && c.startedAt
        ? Math.max(0, (c.endedAt.getTime() - c.startedAt.getTime()) / 1000)
        : 0;
    totalDuration += duration;
    const isVm =
      c.disposition?.toLowerCase().includes("voicemail") || c.notes?.includes("voicemail");
    if (isVm) voicemails += 1;
    else if (c.answeredAt || c.status === "completed") answered += 1;
    else missed += 1;

    if (c.notes?.includes("personal_forward") || c.notes?.includes("number_forward")) {
      forwardedSeconds += duration;
    }

    byNumberMap.set(c.to, (byNumberMap.get(c.to) ?? 0) + 1);
    const dayKey = c.startedAt.toISOString().slice(0, 10);
    byDayMap.set(dayKey, (byDayMap.get(dayKey) ?? 0) + 1);
    const hour = c.startedAt.getHours();
    byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + 1);
  }

  const byNumber = numbers.map((n) => ({
    numberId: n.id,
    e164: n.number,
    label: n.friendlyName || n.number,
    calls: byNumberMap.get(n.number) ?? 0,
  }));

  return {
    totalCalls: calls.length,
    answered,
    missed,
    voicemails,
    forwardedMinutes: Math.round(forwardedSeconds / 60),
    averageDurationSeconds:
      calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
    byNumber,
    byDay: [...byDayMap.entries()]
      .map(([date, count]) => ({ date, calls: count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byHour: [...byHourMap.entries()]
      .map(([hour, calls]) => ({ hour, calls }))
      .sort((a, b) => a.hour - b.hour),
    periodDays,
  };
}

export const PERSONAL_FORWARDING_MINUTE_LIMIT = 600;

export type PersonalUsageSummary = {
  forwardingMinutesUsed: number;
  forwardingMinutesLimit: number;
  forwardingMinutesRemaining: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  estimatedOverageMinutes: number;
  perNumber: Array<{
    numberId: string;
    e164: string;
    forwardingMinutes: number;
  }>;
};

export async function loadPersonalUsage(
  workspaceId: string,
): Promise<PersonalUsageSummary> {
  const prisma = getPrisma();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const numbers = await loadPersonalNumbers(workspaceId);
  const calls = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      direction: "inbound",
      startedAt: { gte: periodStart },
      notes: { contains: "forward" },
    },
    select: { to: true, startedAt: true, endedAt: true },
  });

  const perNumberSeconds = new Map<string, number>();
  let totalSeconds = 0;
  for (const c of calls) {
    const sec =
      c.endedAt && c.startedAt
        ? Math.max(0, (c.endedAt.getTime() - c.startedAt.getTime()) / 1000)
        : 0;
    totalSeconds += sec;
    perNumberSeconds.set(c.to, (perNumberSeconds.get(c.to) ?? 0) + sec);
  }

  const forwardingMinutesUsed = Math.round(totalSeconds / 60);
  const limit = PERSONAL_FORWARDING_MINUTE_LIMIT;

  return {
    forwardingMinutesUsed,
    forwardingMinutesLimit: limit,
    forwardingMinutesRemaining: Math.max(0, limit - forwardingMinutesUsed),
    billingPeriodStart: periodStart.toISOString(),
    billingPeriodEnd: periodEnd.toISOString(),
    estimatedOverageMinutes: Math.max(0, forwardingMinutesUsed - limit),
    perNumber: numbers.map((n) => ({
      numberId: n.id,
      e164: n.number,
      forwardingMinutes: Math.round((perNumberSeconds.get(n.number) ?? 0) / 60),
    })),
  };
}

export type PersonalBlockedRow = {
  id: string;
  phone: string;
  reason: string;
  source: string | null;
  createdAt: string;
};

export async function loadPersonalBlockedNumbers(
  workspaceId: string,
  numberId?: string,
): Promise<PersonalBlockedRow[]> {
  const rows = await getPrisma().suppression.findMany({
    where: {
      workspaceId,
      OR: numberId
        ? [{ suppressionKey: { startsWith: `${workspaceId}:${numberId}:p:` } }]
        : [{ phone: { not: null } }, { suppressionKey: { startsWith: "p:" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((r: {
    id: string;
    phone: string | null;
    suppressionKey: string;
    reason: string;
    source: string | null;
    createdAt: Date;
  }) => ({
    id: r.id,
    phone: r.phone || r.suppressionKey.replace(/^.*:p:/, "").replace(/^p:/, ""),
    reason: r.reason,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type PersonalNumberStats = {
  callsThisMonth: number;
  voicemailsUnread: number;
  forwardingMinutes: number;
};

export async function loadPersonalNumberStats(
  workspaceId: string,
  numberId: string,
): Promise<PersonalNumberStats | null> {
  const number = await loadPersonalNumber(workspaceId, numberId);
  if (!number) return null;

  const prisma = getPrisma();
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const callsThisMonth = await prisma.humanCall.count({
    where: {
      workspaceId,
      direction: "inbound",
      to: number.number,
      startedAt: { gte: periodStart },
    },
  });

  const box = await prisma.voicemailBox.findFirst({
    where: { workspaceId, phoneNumberId: numberId },
    select: { id: true },
  });
  let voicemailsUnread = 0;
  if (box) {
    voicemailsUnread = await prisma.voicemailMessage.count({
      where: { workspaceId, boxId: box.id, isRead: false },
    });
  }

  const usage = await loadPersonalUsage(workspaceId);
  const forwardingMinutes =
    usage.perNumber.find((p) => p.numberId === numberId)?.forwardingMinutes ?? 0;

  return { callsThisMonth, voicemailsUnread, forwardingMinutes };
}

/** @deprecated use loadPersonalCallActivity */
export type PersonalOverviewActivityRow = {
  id: string;
  kind: string;
  summary: string;
  at: string;
};

export async function loadPersonalActivity(
  workspaceId: string,
  limit = 10,
): Promise<PersonalOverviewActivityRow[]> {
  const rows = await loadPersonalCallActivity(workspaceId, { limit });
  return rows.map((r) => ({
    id: r.id,
    kind: "call",
    summary: `${r.outcome}: ${r.caller} → ${r.calledNumber}`,
    at: `${r.date}T${r.time}`,
  }));
}

export async function loadBusinessWorkspacesForUser(userId: string) {
  const memberships = await getPrisma().membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true, type: true } } },
  });
  return memberships
    .filter((m: { workspace: { type: string } }) => m.workspace.type === "BUSINESS")
    .map((m: { workspace: { id: string; name: string } }) => ({
      id: m.workspace.id,
      name: m.workspace.name,
    }));
}
