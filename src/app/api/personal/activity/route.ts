import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadPersonalCallActivity } from "@/lib/workspace/personal-data";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const numberId = url.searchParams.get("numberId") || undefined;
    const limit = Number(url.searchParams.get("limit") || "50");

    const rows = await loadPersonalCallActivity(auth.workspaceId, {
      numberId,
      limit: Math.min(limit, 200),
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}
