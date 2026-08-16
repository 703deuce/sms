import { getPrisma } from "@/lib/db";

export type VoicePhoneMinutesSummary = {
  /** Talk time on real phone calls today (excludes browser tests). */
  minutesToday: number;
  minutesYesterday: number;
  deltaPct: number | null;
  callsToday: number;
  callsYesterday: number;
  /** Last 7 calendar days, oldest → today (minutes per day). */
  sparklineMinutes: number[];
  sparklineLabels: string[];
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Format minutes for dashboard display (e.g. 2.5, 12). */
export function formatPhoneMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0";
  if (minutes < 10) return minutes.toFixed(1);
  return String(Math.round(minutes));
}

/**
 * Phone talk time from completed voice_calls (PSTN/LiveKit), not TTS/browser test sessions.
 */
export async function loadVoicePhoneMinutesSummary(
  workspaceId: string,
): Promise<VoicePhoneMinutesSummary> {
  const prisma = getPrisma();
  const todayStart = startOfLocalDay(new Date());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysStart = new Date(todayStart);
  sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);

  const talkTimeWhere = {
    workspaceId,
    isTest: false,
    durationSeconds: { not: null },
  };

  const [todayAgg, yesterdayAgg, callsToday, callsYesterday, recentCalls] =
    await Promise.all([
      prisma.voiceCall.aggregate({
        where: { ...talkTimeWhere, startedAt: { gte: todayStart, lt: tomorrow } },
        _sum: { durationSeconds: true },
      }),
      prisma.voiceCall.aggregate({
        where: {
          ...talkTimeWhere,
          startedAt: { gte: yesterdayStart, lt: todayStart },
        },
        _sum: { durationSeconds: true },
      }),
      prisma.voiceCall.count({
        where: {
          workspaceId,
          isTest: false,
          startedAt: { gte: todayStart, lt: tomorrow },
        },
      }),
      prisma.voiceCall.count({
        where: {
          workspaceId,
          isTest: false,
          startedAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
      prisma.voiceCall.findMany({
        where: {
          ...talkTimeWhere,
          startedAt: { gte: sevenDaysStart, lt: tomorrow },
        },
        select: { startedAt: true, durationSeconds: true },
      }),
    ]);

  const minutesToday = (todayAgg._sum.durationSeconds ?? 0) / 60;
  const minutesYesterday = (yesterdayAgg._sum.durationSeconds ?? 0) / 60;

  const sparklineLabels: string[] = [];
  const byDayMinutes: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysStart);
    d.setDate(d.getDate() + i);
    const key = localDayKey(d);
    sparklineLabels.push(
      d.toLocaleDateString("en-US", { weekday: "short" }),
    );
    byDayMinutes[key] = 0;
  }

  for (const call of recentCalls) {
    const key = localDayKey(call.startedAt);
    if (byDayMinutes[key] != null) {
      byDayMinutes[key] += (call.durationSeconds ?? 0) / 60;
    }
  }

  const sparklineMinutes = Object.keys(byDayMinutes)
    .sort()
    .map((k) => Math.round(byDayMinutes[k] * 10) / 10);

  return {
    minutesToday: Math.round(minutesToday * 10) / 10,
    minutesYesterday: Math.round(minutesYesterday * 10) / 10,
    deltaPct: pctChange(minutesToday, minutesYesterday),
    callsToday,
    callsYesterday,
    sparklineMinutes,
    sparklineLabels,
  };
}

/** Sum phone talk minutes for calls that started in [start, end). */
export async function sumVoicePhoneMinutesInRange(
  workspaceId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const prisma = getPrisma();
  const agg = await prisma.voiceCall.aggregate({
    where: {
      workspaceId,
      isTest: false,
      durationSeconds: { not: null },
      startedAt: { gte: start, lt: end },
    },
    _sum: { durationSeconds: true },
  });
  return Math.round(((agg._sum.durationSeconds ?? 0) / 60) * 10) / 10;
}
