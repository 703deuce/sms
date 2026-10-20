import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createWorkspaceCalendarConnection,
  listWorkspaceCalendarConnections,
} from "@/lib/calendar/connections";
import { resolveMicrosoftCalendarConnectionForCreate } from "@/lib/calendar/microsoft-canonical-connection";
import { isCalendarProviderAllowedForAppointmentReminders } from "@/lib/appointment-reminders/calendar-provider-policy";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await listWorkspaceCalendarConnections(auth.workspaceId);
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      provider?: string;
      config?: Record<string, unknown>;
    };
    const provider = body.provider || "internal";
    const productContext = body.config?.productContext;
    if (
      productContext === "appointment_reminders" &&
      !isCalendarProviderAllowedForAppointmentReminders(provider)
    ) {
      return NextResponse.json(
        { error: "This calendar provider is not available for appointment reminders." },
        { status: 403 },
      );
    }
    if (provider === "microsoft") {
      const { connection, created } = await resolveMicrosoftCalendarConnectionForCreate(
        auth.workspaceId,
        body,
      );
      return NextResponse.json({ data: connection }, { status: created ? 201 : 200 });
    }
    const row = await createWorkspaceCalendarConnection(auth.workspaceId, body);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
