import { NextResponse } from "next/server";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";
import {
  listRegistrationRecoveryIssues,
  retryRegistrationFulfillment,
} from "@/lib/appointments/service-booking/registration-recovery";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const rows = await listRegistrationRecoveryIssues(workspaceId);
    return NextResponse.json({ data: rows });
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = String(body.stripeCheckoutSessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "stripeCheckoutSessionId is required" }, { status: 400 });
  }

  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    try {
      const result = await retryRegistrationFulfillment(workspaceId, sessionId);
      return NextResponse.json({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retry failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
