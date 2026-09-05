import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { listMeetingSessions } from "@/lib/meeting-assistant/service";
import { loadNotetakerConfig } from "@/lib/meeting-assistant/settings";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") as "upcoming" | "past" | "all" | null;
    const source = url.searchParams.get("source") as "all" | "transovo_video" | "external" | null;
    const [sessions, settings] = await Promise.all([
      listMeetingSessions(auth.workspaceId, filter || "all", source || "all"),
      loadNotetakerConfig(auth.workspaceId),
    ]);
    return NextResponse.json({ data: { sessions, settings } });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
