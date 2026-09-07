import { getPrisma, type DbRow } from "@/lib/db";
import { getBillingSummary, getUpcomingBillEstimate } from "@/lib/settings/billing";
import { loadVoiceAnalytics } from "@/lib/voice/analytics";

export type VoiceBillingUsageMeter = {
  id: string;
  label: string;
  used: number;
  limit: number;
  unit: string;
  detail?: string;
};

export type VoiceBillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountCents: number;
  createdAt: string;
  hostedInvoiceUrl: string | null;
  pdf: string | null;
};

export type VoiceBillingDashboard = {
  periodDays: number;
  analytics: Awaited<ReturnType<typeof loadVoiceAnalytics>>;
  plan: {
    name: string;
    priceCents: number | null;
    priceLabel: string;
  };
  billingCycle: {
    periodStart: string;
    periodEnd: string;
    renewsLabel: string;
  };
  spendLimitCents: number | null;
  spentThisPeriodCents: number;
  usageMeters: VoiceBillingUsageMeter[];
  categoryBreakdown: Array<{ id: string; label: string; costCents: number; quantity: number; unit: string }>;
  agentBreakdown: Array<{ agentId: string; agentName: string; calls: number; costCents: number }>;
  recentUsage: Array<{
    id: string;
    category: string;
    quantity: number;
    unit: string;
    billedCostCents: number;
    createdAt: string;
    callId: string | null;
  }>;
  invoices: VoiceBillingInvoice[];
  stripeConfigured: boolean;
};

function formatDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function titleCasePlan(plan: string) {
  if (!plan) return "Growth";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function planPriceLabel(plan: string): { priceCents: number | null; priceLabel: string } {
  const fees: Record<string, number> = {
    starter: 4900,
    growth: 9900,
    pro: 19900,
    enterprise: 49900,
  };
  const key = plan.toLowerCase();
  const cents = fees[key] ?? 9900;
  return { priceCents: cents, priceLabel: `$${(cents / 100).toFixed(0)}/mo` };
}

export async function loadVoiceBillingDashboard(
  workspaceId: string,
  days = 30,
): Promise<VoiceBillingDashboard> {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    analytics,
    profile,
    usageRecords,
    agents,
    billingSummary,
    estimate,
    phoneNumbers,
    smsUsage,
  ] = await Promise.all([
    loadVoiceAnalytics(workspaceId, days),
    prisma.voiceComplianceProfile.findUnique({
      where: { workspaceId },
      select: { settings: true },
    }),
    prisma.voiceUsageRecord.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.voiceAgent.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    }),
    getBillingSummary(workspaceId),
    getUpcomingBillEstimate(workspaceId),
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      select: { id: true, status: true },
    }),
    prisma.usageRecord.findMany({
      where: {
        workspaceId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      orderBy: { periodStart: "desc" },
      take: 1,
    }),
  ]);

  const settings = (profile?.settings || {}) as {
    spendLimitCents?: number | null;
    voiceMinutesLimit?: number | null;
    aiMinutesLimit?: number | null;
    phoneNumbersLimit?: number | null;
  };
  const spendLimitCents =
    typeof settings.spendLimitCents === "number" ? settings.spendLimitCents : null;

  const agentNames = new Map<string, string>(agents.map((a: DbRow) => [String(a.id), String(a.name || "Unnamed agent")]));

  const categoryTotals = new Map<string, { costCents: number; quantity: number; unit: string }>();
  for (const row of usageRecords) {
    const key = row.category;
    const existing = categoryTotals.get(key) || { costCents: 0, quantity: 0, unit: row.unit };
    existing.costCents += row.billedCostCents || 0;
    existing.quantity += row.quantity;
    categoryTotals.set(key, existing);
  }

  const categoryLabels: Record<string, string> = {
    telephony: "Telephony",
    ai_minutes: "AI minutes",
    model: "LLM / model",
    llm: "LLM / model",
    transcription: "Transcription",
  };

  const telephonyCost = Math.round(analytics.telephonyMinutes * 2 * 1.5);
  const aiCost = Math.round(analytics.aiMinutes * 8 * 1.5);

  const categoryBreakdown = [
    {
      id: "telephony",
      label: "Telephony",
      costCents: categoryTotals.get("telephony")?.costCents || telephonyCost,
      quantity: analytics.telephonyMinutes,
      unit: "min",
    },
    {
      id: "ai_minutes",
      label: "AI assistant",
      costCents: categoryTotals.get("ai_minutes")?.costCents || aiCost,
      quantity: analytics.aiMinutes,
      unit: "min",
    },
    {
      id: "model",
      label: "LLM / model",
      costCents: analytics.modelCostCents,
      quantity: 0,
      unit: "usage",
    },
    {
      id: "transcription",
      label: "Transcription",
      costCents: analytics.transcriptionCostCents,
      quantity: 0,
      unit: "usage",
    },
  ].filter((c) => c.costCents > 0 || c.quantity > 0);

  const agentBreakdown = Object.entries(analytics.byAgent)
    .filter(([id]) => id !== "none")
    .map(([agentId, stats]) => ({
      agentId,
      agentName: agentNames.get(agentId) || "Unnamed agent",
      calls: stats.calls,
      costCents: stats.costCents,
    }))
    .sort((a, b) => b.costCents - a.costCents);

  const activeNumbers = phoneNumbers.filter((n: DbRow) =>
    /active|in[-_]?use|assigned/i.test(n.status || "active"),
  );
  const phoneNumberCount = activeNumbers.length || phoneNumbers.length;
  const smsSegments = Number(smsUsage[0]?.smsSegments ?? 0);

  const voiceMinutesLimit = settings.voiceMinutesLimit ?? 1000;
  const aiMinutesLimit = settings.aiMinutesLimit ?? 500;
  const phoneNumbersLimit = settings.phoneNumbersLimit ?? Math.max(5, phoneNumberCount);
  const smsLimit = 5000;

  const usageMeters: VoiceBillingUsageMeter[] = [
    {
      id: "voice_minutes",
      label: "Voice minutes",
      used: Math.round(analytics.telephonyMinutes),
      limit: voiceMinutesLimit,
      unit: "min",
      detail: `${Math.max(0, voiceMinutesLimit - Math.round(analytics.telephonyMinutes))} minutes remaining`,
    },
    {
      id: "ai_minutes",
      label: "AI agent minutes",
      used: Math.round(analytics.aiMinutes),
      limit: aiMinutesLimit,
      unit: "min",
      detail: `${Math.max(0, aiMinutesLimit - Math.round(analytics.aiMinutes))} minutes remaining`,
    },
    {
      id: "sms",
      label: "SMS messages",
      used: smsSegments,
      limit: smsLimit,
      unit: "segments",
      detail: `${Math.max(0, smsLimit - smsSegments)} segments remaining`,
    },
    {
      id: "numbers",
      label: "Phone numbers",
      used: phoneNumberCount,
      limit: phoneNumbersLimit,
      unit: "numbers",
      detail: `${Math.max(0, phoneNumbersLimit - phoneNumberCount)} slots remaining`,
    },
  ];

  const planPricing = planPriceLabel(billingSummary.plan);

  const invoices: VoiceBillingInvoice[] = estimate.invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amountCents: inv.amountPaid > 0 ? inv.amountPaid : inv.amountDue,
    createdAt: new Date(inv.created * 1000).toISOString(),
    hostedInvoiceUrl: inv.hostedInvoiceUrl,
    pdf: inv.pdf,
  }));

  return {
    periodDays: days,
    analytics,
    plan: {
      name: titleCasePlan(billingSummary.plan),
      priceCents: planPricing.priceCents,
      priceLabel: planPricing.priceLabel,
    },
    billingCycle: {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      renewsLabel: periodEnd.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
    spendLimitCents,
    spentThisPeriodCents: analytics.totalCostCents,
    usageMeters,
    categoryBreakdown,
    agentBreakdown,
    recentUsage: usageRecords.map((r: DbRow) => ({
      id: r.id,
      category: categoryLabels[r.category] || r.category,
      quantity: r.quantity,
      unit: r.unit,
      billedCostCents: r.billedCostCents,
      createdAt: r.createdAt.toISOString(),
      callId: r.callId,
    })),
    invoices,
    stripeConfigured: billingSummary.stripeConfigured,
  };
}

export { formatDayLabel };
