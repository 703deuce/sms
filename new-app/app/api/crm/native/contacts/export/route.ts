import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { exportContactsCsv } from "@/lib/server/crm/native/contacts-admin";
import {
  getMembershipForUser,
  isPowerDialerAdminRole,
} from "@/lib/server/phone/power-dialer/campaign-access";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const membership = await getMembershipForUser(workspaceId, userId);
    if (
      !membership ||
      (!isPowerDialerAdminRole(membership.role) && membership.role !== "MANAGER")
    ) {
      throw new Error("Permission denied: contacts export requires manager or admin role");
    }
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
