import { MctbDashboardView } from "@/components/mctb/dashboard-view";
import type { DashboardDateRange } from "@/lib/outcomes/operational-dashboard-types";
import { requireWorkspaceContext } from "@/lib/workspace-data";

function parseRange(raw: string | undefined): DashboardDateRange {
  if (raw === "today" || raw === "30d" || raw === "7d") return raw;
  return "7d";
}

/** Missed Call Text Back — operational dashboard. */
export default async function MctbDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { session } = await requireWorkspaceContext();
  const params = await searchParams;
  const range = parseRange(params.range);
  return <MctbDashboardView userName={session.name} range={range} />;
}
