import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listAudioAssets } from "@/lib/smart-routing/media-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const assets = await listAudioAssets(auth.workspaceId);
    return NextResponse.json({ data: assets });
  } catch (err) {
    return jsonError(err, 500);
  }
}
