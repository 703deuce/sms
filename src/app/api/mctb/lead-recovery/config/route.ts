import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadLeadRecoveryConfig,
  saveLeadRecoveryConfig,
} from "@/lib/mctb/lead-recovery/config";
import { simulateLeadRecoveryPolicy } from "@/lib/mctb/lead-recovery/policy-engine";
import { deterministicLeadRecoveryIntent } from "@/lib/mctb/lead-recovery/intent-agent";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const config = await loadLeadRecoveryConfig(auth.workspaceId);
    if (url.searchParams.get("simulate") === "1") {
      const message = url.searchParams.get("message") || "";
      const intent = deterministicLeadRecoveryIntent({ message });
      const plan = simulateLeadRecoveryPolicy({ config, intent });
      return NextResponse.json({ data: { config, intent, plan } });
    }
    return NextResponse.json({ data: { config } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const config = await saveLeadRecoveryConfig(auth.workspaceId, {
      enabled: body.enabled === true,
      globalMode:
        body.globalMode === "CAPTURE_ONLY" || body.globalMode === "INFORMATION_ONLY"
          ? body.globalMode
          : body.globalMode === "STANDARD"
            ? "STANDARD"
            : undefined,
      enabledIntents: Array.isArray(body.enabledIntents) ? body.enabledIntents : undefined,
      intentPolicies:
        body.intentPolicies && typeof body.intentPolicies === "object"
          ? (body.intentPolicies as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["intentPolicies"])
          : undefined,
      fallbackPolicy:
        body.fallbackPolicy && typeof body.fallbackPolicy === "object"
          ? (body.fallbackPolicy as import("@/lib/mctb/lead-recovery/types").IntentPolicyShape)
          : undefined,
      collectCapabilities: Array.isArray(body.collectCapabilities) ? body.collectCapabilities : undefined,
      answerCapabilities: Array.isArray(body.answerCapabilities) ? body.answerCapabilities : undefined,
      actionCapabilities: Array.isArray(body.actionCapabilities) ? body.actionCapabilities : undefined,
      handoffTriggers:
        body.handoffTriggers && typeof body.handoffTriggers === "object"
          ? (body.handoffTriggers as import("@/lib/mctb/lead-recovery/types").LeadRecoveryWorkspaceConfig["handoffTriggers"])
          : undefined,
      bookingLinkId:
        typeof body.bookingLinkId === "string"
          ? body.bookingLinkId
          : body.bookingLinkId === null
            ? null
            : undefined,
      version: typeof body.version === "number" ? body.version : undefined,
    });
    return NextResponse.json({ data: { config } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
