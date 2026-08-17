import { getPrisma } from "@/lib/db";
import { listPortRequests } from "@/lib/numbers/port-service";
import { loadDashboardMetrics, loadTeamMembers } from "@/lib/workspace-data";
import {
  loadPersonalCallActivity,
  loadPersonalNumbers,
  loadPersonalUsage,
} from "@/lib/workspace/personal-data";

export type PersonalOverviewStatusTone =
  | "green"
  | "blue"
  | "orange"
  | "purple"
  | "gray"
  | "yellow"
  | "red";

export type PersonalOverviewCallRow = {
  id: string;
  date: string;
  extensionAgent: string;
  type: string;
  duration: string;
  outcome: string;
  direction: string;
  status: string;
  statusTone: PersonalOverviewStatusTone;
};

export type PersonalOverviewData = {
  kpis: {
    phoneNumbers: number;
    totalExtensions: number;
    forwardedNumbers: number;
    agents: number;
    monthlySpend: number;
    activeConversations: number;
  };
  callActivity: PersonalOverviewCallRow[];
  topExtensions: Array<{ id: string; label: string }>;
  activeDevices: Array<{ id: string; label: string; sub?: string }>;
  quickNotes: Array<{ id: string; text: string }>;
  invoices: Array<{ label: string; amount: string }>;
  pendingDeployments: Array<{ id: string; label: string; progress: number }>;
  activeNumbers: Array<{ id: string; phone: string; label: string }>;
  services: Array<{ label: string; online: boolean }>;
  communications: Array<{ phone: string; at: string }>;
  recentReports: Array<{ name: string; size: string }>;
  callStatusOverview: Array<{ label: string; value: number }>;
  activityCount: number;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function formatDurationClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function callerTypeLabel(device?: string | null): string {
  const d = (device || "").toLowerCase();
  if (d.includes("land")) return "Landline";
  if (d.includes("voip") || d.includes("sip")) return "VoIP";
  if (d.includes("mobile") || d.includes("cell")) return "Cell";
  return "Cell";
}

function outcomeStatus(outcome: string, blocked: boolean): {
  status: string;
  tone: PersonalOverviewStatusTone;
} {
  if (blocked) return { status: "Blocked", tone: "red" };
  const o = outcome.toLowerCase();
  if (o.includes("answer") || o.includes("complete")) {
    return { status: "Active", tone: "green" };
  }
  if (o.includes("miss") || o.includes("pending")) {
    return { status: "Pending", tone: "orange" };
  }
  return { status: "Active", tone: "green" };
}

function portProgress(status: string): number {
  const s = status.toLowerCase();
  if (s.includes("complete")) return 100;
  if (s.includes("progress") || s.includes("submitted")) return 65;
  if (s.includes("pending") || s.includes("docs")) return 30;
  return 15;
}

export async function loadPersonalOverviewData(workspaceId: string): Promise<PersonalOverviewData> {
  const periodStart = daysAgo(30);

  const [numbers, activity, usage, metrics, portRequests, team] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadPersonalCallActivity(workspaceId, { limit: 200 }),
    loadPersonalUsage(workspaceId).catch(() => null),
    loadDashboardMetrics(workspaceId),
    listPortRequests(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const labelByNumber = new Map(
    numbers.map((n) => [n.number, n.friendlyName || n.areaCode || "Main Line"]),
  );

  const calls30d = activity.filter((r) => {
    const d = new Date(`${r.date} ${r.time}`);
    return d >= periodStart;
  });

  const activeNumbersList = numbers
    .filter((n) => n.serviceState !== "PARKED")
    .slice(0, 4)
    .map((n) => ({
      id: n.id,
      phone: n.number,
      label: n.friendlyName || "New Line Number",
    }));

  const forwardedCount = numbers.filter((n) => n.forwardingEnabled).length;
  const monthlySpendCents = numbers.reduce((s, n) => s + (n.monthlyCost || 0), 0);
  const uniqueCallers = new Set(calls30d.map((r) => r.caller.replace(/\D/g, ""))).size;

  const callActivity = calls30d.slice(0, 8).map((row) => {
    const { status, tone } = outcomeStatus(row.outcome, row.blocked);
    return {
      id: row.id,
      date: row.date,
      extensionAgent: row.caller || labelByNumber.get(row.calledNumber) || "Unknown",
      type: callerTypeLabel(row.forwardDestination),
      duration: formatDurationClock(row.durationSeconds),
      outcome: row.outcome,
      direction: "Inbound",
      status,
      statusTone: tone,
    };
  });

  const topExtensions = numbers.slice(0, 4).map((n, i) => ({
    id: n.id,
    label: n.friendlyName || `Extension ${101 + i * 101}`,
  }));

  const activeDevices = numbers
    .filter((n) => n.forwardingEnabled && n.forwardTargets.length > 0)
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      label: n.forwardTargets[0] || n.friendlyName || n.number,
      sub: n.friendlyName || "Forwarding target",
    }));

  const quickNotes = portRequests
    .filter((p: { status: string }) => !String(p.status).toLowerCase().includes("complete"))
    .slice(0, 3)
    .map((p: { id: string; phone: string }) => ({
      id: p.id,
      text: `Port action for ${p.phone}`,
    }));

  const invoices = [
    {
      label: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      amount: `$${(monthlySpendCents / 100).toFixed(2)}`,
    },
    {
      label: new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        1,
      ).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      amount: `$${(monthlySpendCents / 100).toFixed(2)}`,
    },
  ];

  const pendingDeployments = portRequests.slice(0, 3).map((p: {
    id: string;
    phone: string;
    status: string;
  }) => ({
    id: p.id,
    label: `Port ${p.phone}`,
    progress: portProgress(p.status),
  }));

  const communications = calls30d.slice(0, 4).map((r) => ({
    phone: r.caller,
    at: `${r.date} · ${r.time}`,
  }));

  const answeredSeconds = calls30d
    .filter((r) => r.answered)
    .reduce((s, r) => s + r.durationSeconds, 0);
  const waitSeconds = calls30d.reduce((s, r) => s + (r.ringDurationSeconds || 0), 0);
  const maxStat = Math.max(answeredSeconds, waitSeconds, 1);

  return {
    kpis: {
      phoneNumbers: activeNumbersList.length,
      totalExtensions: numbers.length,
      forwardedNumbers: forwardedCount,
      agents: team.length,
      monthlySpend: monthlySpendCents / 100 || metrics.balance,
      activeConversations: uniqueCallers,
    },
    callActivity,
    topExtensions,
    activeDevices,
    quickNotes,
    invoices,
    pendingDeployments,
    activeNumbers: activeNumbersList,
    services: [
      { label: "Cloud Connect", online: true },
      { label: "SMS Messaging", online: metrics.a2pStatus === "Approved" },
      { label: "Voice Analytics", online: true },
    ],
    communications,
    recentReports: [
      { name: "Call Summary Report.pdf", size: "5.2 MB" },
      { name: "Usage Analytics.pdf", size: "3.8 MB" },
    ],
    callStatusOverview: [
      { label: "Call Time", value: Math.round((answeredSeconds / maxStat) * 100) },
      { label: "Average Wait Time", value: Math.round((waitSeconds / maxStat) * 100) },
    ],
    activityCount: activity.length,
  };
}
