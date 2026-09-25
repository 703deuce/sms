import "server-only";

import { loadReceptionistPeriodAggregate } from "./receptionist-period-aggregate";

export type ReceptionistAnalyticsSnapshot = {
  timezone: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  population: "inbound_non_test";
  totalCalls: number;
  appointmentsBooked: number;
  callbacksRequested: number;
};

/** Lightweight Overview KPI source — same semantics as Analytics `receptionist` slice. */
export async function loadReceptionistAnalyticsSnapshot(
  workspaceId: string,
  days = 7,
): Promise<ReceptionistAnalyticsSnapshot> {
  const { timezone, periodDays, periodStart, periodEnd, receptionistAgg } =
    await loadReceptionistPeriodAggregate(workspaceId, days);

  return {
    timezone,
    periodDays,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    population: "inbound_non_test",
    totalCalls: receptionistAgg.totalCalls,
    appointmentsBooked: receptionistAgg.appointmentsBooked,
    callbacksRequested: receptionistAgg.callbacksRequested,
  };
}
