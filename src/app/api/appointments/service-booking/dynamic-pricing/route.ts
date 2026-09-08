import {
  listDynamicPricingRules,
  upsertDynamicPricingRule,
  evaluateSlotPrice,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listDynamicPricingRules(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "evaluate") {
      return evaluateSlotPrice(workspaceId, body);
    }
    return upsertDynamicPricingRule(workspaceId, body);
  });
}
