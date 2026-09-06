import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { configureSamlSso, configureScimProvisioning, listGranularRoles, listUserRoleAssignments, saveUserRoleAssignments } from "@/lib/appointments/org-permissions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const roles = await listGranularRoles(auth.workspaceId);
    const { loadAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const userRoleAssignments = await listUserRoleAssignments(auth.workspaceId);
    return NextResponse.json({
      data: {
        roles,
        userRoleAssignments,
        samlSso: (platform as { samlSso?: unknown }).samlSso || null,
        scimProvisioning: (platform as { scimProvisioning?: unknown }).scimProvisioning || null,
        organizationPolicy: (platform as { organizationPolicy?: unknown }).organizationPolicy || null,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { action?: string; config?: Record<string, unknown> };
    if (body.action === "saml") {
      const saved = await configureSamlSso(auth.workspaceId, body.config as Parameters<typeof configureSamlSso>[1]);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "scim") {
      const saved = await configureScimProvisioning(
        auth.workspaceId,
        body.config as Parameters<typeof configureScimProvisioning>[1],
      );
      return NextResponse.json({ data: saved });
    }
    if (body.action === "roles") {
      const saved = await saveUserRoleAssignments(
        auth.workspaceId,
        (body.assignments || {}) as Record<string, string>,
      );
      return NextResponse.json({ data: saved });
    }
    return NextResponse.json({ error: "action must be saml, scim, or roles" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
