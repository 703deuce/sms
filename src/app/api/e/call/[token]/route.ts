import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { validateEmployeeAccessToken } from "@/lib/smart-routing/employee-access-token-service";
import { listApprovedCallerIdentities, resolveCallbackCallerIdE164 } from "@/lib/smart-routing/caller-id-resolver";
import {
  findRecentBusinessCallersForEmployee,
  resolveLastCallerForEmployee,
} from "@/lib/smart-routing/recent-callers-for-employee";
import { resolveAuthorizedCallerCallbackPhone } from "@/lib/smart-routing/business-callback-status";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const grant = await validateEmployeeAccessToken(token);
    if (!grant) return jsonError(new Error("Invalid or expired link"), 401);

    const caller = grant.authorizedCaller;
    const employeePhone = resolveAuthorizedCallerCallbackPhone(caller);
    const prisma = getPrisma();

    const destination = await prisma.smartRoutingDestination.findFirst({
      where: {
        workspaceId: grant.workspaceId,
        phoneNumber: caller.phoneE164,
      },
      select: { availabilityStatus: true },
    });

    const identities = await listApprovedCallerIdentities(grant.workspaceId);
    const selectedCallerId = await resolveCallbackCallerIdE164({
      workspaceId: grant.workspaceId,
      authorizedCallerDefaultE164: caller.defaultBusinessCallerIdE164,
    });

    const last = await resolveLastCallerForEmployee({
      workspaceId: grant.workspaceId,
      employeePhoneE164: employeePhone,
      authorizedCallerId: caller.id,
    });

    const recent = await findRecentBusinessCallersForEmployee({
      workspaceId: grant.workspaceId,
      employeePhoneE164: employeePhone,
    });

    return NextResponse.json({
      data: {
        workspaceName: grant.workspace.name,
        employeeName: caller.name,
        businessCallerIdE164: selectedCallerId,
        callerIdentities: identities,
        selectedCallerIdE164: selectedCallerId,
        availabilityStatus: destination?.availabilityStatus ?? "available",
        lastCaller: last
          ? { callerE164: last.callerE164, sessionId: last.sessionId }
          : null,
        recentCallers: recent.map((r) => ({
          callerE164: r.callerE164,
          sessionId: r.sessionId,
          calledAt: r.calledAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
