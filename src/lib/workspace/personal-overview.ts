import { getPrisma } from "@/lib/db";
import { listPortRequests } from "@/lib/numbers/port-service";
import { loadDashboardMetrics } from "@/lib/workspace-data";
import {
  loadPersonalCallActivity,
  loadPersonalNumbers,
  loadParkedNumbers,
  loadPersonalUsage,
} from "@/lib/workspace/personal-data";

export type PersonalOverviewTopContact = {
  id: string;
  phone: string;
  location: string;
  recentActivity: string;
  type: string;
  line: string;
  status: string;
  statusTone: "green" | "blue" | "orange" | "purple" | "gray";
  totalActivity: string;
  lastAction: string;
};

export type PersonalOverviewData = {
  kpis: {
    totalContacts: number;
    contactsAddedLastMonth: number;
    activeNumbers: number;
    textsSent30d: number;
    calls30d: number;
    balance: number;
    balanceSub: string;
    vaultCount: number;
    vaultActive: number;
  };
  topContacts: PersonalOverviewTopContact[];
  numberReview: {
    total: number;
    mobile: number;
    landline: number;
    voip: number;
    invalid: number;
  };
  pendingTasks: Array<{ id: string; text: string; at: string }>;
  communicationLog: Array<{ phone: string; date: string; time: string }>;
  recentActivityLog: Array<{ id: string; text: string; at: string }>;
  analyticsTotal: number;
  analyticsChangePct: number;
  monthlyPerformance: number[];
  voicemailUnread: number;
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

function formatDurationShort(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

function outcomeStatus(outcome: string, blocked: boolean): {
  label: string;
  tone: PersonalOverviewTopContact["statusTone"];
} {
  if (blocked) return { label: "Blocked", tone: "orange" };
  const o = outcome.toLowerCase();
  if (o.includes("answer")) return { label: "Active", tone: "green" };
  if (o.includes("miss")) return { label: "Prospect", tone: "orange" };
  if (o.includes("voicemail")) return { label: "Managed", tone: "blue" };
  if (o.includes("fail")) return { label: "Finished", tone: "green" };
  return { label: "Active", tone: "green" };
}

export async function loadPersonalOverviewData(workspaceId: string): Promise<PersonalOverviewData> {
  const periodStart = daysAgo(30);
  const priorStart = daysAgo(60);

  const [numbers, parked, activity, usage, metrics, portRequests, voicemailUnread] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadParkedNumbers(workspaceId),
    loadPersonalCallActivity(workspaceId, { limit: 300 }),
    loadPersonalUsage(workspaceId).catch(() => null),
    loadDashboardMetrics(workspaceId),
    listPortRequests(workspaceId),
    getPrisma().voicemailMessage.count({
      where: { workspaceId, isRead: false },
    }).catch(() => 0),
  ]);

  const calls30d = activity.filter((r) => {
    const d = new Date(`${r.date} ${r.time}`);
    return d >= periodStart;
  });

  const callsPrior = activity.filter((r) => {
    const d = new Date(`${r.date} ${r.time}`);
    return d >= priorStart && d < periodStart;
  });

  const labelByNumber = new Map(
    numbers.map((n) => [n.number, n.friendlyName || n.areaCode || "Main Line"]),
  );

  const callerMap = new Map<
    string,
    {
      id: string;
      phone: string;
      count: number;
      totalSeconds: number;
      last: PersonalOverviewTopContact;
    }
  >();

  for (const row of calls30d) {
    const key = row.caller.replace(/\D/g, "") || row.caller;
    const stamp = new Date(`${row.date} ${row.time}`);
    const status = outcomeStatus(row.outcome, row.blocked);
    const entry = callerMap.get(key);
    const recentActivity =
      row.voicemail
        ? "Voicemail received"
        : row.blocked
          ? "Blocked call attempt"
          : row.outcome === "Answered"
            ? "Inbound call answered"
            : `Inbound call — ${row.outcome}`;

    if (!entry) {
      callerMap.set(key, {
        id: row.id,
        phone: row.caller,
        count: 1,
        totalSeconds: row.durationSeconds,
        last: {
          id: row.id,
          phone: row.caller,
          location: labelByNumber.get(row.calledNumber) || "—",
          recentActivity,
          type: "Inbound",
          line: labelByNumber.get(row.calledNumber) || row.calledNumber,
          status: status.label,
          statusTone: status.tone,
          totalActivity: formatDurationShort(row.durationSeconds),
          lastAction: relativeShort(stamp),
        },
      });
    } else {
      entry.count += 1;
      entry.totalSeconds += row.durationSeconds;
      entry.last = {
        ...entry.last,
        recentActivity,
        totalActivity: formatDurationShort(entry.totalSeconds),
        lastAction: relativeShort(stamp),
        status: status.label,
        statusTone: status.tone,
      };
    }
  }

  const topContacts = [...callerMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((e) => ({
      ...e.last,
      totalActivity:
        e.count > 1
          ? `${e.count} calls · ${formatDurationShort(e.totalSeconds)}`
          : formatDurationShort(e.totalSeconds),
    }));

  const activeNumbers = numbers.filter((n) => n.serviceState !== "PARKED").length;

  const pendingTasks: PersonalOverviewData["pendingTasks"] = [];
  for (const p of portRequests.filter(
    (r: { status: string; id: string; phone: string }) =>
      r.status === "docs_needed" || r.status === "rejected",
  ).slice(0, 5)) {
    pendingTasks.push({
      id: `port-${p.id}`,
      text: `Port action: ${p.phone}`,
      at: "Today",
    });
  }
  if (voicemailUnread > 0) {
    pendingTasks.push({
      id: "vm-unread",
      text: `${voicemailUnread} unread voicemail${voicemailUnread === 1 ? "" : "s"}`,
      at: "Now",
    });
  }
  for (const row of calls30d.filter((r) => r.outcome === "Missed").slice(0, 3)) {
    pendingTasks.push({
      id: `missed-${row.id}`,
      text: `Follow up with ${row.caller}`,
      at: relativeShort(new Date(`${row.date} ${row.time}`)),
    });
  }

  const communicationLog = calls30d.slice(0, 5).map((r) => {
    const d = new Date(`${r.date} ${r.time}`);
    return {
      phone: r.caller,
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
  });

  const recentActivityLog = calls30d.slice(0, 6).map((r) => ({
    id: r.id,
    text: `${r.outcome} call from ${r.caller}`,
    at: relativeShort(new Date(`${r.date} ${r.time}`)),
  }));

  const monthlyBuckets = Array.from({ length: 7 }, (_, i) => {
    const start = daysAgo((6 - i) * 4);
    const end = daysAgo((6 - i - 1) * 4);
    return activity.filter((r) => {
      const d = new Date(`${r.date} ${r.time}`);
      return d >= start && d < end;
    }).length;
  });

  const uniqueCallers30 = new Set(calls30d.map((r) => r.caller.replace(/\D/g, ""))).size;
  const uniqueCallersPrior = new Set(callsPrior.map((r) => r.caller.replace(/\D/g, ""))).size;
  const contactsAdded = Math.max(0, uniqueCallers30 - uniqueCallersPrior);

  const analyticsChangePct =
    callsPrior.length > 0
      ? Math.round(((calls30d.length - callsPrior.length) / callsPrior.length) * 100)
      : calls30d.length > 0
        ? 100
        : 0;

  const mobile = numbers.filter((n) => n.type === "Toll-free").length;
  const landline = numbers.filter((n) => n.type === "Local").length;
  const voip = 0;

  return {
    kpis: {
      totalContacts: uniqueCallers30 || metrics.contactGrowth,
      contactsAddedLastMonth: contactsAdded,
      activeNumbers,
      textsSent30d: metrics.messagesSentPeriod,
      calls30d: calls30d.length,
      balance: metrics.balance,
      balanceSub:
        usage && usage.forwardingMinutesRemaining > 0
          ? `${usage.forwardingMinutesRemaining} min remaining`
          : "Next refill at $5.00",
      vaultCount: parked.length,
      vaultActive: parked.filter((n) => n.serviceState === "PARKED").length,
    },
    topContacts,
    numberReview: {
      total: numbers.length,
      mobile: mobile || Math.max(0, numbers.length - landline - voip),
      landline,
      voip,
      invalid: 0,
    },
    pendingTasks,
    communicationLog,
    recentActivityLog,
    analyticsTotal: calls30d.length,
    analyticsChangePct,
    monthlyPerformance: monthlyBuckets,
    voicemailUnread,
    activityCount: activity.length,
  };
}
