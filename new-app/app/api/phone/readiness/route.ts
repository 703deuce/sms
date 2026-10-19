import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPhoneReadiness } from "@/lib/server/phone/readiness";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getPhoneReadiness(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
