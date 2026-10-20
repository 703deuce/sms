import { getPrisma } from "@/lib/server/db";

function yearMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function bridgedMinutesFromPayload(payload: Record<string, unknown>) {
  const sec =
    Number(payload.billed_duration_secs) ||
    Number(payload.call_duration) ||
    Number(payload.duration_secs) ||
    0;
  if (sec > 0) return Math.max(1, Math.ceil(sec / 60));
  return 0;
}

export async function recordForwardedCallAttempt(workspaceId: string) {
  const ym = yearMonth();
  await getPrisma().forwardingUsageMonthly.upsert({
    where: { workspaceId_yearMonth: { workspaceId, yearMonth: ym } },
    create: { workspaceId, yearMonth: ym, forwardedCalls: 1 },
    update: { forwardedCalls: { increment: 1 } },
  });
}

export async function recordBridgedConversation(workspaceId: string, bridgedMinutes: number) {
  const ym = yearMonth();
  const mins = bridgedMinutes > 0 ? bridgedMinutes : 1;
  await getPrisma().forwardingUsageMonthly.upsert({
    where: { workspaceId_yearMonth: { workspaceId, yearMonth: ym } },
    create: {
      workspaceId,
      yearMonth: ym,
      answeredCalls: 1,
      bridgedMinutes: mins,
      forwardedMinutes: mins,
    },
    update: {
      answeredCalls: { increment: 1 },
      bridgedMinutes: { increment: mins },
      forwardedMinutes: { increment: mins },
    },
  });
}

export async function recordMissedForward(workspaceId: string) {
  const ym = yearMonth();
  await getPrisma().forwardingUsageMonthly.upsert({
    where: { workspaceId_yearMonth: { workspaceId, yearMonth: ym } },
    create: { workspaceId, yearMonth: ym, missedCalls: 1 },
    update: { missedCalls: { increment: 1 } },
  });
}

export async function recordLegEnded(callControlId: string, payload: Record<string, unknown>) {
  const sec =
    Number(payload.billed_duration_secs) ||
    Number(payload.call_duration) ||
    Number(payload.duration_secs) ||
    0;
  const cause = String(payload.hangup_cause || payload.sip_hangup_cause || "");
  await getPrisma().phoneCallLeg.updateMany({
    where: { callControlId },
    data: {
      status: "ended",
      endedAt: new Date(),
      billableSeconds: sec > 0 ? sec : undefined,
      terminationCause: cause || undefined,
    },
  });
}
