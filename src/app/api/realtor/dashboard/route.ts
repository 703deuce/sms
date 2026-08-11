import { requireSession, jsonError } from "@/lib/api-auth";
import { loadRealtorDashboard } from "@/lib/realtor/dashboard";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadRealtorDashboard(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
