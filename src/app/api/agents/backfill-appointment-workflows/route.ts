import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { backfillAppointmentAgentWorkflows } from "@/lib/agents/backfill-appointment-workflows";

/** POST — reconcile existing appointment agents onto primary workflows (draft only). */
export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const result = await backfillAppointmentAgentWorkflows(auth.workspaceId);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
