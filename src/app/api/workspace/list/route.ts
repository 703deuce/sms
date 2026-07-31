import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadWorkspacesForUser } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadWorkspacesForUser(auth.session.userId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
