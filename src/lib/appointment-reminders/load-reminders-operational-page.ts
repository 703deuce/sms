import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type {
  ArRemindersPagePayload,
} from "@/lib/appointment-reminders/reminders-page-types";
import {
  loadRemindersLogGlobalSummary,
  loadRemindersLogPage,
} from "@/lib/appointment-reminders/reminders-log-query";

export type ArRemindersQuery = {
  q?: string;
  status?: string;
  horizon?: string;
  page?: number;
  pageSize?: number;
};

export async function loadAppointmentRemindersOperationalPage(
  workspaceId: string,
  query: ArRemindersQuery,
): Promise<ArRemindersPagePayload> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));

  const [platform, logPage, globalSummary] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    loadRemindersLogPage({
      workspaceId,
      q: query.q,
      status: query.status,
      horizon: query.horizon,
      page,
      pageSize,
    }),
    loadRemindersLogGlobalSummary(workspaceId),
  ]);

  return {
    rows: logPage.rows,
    total: logPage.total,
    page,
    pageSize,
    summary: globalSummary,
    timezone: platform.timezone,
  };
}
