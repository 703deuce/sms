import {
  listWaitlistPriorityRules,
  upsertWaitlistPriorityRule,
  rankWaitlistEntries,
  scoreWaitlistEntry,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rank = url.searchParams.get("rank") === "1";

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (rank) {
      const entryIds = url.searchParams.get("entryIds")?.split(",").filter(Boolean);
      return rankWaitlistEntries(workspaceId, entryIds);
    }
    return listWaitlistPriorityRules(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "score") {
      return scoreWaitlistEntry(workspaceId, body);
    }
    return upsertWaitlistPriorityRule(workspaceId, body);
  });
}
