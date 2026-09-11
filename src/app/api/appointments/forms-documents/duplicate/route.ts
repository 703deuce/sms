import { NextResponse } from "next/server";
import { duplicateIntakeForm } from "@/lib/appointments/service-booking/intake-forms";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    duplicateIntakeForm(workspaceId, body.id!),
  );
}
