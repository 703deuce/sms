import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadCallerHistory } from "@/lib/platform/caller-history";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const callerE164 = String(url.searchParams.get("callerE164") || "").trim();
    if (!callerE164) return jsonError(new Error("callerE164 required"), 400);
    const entries = await loadCallerHistory(auth.workspaceId, callerE164);
    return NextResponse.json({ data: entries });
  } catch (err) {
    return jsonError(err);
  }
}
