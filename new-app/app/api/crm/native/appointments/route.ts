import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { createAppointment, listAppointments } from "@/lib/server/crm/native/tasks-appointments";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const data = await listAppointments(workspaceId, {
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      contactId: url.searchParams.get("contactId") || undefined,
      includeCancelled: url.searchParams.get("includeCancelled") === "1",
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    if (!body.title?.trim() || !body.startsAt || !body.endsAt || !body.timezone) {
      return NextResponse.json({ error: "title, startsAt, endsAt, timezone required" }, { status: 400 });
    }
    const data = await createAppointment(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
