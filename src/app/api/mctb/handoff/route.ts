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
  const { canSendMctbUrgentBusinessTeamSms } = await import(
    "@/lib/mctb/handoff/urgent-business-sms-entitlement",
  );
  const aiRepliesEnabled = await isLeadRecoveryAiRepliesEnabled(workspaceId);
  const urgentBusinessSmsEntitled = await canSendMctbUrgentBusinessTeamSms(workspaceId);
  return NextResponse.json({
    data: {
      config,
      recipients,
      launch: {
        aiRepliesEnabled,
        urgentBusinessSmsEntitled,
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
    if (body.enabled === true) {
      const { assertMctbCapability } = await import("@/lib/mctb/capabilities");
      const gate = await assertMctbCapability(workspaceId, "aiRecoveryEntitled");
      if (!gate.ok) {
        return NextResponse.json(
          { error: "AI Recovery requires an AI Recovery plan." },
          { status: 403 },
        );
      }
    }
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
    const { resolveMctbCapabilities } = await import("@/lib/mctb/capabilities");
    const caps = await resolveMctbCapabilities(workspaceId);
    if (
      body.config.emergencyDetectionEnabled === true &&
      !caps.urgentClassification
    ) {
      return NextResponse.json(
        { error: "Urgent Reply Alerts require an AI Recovery plan." },
        { status: 403 },
      );
    }
    const { isLeadRecoveryAiRepliesEnabled } = await import("@/lib/mctb/lead-recovery/config");
    const patch = { ...body.config };
    if (await isLeadRecoveryAiRepliesEnabled(workspaceId)) {
      patch.responseMode = "ai_conversation";
    }
    config = await saveMctbHandoffConfig(workspaceId, patch);
  }
  let recipients = await loadMctbNotificationRecipients(workspaceId);
  if (body.recipients) {
    try {
      recipients = await saveMctbNotificationRecipients(workspaceId, body.recipients);
    } catch (err) {
      const { MctbNotificationRecipientValidationError } = await import(
        "@/lib/mctb/handoff/recipient-validation",
      );
      if (err instanceof MctbNotificationRecipientValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  return NextResponse.json({ data: { config, recipients } });
}
