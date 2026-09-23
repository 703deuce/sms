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
  const { loadLeadRecoveryConfig } = await import("@/lib/mctb/lead-recovery/config");
  const lr = await loadLeadRecoveryConfig(workspaceId);
  return NextResponse.json({
    data: {
      config,
      recipients,
      launch: {
        aiRepliesEnabled: lr.enabled && lr.policyHealth !== "DISABLED",
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
    action?: "test_notification" | "set_launch_ai_replies";
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
    const { loadLeadRecoveryConfig } = await import("@/lib/mctb/lead-recovery/config");
    const lr = await loadLeadRecoveryConfig(workspaceId);
    const patch = { ...body.config };
    if (lr.enabled && lr.policyHealth !== "DISABLED") {
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
