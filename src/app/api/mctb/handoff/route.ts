import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import {
  ensureMctbHandoffConfig,
  loadMctbHandoffConfig,
  loadMctbNotificationRecipients,
  saveMctbHandoffConfig,
  saveMctbNotificationRecipients,
} from "@/lib/mctb/handoff/config";
import { deliverMctbHandoffNotifications } from "@/lib/mctb/handoff/notifications";
import { recordMctbHandoffEvent } from "@/lib/mctb/handoff/events";
import type { MctbHandoffConfigDto, MctbNotificationRecipientDto } from "@/lib/mctb/handoff/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  await ensureMctbHandoffConfig(workspaceId);
  const config = await loadMctbHandoffConfig(workspaceId);
  const recipients = await loadMctbNotificationRecipients(workspaceId);
  const { isLeadRecoveryAiRepliesEnabled } = await import("@/lib/mctb/lead-recovery/config");
  const aiRepliesEnabled = await isLeadRecoveryAiRepliesEnabled(workspaceId);
  return NextResponse.json({
    data: {
      config,
      recipients,
      launch: {
        aiRepliesEnabled,
      },
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const body = (await req.json()) as {
    config?: Partial<MctbHandoffConfigDto>;
    recipients?: MctbNotificationRecipientDto[];
    action?: "test_notification" | "test_urgent_rules" | "set_launch_ai_replies";
    sampleMessage?: string;
    enabled?: boolean;
  };

  if (body.action === "set_launch_ai_replies") {
    const { applyLaunchAiRepliesSetting } = await import("@/lib/mctb/launch-lead-recovery");
    const result = await applyLaunchAiRepliesSetting(workspaceId, body.enabled === true);
    const config = await loadMctbHandoffConfig(workspaceId);
    const recipients = await loadMctbNotificationRecipients(workspaceId);
    return NextResponse.json({
      data: { config, recipients, launch: { aiRepliesEnabled: result.enabled } },
    });
  }

  if (body.action === "test_urgent_rules") {
    const sample = String(body.sampleMessage || "").trim();
    if (!sample) {
      return NextResponse.json({ error: "sampleMessage is required" }, { status: 400 });
    }
    const config = await loadMctbHandoffConfig(workspaceId);
    const { classifyMctbUrgentReply } = await import("@/lib/mctb/handoff/urgent-reply-classifier");
    const classification = await classifyMctbUrgentReply({
      instructions: config.emergencyCriteria || "",
      latestMessage: sample,
      recentMessages: [],
    });
    if (!classification) {
      return NextResponse.json({
        ok: false,
        error: "classifier_unavailable",
        message: "Urgent classifier could not run (semantic LLM unavailable).",
      });
    }
    return NextResponse.json({
      ok: true,
      urgent: classification.urgent,
      reason: classification.reason,
      summary: classification.summary,
      label: classification.urgent ? "Urgent" : "Normal",
    });
  }

  if (body.action === "test_notification") {
    const idempotencyKey = `mctb-test-notify:${workspaceId}:${Date.now()}`;
    const { event } = await recordMctbHandoffEvent({
      workspaceId,
      eventType: "lead_captured",
      idempotencyKey,
      metadata: { test: true },
    });
    const result = await deliverMctbHandoffNotifications({
      workspaceId,
      handoffEventId: event.id,
      eventType: "lead_captured",
      urgent: false,
      facts: {
        callerName: "Test Caller",
        callerPhone: "+15555550100",
        serviceReason: "Test notification — no action required",
        locationZip: "Sample City",
        callbackTime: "Anytime",
        customerMessages: ["This is a test lead summary preview."],
      },
      derived: { requestedAction: "test" },
    });
    return NextResponse.json({ ok: true, result });
  }

  let config = await loadMctbHandoffConfig(workspaceId);
  if (body.config) {
    const { isLeadRecoveryAiRepliesEnabled } = await import("@/lib/mctb/lead-recovery/config");
    const patch = { ...body.config };
    if (await isLeadRecoveryAiRepliesEnabled(workspaceId)) {
      patch.responseMode = "ai_conversation";
    }
    config = await saveMctbHandoffConfig(workspaceId, patch);
  }
  let recipients = await loadMctbNotificationRecipients(workspaceId);
  if (body.recipients) {
    recipients = await saveMctbNotificationRecipients(workspaceId, body.recipients);
  }

  return NextResponse.json({ data: { config, recipients } });
}
