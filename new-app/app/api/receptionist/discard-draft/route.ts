import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { discardReceptionistDraft } from "@/lib/server/receptionist/agent-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const state = await discardReceptionistDraft(workspaceId);
    return NextResponse.json({ data: state });
  } catch (err) {
    return jsonError(err, 500);
  }
}
