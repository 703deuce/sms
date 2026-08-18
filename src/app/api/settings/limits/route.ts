import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getWorkspaceLimits,
  upsertWorkspaceLimits,
  parseWorkspaceLimits,
  type WorkspaceLimitsJson,
} from "@/lib/settings/limits";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const row = await getWorkspaceLimits(auth.workspaceId);
    return NextResponse.json({
      data: (row?.limits as WorkspaceLimitsJson) ?? {},
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as WorkspaceLimitsJson;
    const existing = await getWorkspaceLimits(auth.workspaceId);
    const merged = {
      ...parseWorkspaceLimits(existing),
      ...body,
      personalUsageAlerts: {
        ...parseWorkspaceLimits(existing).personalUsageAlerts,
        ...body.personalUsageAlerts,
      },
    };
    const row = await upsertWorkspaceLimits(auth.workspaceId, merged);
    return NextResponse.json({ data: row.limits });
  } catch (err) {
    return jsonError(err, 400);
  }
}
