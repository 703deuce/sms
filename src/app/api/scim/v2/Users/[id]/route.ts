import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { listGranularRoles } from "@/lib/appointments/org-permissions";

type Params = { params: Promise<{ id: string }> };

async function authorizeScim(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return { error: NextResponse.json({ error: "workspaceId required" }, { status: 400 }) };

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const scim = (platform as { scimProvisioning?: { enabled?: boolean; bearerToken?: string } }).scimProvisioning;
  if (!scim?.enabled || !scim.bearerToken || token !== scim.bearerToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { workspaceId, platform };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const auth = await authorizeScim(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const assignments = (auth.platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments || {};
    const roleId = assignments[id];
    if (!roleId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const roles = await listGranularRoles(auth.workspaceId);
    return NextResponse.json({
      id,
      userName: id,
      active: true,
      roleId,
      roleName: roles.find((r) => r.id === roleId)?.name,
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await authorizeScim(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { active?: boolean; roleId?: string };
    const assignments = { ...(auth.platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments };

    if (body.active === false) {
      delete assignments[id];
      await saveAppointmentPlatformConfig(auth.workspaceId, { userRoleAssignments: assignments } as object);
      return NextResponse.json({ ok: true, deactivated: true });
    }

    if (!assignments[id] && body.active !== false) {
      assignments[id] = body.roleId || "scheduler";
    } else if (body.roleId) {
      assignments[id] = body.roleId;
    }

    await saveAppointmentPlatformConfig(auth.workspaceId, { userRoleAssignments: assignments } as object);
    const roles = await listGranularRoles(auth.workspaceId);
    return NextResponse.json({
      id,
      userName: id,
      active: true,
      roleId: assignments[id],
      roleName: roles.find((r) => r.id === assignments[id])?.name,
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await authorizeScim(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const assignments = { ...(auth.platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments };
    delete assignments[id];
    await saveAppointmentPlatformConfig(auth.workspaceId, { userRoleAssignments: assignments } as object);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
