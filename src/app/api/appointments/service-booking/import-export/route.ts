import {
  importClientsCsv,
  exportClientsCsv,
  exportAppointmentsCsv,
  rollbackImportBatch,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") || "clients";
  const authResult = await withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const csv = kind === "appointments" ? await exportAppointmentsCsv(workspaceId) : await exportClientsCsv(workspaceId);
    return csv;
  });
  if (authResult instanceof NextResponse) {
    const json = await authResult.json();
    if (typeof json.data === "string") {
      return new NextResponse(json.data, { headers: { "Content-Type": "text/csv" } });
    }
  }
  return authResult;
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "rollback") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      rollbackImportBatch(workspaceId, body.batchId),
    );
  }
  return withAppointmentsAuth("appointments.write", async ({ workspaceId, userId }) =>
    importClientsCsv(workspaceId, body.rows || [], userId),
  );
}
