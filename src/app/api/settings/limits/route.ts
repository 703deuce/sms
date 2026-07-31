import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getWorkspaceLimits,
  upsertWorkspaceLimits,
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
    const row = await upsertWorkspaceLimits(auth.workspaceId, body);
    return NextResponse.json({ data: row.limits });
  } catch (err) {
    return jsonError(err, 400);
  }
}
