import "server-only";

import { getPrisma } from "@/lib/db";
import { readPersonalCallSettings } from "@/lib/numbers/personal-call-settings";
import { transitionNumberService, applyPersonalCallSettingsToRow } from "@/lib/numbers/state-service";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import {
  ensureCallForwardingWorkspaceSettings,
  loadCallForwardingWorkspaceSettings,
  updateCallForwardingWorkspaceSettings,
} from "./workspace-settings";
import { listCallForwardingAuthorizedCallers } from "./authorized-callers";
import { hasActiveCallForwardingOnNumber } from "./service";

export async function loadCallForwardingSetup(workspaceId: string) {
  await ensureCallForwardingWorkspaceSettings(workspaceId);
  const ws = await loadCallForwardingWorkspaceSettings(workspaceId);
  const entitled = await hasWorkspaceProductFeature(workspaceId, "call_forwarding");
  const prisma = getPrisma();

  const phoneNumbers = await prisma.phoneNumber.findMany({
    where: { workspaceId, releasedAt: null, status: { not: "Released" } },
    select: { id: true, e164: true, friendlyName: true, settingsJson: true },
    orderBy: { purchasedAt: "desc" },
  });

  const assigned = ws?.assignedPhoneNumberId
    ? phoneNumbers.find((p) => p.id === ws.assignedPhoneNumberId)
    : null;

  const callSettings = assigned ? readPersonalCallSettings(assigned) : null;
  const active =
    assigned && entitled
      ? await hasActiveCallForwardingOnNumber(workspaceId, assigned.id)
      : false;

  let sub: { minutesUsedThisPeriod?: number; includedMinutes?: number | null } | null = null;
  try {
    sub = await prisma.platformProductSubscription?.findFirst?.({
      where: {
        workspaceId,
        productFamily: "call_forwarding",
        status: { in: ["active", "trialing", "past_due"] },
      },
    });
  } catch {
    sub = null;
  }

  const usageMinutes = sub?.minutesUsedThisPeriod ?? 0;
  const includedMinutes = sub?.includedMinutes ?? 2000;

  const recentInbound = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      direction: "inbound",
      to: assigned?.e164 ?? undefined,
    },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      from: true,
      to: true,
      status: true,
      startedAt: true,
      durationSeconds: true,
      notes: true,
    },
  });

  const recentOutbound =
    (await prisma.callForwardingOutboundCall?.findMany?.({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
    })) ?? [];

  const authorizedCallers = await listCallForwardingAuthorizedCallers(workspaceId);

  return {
    entitled,
    active,
    settings: ws,
    assignedNumber: assigned,
    callSettings,
    phoneNumbers,
    usage: { minutesUsed: usageMinutes, includedMinutes },
    recentInbound,
    recentOutbound,
    authorizedCallers,
    readiness: {
      entitled,
      hasNumber: Boolean(assigned),
      hasDestination: Boolean(callSettings?.forwardTargets?.length),
      active,
    },
  };
}

export async function saveCallForwardingSetup(
  workspaceId: string,
  body: {
    phoneNumberId?: string;
    destination?: string;
    callScreeningEnabled?: boolean;
    forwardRingSeconds?: number;
    forwardUnansweredAction?: string;
    forwardBusyAction?: string;
    forwardFailedAction?: string;
    forwardScheduleMode?: "always" | "custom";
    forwardSchedule?: Record<string, unknown> | null;
    smsOutboundEnabled?: boolean;
    controlPhoneNumberId?: string | null;
  },
) {
  if (!(await hasWorkspaceProductFeature(workspaceId, "call_forwarding"))) {
    throw new Error("Call Forwarding subscription required");
  }

  await ensureCallForwardingWorkspaceSettings(workspaceId);
  const prisma = getPrisma();

  if (body.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: body.phoneNumberId, workspaceId },
    });
    if (!pn) throw new Error("Number not found");

    await transitionNumberService(workspaceId, pn.id, "set_call_forwarding_owner", {
      destination: body.destination,
    });

    const existingWs = await loadCallForwardingWorkspaceSettings(workspaceId);
    await updateCallForwardingWorkspaceSettings(workspaceId, {
      assignedPhoneNumberId: pn.id,
      businessNumberE164: pn.e164,
      controlPhoneNumberId: existingWs?.controlPhoneNumberId ?? pn.id,
      controlNumberE164: existingWs?.controlNumberE164 ?? pn.e164,
      setupCompletedAt: new Date(),
    });
  }

  const ws = await loadCallForwardingWorkspaceSettings(workspaceId);
  const numberId = body.phoneNumberId ?? ws?.assignedPhoneNumberId;
  if (!numberId) throw new Error("Assign a business number first");

  if (
    body.destination ||
    body.callScreeningEnabled !== undefined ||
    body.forwardRingSeconds !== undefined ||
    body.forwardUnansweredAction !== undefined ||
    body.forwardBusyAction !== undefined ||
    body.forwardFailedAction !== undefined ||
    body.forwardScheduleMode !== undefined ||
    body.forwardSchedule !== undefined
  ) {
    const row = await prisma.phoneNumber.findFirst({ where: { id: numberId, workspaceId } });
    if (!row) throw new Error("Number not found");

    const applied = applyPersonalCallSettingsToRow(row, {
      forwardDestination: body.destination,
      forwardingEnabled: body.destination ? true : undefined,
      incomingCallHandling: body.destination ? "forward" : undefined,
      callScreeningEnabled: body.callScreeningEnabled,
      forwardRingSeconds: body.forwardRingSeconds,
      forwardUnansweredAction: body.forwardUnansweredAction as
        | "transovo_voicemail"
        | "voicemail"
        | undefined,
      forwardBusyAction: body.forwardBusyAction as
        | "voicemail"
        | "another_number"
        | "announcement"
        | "end"
        | undefined,
      forwardFailedAction: body.forwardFailedAction as
        | "voicemail"
        | "another_number"
        | "announcement"
        | "end"
        | undefined,
      forwardScheduleMode: body.forwardScheduleMode,
      forwardSchedule: body.forwardSchedule,
      voicemailEnabled: body.destination ? true : undefined,
    });

    await prisma.phoneNumber.update({
      where: { id: numberId },
      data: {
        voiceForwardTo: applied.voiceForwardTo,
        settingsJson: applied.settingsJson,
      },
    });

    await transitionNumberService(workspaceId, numberId, "set_call_forwarding_owner");
  }

  if (body.smsOutboundEnabled !== undefined || body.controlPhoneNumberId !== undefined) {
    const patch: Record<string, unknown> = {};
    if (body.smsOutboundEnabled !== undefined) patch.smsOutboundEnabled = body.smsOutboundEnabled;
    if (body.controlPhoneNumberId !== undefined) {
      patch.controlPhoneNumberId = body.controlPhoneNumberId;
      if (body.controlPhoneNumberId) {
        const control = await prisma.phoneNumber.findFirst({
          where: { id: body.controlPhoneNumberId, workspaceId },
          select: { e164: true },
        });
        patch.controlNumberE164 = control?.e164 ?? null;
      } else {
        patch.controlNumberE164 = null;
      }
    }
    await updateCallForwardingWorkspaceSettings(workspaceId, patch);
  }

  return loadCallForwardingSetup(workspaceId);
}
