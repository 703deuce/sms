import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { runListCleanup } from "@/lib/contacts/cleanup-list";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const result = await runListCleanup(auth.workspaceId);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
