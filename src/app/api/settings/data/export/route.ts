import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { exportWorkspaceData } from "@/lib/settings/data-prefs";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const data = await exportWorkspaceData(auth.workspaceId);
    const json = JSON.stringify(data, null, 2);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="workspace-export-${auth.workspaceId}.json"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
