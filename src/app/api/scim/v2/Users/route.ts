import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { listGranularRoles } from "@/lib/appointments/org-permissions";

type ScimUser = {
  schemas: string[];
  userName: string;
  name?: { givenName?: string; familyName?: string };
  emails?: Array<{ value: string; primary?: boolean }>;
  active?: boolean;
};

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const scim = (platform as { scimProvisioning?: { enabled?: boolean; bearerToken?: string } }).scimProvisioning;
    if (!scim?.enabled || !scim.bearerToken || token !== scim.bearerToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignments = (platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments || {};
    const resources = Object.entries(assignments).map(([userId, roleId]) => ({
      id: userId,
      userName: userId,
      active: true,
      roleId,
    }));

    return NextResponse.json({
      Resources: resources,
      totalResults: resources.length,
      itemsPerPage: resources.length,
      startIndex: 1,
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const scim = (platform as {
      scimProvisioning?: { enabled?: boolean; bearerToken?: string; defaultRoleId?: string };
    }).scimProvisioning;
    if (!scim?.enabled || !scim.bearerToken || token !== scim.bearerToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ScimUser;
    const userName = body.userName || body.emails?.[0]?.value;
    if (!userName) return NextResponse.json({ error: "userName required" }, { status: 400 });

    const assignments = (platform as { userRoleAssignments?: Record<string, string> }).userRoleAssignments || {};
    const roleId = scim.defaultRoleId || "scheduler";
    assignments[userName] = roleId;
    await saveAppointmentPlatformConfig(workspaceId, { userRoleAssignments: assignments } as object);

    const roles = await listGranularRoles(workspaceId);
    return NextResponse.json(
      {
        id: userName,
        userName,
        active: body.active !== false,
        roleId,
        roleName: roles.find((r) => r.id === roleId)?.name,
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
