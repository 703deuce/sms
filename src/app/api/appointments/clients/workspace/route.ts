import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { buildClientsDirectory } from "@/lib/appointments/clients/clients-workspace";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const data = await buildClientsDirectory(auth.workspaceId, {
      q: searchParams.get("q") || undefined,
      take: Number(searchParams.get("take") || 50),
      skip: Number(searchParams.get("skip") || 0),
      status: searchParams.get("status") || undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
