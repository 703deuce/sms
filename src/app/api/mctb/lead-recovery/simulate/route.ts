import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { mergeLeadRecoveryDraftConfig } from "@/lib/mctb/lead-recovery/merge-draft-config";
import { simulateLeadRecoveryTurn } from "@/lib/mctb/lead-recovery/simulation";
import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { assertMctbCapability } = await import("@/lib/mctb/capabilities");
    const gate = await assertMctbCapability(auth.workspaceId, "aiRecoveryEntitled");
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message || "AI Recovery is not enabled." }, { status: 403 });
    }
    const body = (await request.json()) as {
      message?: string;
      context?: {
        customerType?: "NEW" | "EXISTING" | "UNKNOWN";
        businessStatus?: "OPEN" | "CLOSED" | "AUTO";
      };
      draftConfig?: Partial<LeadRecoveryWorkspaceConfig>;
      collectedData?: Record<string, string>;
    };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const saved = await loadLeadRecoveryConfig(auth.workspaceId);
    const config = mergeLeadRecoveryDraftConfig(saved, body.draftConfig);
    const simulation = await simulateLeadRecoveryTurn({
      workspaceId: auth.workspaceId,
      config,
      message,
      collectedData: body.collectedData,
      context: body.context,
    });
    return NextResponse.json({ data: { simulation } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
