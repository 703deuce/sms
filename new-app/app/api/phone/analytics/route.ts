import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPhoneAnalytics } from "@/lib/server/phone/analytics";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const range = (url.searchParams.get("range") || "7d") as "7d" | "30d" | "90d";
    const data = await getPhoneAnalytics(workspaceId, range);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
