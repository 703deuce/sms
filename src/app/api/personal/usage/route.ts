import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadPersonalUsage } from "@/lib/workspace/personal-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const usage = await loadPersonalUsage(auth.workspaceId);
    return NextResponse.json({ data: usage });
  } catch (err) {
    return jsonError(err, 500);
  }
}
