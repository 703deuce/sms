import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { buildIntegrationAnalytics } from "@/lib/integrations/framework/analytics";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await buildIntegrationAnalytics(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
