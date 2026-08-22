import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getTryItStatus } from "@/lib/mctb/try-it/status";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const status = await getTryItStatus(auth.workspaceId);
    return NextResponse.json({ data: status });
  } catch (err) {
    return jsonError(err, 500);
  }
}
