import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getGoogleIntegrationStartUrl } from "@/lib/integrations/oauth";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const provider = new URL(request.url).searchParams.get("provider") || "google_contacts";
    const url = getGoogleIntegrationStartUrl(auth.workspaceId, provider);
    return NextResponse.redirect(url);
  } catch (err) {
    return jsonError(err, 400);
  }
}
