import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { messagingOnboarding } from "@/lib/messaging/service";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(auth.session, url.searchParams.get("workspaceId"));
    const areaCode = url.searchParams.get("areaCode") || undefined;

    const numbers = await messagingOnboarding.searchNumbers(workspaceId, areaCode || undefined);
    return NextResponse.json({ data: numbers });
  } catch (err) {
    return jsonError(err, 400);
  }
}
