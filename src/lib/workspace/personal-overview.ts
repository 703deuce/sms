import { getPrisma } from "@/lib/db";
import { listVoicemailMessages } from "@/lib/phone/voicemail-service";
import { listPortRequests } from "@/lib/numbers/port-service";
import { loadDashboardMetrics } from "@/lib/workspace-data";
import {
  loadPersonalBlockedNumbers,
  loadPersonalCallActivity,
  loadPersonalNumbers,
  loadPersonalUsage,
} from "@/lib/workspace/personal-data";

export type PersonalOverviewStatusTone = "green" | "blue" | "orange" | "purple" | "gray" | "yellow";

export type PersonalOverviewTopNumber = {
  id: string;
  label: string;
  phone: string;
  type: string;
  forwarding: string;
  status: string;
  statusTone: PersonalOverviewStatusTone;
  activitySparkline: number[];
};

export type PersonalOverviewData = {
  kpis: {
    totalNumbers: number;
    totalNumbersDelta: string;
    voicemails: number;
    voicemailsTrendPct: number;
    transcriptions: number;
    transcriptionsTrendPct: number;
    calls30d: number;
    callsTrendPct: number;
    walletBalance: number;
    walletTrendPct: number;
    blockedNumbers: number;
    blockedDelta: string;
    walletAutoTopup: boolean;
  };
  topNumbers: PersonalOverviewTopNumber[];
  timeline: Array<{ id: string; date: string; label: string }>;
  topDestinations: Array<{ phone: string; date: string; duration: string }>;
  pendingTransfers: Array<{
    id: string;
    toFrom: string;
    started: string;
    status: string;
    statusTone: PersonalOverviewStatusTone;
  }>;
  recentNumbers: Array<{
    phone: string;
    forwarding: string;
    status: string;
    statusTone: PersonalOverviewStatusTone;
  }>;
  billingHistory: Array<{ date: string; amount: string }>;
  recentVoicemail: Array<{ id: string; name: string; phone: string; at: string }>;
  topCallNumbers: Array<{ label: string; value: number }>;
  activityCount: number;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function relativeShort(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDurationClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function numberStatusTone(serviceState: string): PersonalOverviewStatusTone {
  if (serviceState === "PARKED" || serviceState === "PORT_AWAY") return "yellow";
  if (serviceState === "ACTIVE" || serviceState === "FORWARDING") return "green";
  return "gray";
}

function numberStatusLabel(serviceState: string, serviceLabel: string): string {
  if (serviceState === "PARKED") return "Inactive";
  if (serviceState === "PORT_AWAY") return "Porting";
  return serviceLabel === "Active" ? "Active" : serviceLabel;
}

function portStatusTone(status: string): PersonalOverviewStatusTone {
  const s = status.toLowerCase();
  if (s.includes("progress") || s.includes("pending") || s.includes("submitted")) return "blue";
  if (s.includes("complete") || s.includes("approved")) return "green";
  if (s.includes("reject") || s.includes("fail")) return "orange";
  return "gray";
}

function trendPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function sparklineFromCalls(counts: number[]): number[] {
  if (counts.length === 0) return [0, 0, 0, 0, 0, 0, 0];
  const padded = counts.slice(-7);
  while (padded.length < 7) padded.unshift(0);
  return padded;
}

export async function loadPersonalOverviewData(workspaceId: string): Promise<PersonalOverviewData> {
  const periodStart = daysAgo(30);
  const priorStart = daysAgo(60);
  const weekStart = daysAgo(7);
  const priorWeekStart = daysAgo(14);

  const prisma = getPrisma();

  const [
    numbers,
    activity,
    usage,
    metrics,
    portRequests,
    blockedRows,
    voicemailMessages,
    voicemailTotal,
    transcriptionTotal,
    voicemailsPrior,
    transcriptionsPrior,
    callsPrior,
  ] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadPersonalCallActivity(workspaceId, { limit: 400 }),
    loadPersonalUsage(workspaceId).catch(() => null),
    loadDashboardMetrics(workspaceId),
    listPortRequests(workspaceId),
    loadPersonalBlockedNumbers(workspaceId),
    listVoicemailMessages(workspaceId).catch(() => []),
    prisma.voicemailMessage.count({ where: { workspaceId } }).catch(() => 0),
    prisma.voicemailMessage.count({
      where: { workspaceId, transcriptText: { not: null } },
    }).catch(() => 0),
    prisma.voicemailMessage.count({
      where: { workspaceId, createdAt: { gte: priorStart, lt: periodStart } },
    }).catch(() => 0),
    prisma.voicemailMessage.count({
      where: {
        workspaceId,
        transcriptText: { not: null },
        createdAt: { gte: priorStart, lt: periodStart },
      },
    }).catch(() => 0),
    loadPersonalCallActivity(workspaceId, { limit: 400 }),
  ]);

  const calls30d = activity.filter((r) => {
    const d = new Date(`${r.date} ${r.time}`);
    return d >= periodStart;
  });

  const callsPriorPeriod = callsPrior.filter((r) => {
    const d = new Date(`${r.date} ${r.time}`);
    return d >= priorStart && d < periodStart;
  });

  const numbersThisWeek = await prisma.phoneNumber.count({
    where: { workspaceId, purchasedAt: { gte: weekStart } },
  }).catch(() => 0);
  const numbersPriorWeek = await prisma.phoneNumber.count({
    where: {
      workspaceId,
      purchasedAt: { gte: priorWeekStart, lt: weekStart },
    },
  }).catch(() => 0);

  const blockedThisWeek = blockedRows.filter((b) => new Date(b.createdAt) >= weekStart).length;
  const blockedPriorWeek = blockedRows.filter((b) => {
    const d = new Date(b.createdAt);
    return d >= priorWeekStart && d < weekStart;
  }).length;

  const callsByNumber = new Map<string, number[]>();
  for (const row of calls30d) {
    const key = row.calledNumber;
    if (!callsByNumber.has(key)) callsByNumber.set(key, []);
    callsByNumber.get(key)!.push(row.durationSeconds);
  }

  const topNumbers = numbers
    .filter((n) => n.serviceState !== "PARKED")
    .slice(0, 8)
    .map((n) => {
      const dayBuckets = Array.from({ length: 7 }, (_, i) => {
        const start = daysAgo((6 - i) * 4 + 4);
        const end = daysAgo((6 - i) * 4);
        return calls30d.filter((r) => {
          if (r.calledNumber !== n.number) return false;
          const d = new Date(`${r.date} ${r.time}`);
          return d >= start && d < end;
        }).length;
      });
      const fwd =
        n.forwardTargets.length > 0
          ? n.forwardTargets[0]
          : n.forwardingEnabled
            ? "Forwarding on"
            : "—";
      return {
        id: n.id,
        label: n.friendlyName || n.areaCode || "Main Line",
        phone: n.number,
        type: n.type === "Toll-free" ? "Toll Free" : "Local",
        forwarding: fwd,
        status: numberStatusLabel(n.serviceState, n.serviceLabel),
        statusTone: numberStatusTone(n.serviceState),
        activitySparkline: sparklineFromCalls(dayBuckets),
      };
    });

  const destinationMap = new Map<
    string,
    { phone: string; date: Date; durationSeconds: number }
  >();
  for (const row of calls30d) {
    const dest = row.forwardDestination || row.caller;
    const stamp = new Date(`${row.date} ${row.time}`);
    const key = dest.replace(/\D/g, "");
    const existing = destinationMap.get(key);
    if (!existing || stamp > existing.date) {
      destinationMap.set(key, {
        phone: dest,
        date: stamp,
        durationSeconds: row.durationSeconds,
      });
    }
  }
  const topDestinations = [...destinationMap.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 4)
    .map((d) => ({
      phone: d.phone,
      date: d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      duration: formatDurationClock(d.durationSeconds),
    }));

  const pendingTransfers = portRequests
    .filter((p: { status: string }) => {
      const s = String(p.status).toLowerCase();
      return !s.includes("complete") && !s.includes("cancel");
    })
    .slice(0, 5)
    .map((p: { id: string; phone: string; createdAt?: string; status: string; statusLabel?: string }) => ({
      id: p.id,
      toFrom: p.phone,
      started: p.createdAt
        ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "—",
      status: p.statusLabel || p.status,
      statusTone: portStatusTone(p.status),
    }));

  const recentNumbers = numbers.slice(0, 4).map((n) => ({
    phone: n.number,
    forwarding:
      n.forwardTargets.length > 0 ? n.forwardTargets[0] : n.forwardingEnabled ? "On" : "—",
    status: numberStatusLabel(n.serviceState, n.serviceLabel),
    statusTone: numberStatusTone(n.serviceState),
  }));

  const billingHistory: PersonalOverviewData["billingHistory"] = [];
  if (usage) {
    billingHistory.push({
      date: new Date(usage.billingPeriodStart).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      amount: `$${metrics.balance.toFixed(2)}`,
    });
  }

  const recentVoicemail = (voicemailMessages as Array<{
    id: string;
    fromE164?: string | null;
    createdAt: Date | string;
  }>)
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      name: "Unknown",
      phone: m.fromE164 || "—",
      at: relativeShort(new Date(m.createdAt)),
    }));

  const callsByLabel = new Map<string, number>();
  for (const n of numbers) {
    const label = n.friendlyName || n.number;
    const count = calls30d.filter((r) => r.calledNumber === n.number).length;
    if (count > 0) callsByLabel.set(label, count);
  }
  const topCallNumbers = [...callsByLabel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value]) => ({ label, value }));

  const timeline: PersonalOverviewData["timeline"] = [];
  for (const p of portRequests.slice(0, 2)) {
    timeline.push({
      id: `port-${p.id}`,
      date: p.createdAt
        ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "Recent",
      label: `Port request for ${p.phone}`,
    });
  }
  for (const vm of recentVoicemail.slice(0, 2)) {
    timeline.push({
      id: `vm-${vm.id}`,
      date: vm.at,
      label: `Voicemail from ${vm.phone}`,
    });
  }
  for (const row of calls30d.slice(0, 3)) {
    timeline.push({
      id: `call-${row.id}`,
      date: row.date,
      label: `${row.outcome} call on ${row.calledNumber}`,
    });
  }

  const numbersDelta = numbersThisWeek - numbersPriorWeek;
  const blockedDelta = blockedThisWeek - blockedPriorWeek;

  return {
    kpis: {
      totalNumbers: numbers.length,
      totalNumbersDelta:
        numbersDelta === 0
          ? "+0 from last week"
          : numbersDelta > 0
            ? `+${numbersDelta} from last week`
            : `${numbersDelta} from last week`,
      voicemails: voicemailTotal,
      voicemailsTrendPct: trendPct(voicemailTotal, voicemailsPrior),
      transcriptions: transcriptionTotal,
      transcriptionsTrendPct: trendPct(transcriptionTotal, transcriptionsPrior),
      calls30d: calls30d.length,
      callsTrendPct: trendPct(calls30d.length, callsPriorPeriod.length),
      walletBalance: metrics.balance,
      walletTrendPct: 0,
      blockedNumbers: blockedRows.length,
      blockedDelta:
        blockedDelta === 0
          ? "+0 from last week"
          : blockedDelta > 0
            ? `+${blockedDelta} from last week`
            : `${blockedDelta} from last week`,
      walletAutoTopup: Boolean(usage && usage.forwardingMinutesRemaining > 0),
    },
    topNumbers,
    timeline: timeline.slice(0, 6),
    topDestinations,
    pendingTransfers,
    recentNumbers,
    billingHistory,
    recentVoicemail,
    topCallNumbers,
    activityCount: activity.length,
  };
}
