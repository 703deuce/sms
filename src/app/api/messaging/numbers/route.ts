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
    const locality = url.searchParams.get("city") || undefined;
    const administrativeArea = url.searchParams.get("state") || undefined;
    const contains = url.searchParams.get("contains") || undefined;
    const mms = url.searchParams.get("mms") === "1";

    const numbers = await messagingOnboarding.searchNumbers(workspaceId, areaCode || undefined, {
      locality,
      administrativeArea,
      contains,
      mms,
    });
    return NextResponse.json({ data: numbers });
  } catch (err) {
    return jsonError(err, 400);
  }
}
