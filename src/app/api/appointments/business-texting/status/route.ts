import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getBusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-status";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const status = await getBusinessTextingCampaignStatus(auth.workspaceId);
    return NextResponse.json({ data: status });
  } catch (err) {
    return jsonError(err, 500);
  }
}
