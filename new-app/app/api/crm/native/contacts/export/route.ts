import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { exportContactsCsv } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const csv = await exportContactsCsv(workspaceId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="contacts-export.csv"',
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
