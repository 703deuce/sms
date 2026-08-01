/**
 * Softphone inbound orchestration: forwarding rules → IVR/queue → ring → overflow.
 * Fully wired so a purchased Telnyx number activates the path without more code.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";
import { resolveForwarding } from "./forwarding-service";
import { handleInboundHumanCall, isTelnyxPhoneConfigured } from "./human-call-service";
import { listPresence } from "./presence-service";

export async function processSoftphoneInbound(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
}) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);
  const to = input.toE164;
  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: to },
  });

  // Blocked / suppressed callers — hang up immediately.
  const blocked = await prisma.suppression.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [{ phone: from }, { suppressionKey: `p:${from}` }],
    },
  });
  if (blocked && input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    return { blocked: true as const, from };
  }

  const settings = await getMessagingRuntimeSettings(input.workspaceId).catch(() => null);
  const withinHours = settings
    ? isWithinBusinessHours(settings, new Date())
    : true;

  // Assigned user for this number (if any)
  let assignedUserId: string | null = null;
  if (pn) {
    const assignment = await prisma.phoneNumberAssignment.findFirst({
      where: { phoneNumberId: pn.id },
    });
    assignedUserId = assignment?.userId || null;
  }

  // DND / offline presence → treat as offline for forwarding
  let offline = false;
  let busy = false;
  if (assignedUserId) {
    const presence = await listPresence(input.workspaceId);
    const mine = presence.find((p: { userId: string }) => p.userId === assignedUserId);
    if (mine?.status === "dnd" || mine?.status === "offline") offline = true;
    if (mine?.status === "busy" || mine?.status === "on_call") busy = true;

    const userSettings = await prisma.softphoneUserSettings.findUnique({
      where: {
        workspaceId_userId: { workspaceId: input.workspaceId, userId: assignedUserId },
      },
    });
    if (userSettings?.dndEnabled) offline = true;
    // Cellular forward shortcut
    if (userSettings?.forwardToCellular && (offline || userSettings.dndEnabled)) {
      return forwardExternal(input, userSettings.forwardToCellular, "cellular_forward");
    }
  }

  const rule = await resolveForwarding({
    workspaceId: input.workspaceId,
    phoneNumberId: pn?.id,
    userId: assignedUserId,
    busy,
    unanswered: false,
    offline,
    afterHours: !withinHours,
  });

  if (rule?.active !== false && rule) {
    if (rule.targetType === "external" && rule.targetValue) {
      return forwardExternal(input, rule.targetValue, `forward:${rule.mode}`);
    }
    if (rule.targetType === "voicemail") {
      const human = await handleInboundHumanCall({
        workspaceId: input.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: input.telnyxCallControlId,
        routingNote: `forward_voicemail:${rule.mode}`,
      });
      if (input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
        const { leaveVoicemailOnCall } = await import("./voicemail-service");
        await leaveVoicemailOnCall({
          workspaceId: input.workspaceId,
          humanCallId: human.callId,
          telnyxCallControlId: input.telnyxCallControlId,
          userId: assignedUserId,
        });
      }
      return { ...human, forwarded: true, mode: rule.mode };
    }
    if (rule.targetType === "ai_agent" && rule.targetValue) {
      return routeToAiAgent(input, rule.targetValue);
    }
    if (rule.targetType === "queue" && rule.targetValue) {
      return handleInboundHumanCall({
        workspaceId: input.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: input.telnyxCallControlId,
        queueId: rule.targetValue,
        routingNote: `forward_queue:${rule.mode}`,
      });
    }
    if (rule.targetType === "user" && rule.targetValue) {
      // Soft-ring that user via presence + human call record
      return handleInboundHumanCall({
        workspaceId: input.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: input.telnyxCallControlId,
        routingNote: `forward_user:${rule.targetValue}`,
      });
    }
    if (rule.mode === "simultaneous" || rule.mode === "sequential") {
      // Multi-target ring via queue members if configured in configJson
      const cfg = (rule.configJson || {}) as { userIds?: string[]; targets?: string[] };
      if (cfg.targets?.length && input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
        await ringExternalTargets(input, cfg.targets, rule.mode === "sequential");
      }
    }
  }

  // Call screening: announce caller and gather accept/decline before ringing agents.
  if (assignedUserId && input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    const userSettings = await prisma.softphoneUserSettings.findUnique({
      where: {
        workspaceId_userId: { workspaceId: input.workspaceId, userId: assignedUserId },
      },
    });
    const perms = (userSettings?.permissionsJson || {}) as { screening?: boolean };
    if (perms.screening) {
      await screenInboundCall({
        workspaceId: input.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: input.telnyxCallControlId,
        userId: assignedUserId,
      });
      return { screened: true as const, from };
    }
  }

  // Default: normal human inbound (+ queue resolution inside)
  return handleInboundHumanCall({
    workspaceId: input.workspaceId,
    fromE164: from,
    toE164: to,
    telnyxCallControlId: input.telnyxCallControlId,
    routingNote: withinHours ? "business_hours" : "after_hours",
  });
}

async function screenInboundCall(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId: string;
  userId: string;
}) {
  const human = await handleInboundHumanCall({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    routingNote: `screening:${input.userId}`,
  });

  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/gather_using_speak`, {
    method: "POST",
    body: {
      payload: `Call from ${input.fromE164}. Press 1 to accept, press 2 to send to voicemail.`,
      voice: "female",
      language: "en-US",
      valid_digits: "12",
      maximum_digits: 1,
      minimum_digits: 1,
      timeout_millis: 15000,
      client_state: Buffer.from(
        JSON.stringify({
          workspaceId: input.workspaceId,
          humanCallId: human.callId,
          kind: "call_screening",
          userId: input.userId,
        }),
      ).toString("base64"),
    },
  }).catch(() => undefined);

  return human;
}

async function forwardExternal(
  input: { workspaceId: string; fromE164: string; toE164: string; telnyxCallControlId?: string },
  destination: string,
  note: string,
) {
  const human = await handleInboundHumanCall({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    routingNote: note,
  });
  if (input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/transfer`, {
      method: "POST",
      body: { to: normalizeE164(destination) },
    }).catch(() => undefined);
    await getPrisma().humanCall.update({
      where: { id: human.callId },
      data: { status: "transferred", disposition: note },
    });
  }
  return { ...human, forwarded: true };
}

async function routeToAiAgent(
  input: { workspaceId: string; fromE164: string; toE164: string; telnyxCallControlId?: string },
  agentId: string,
) {
  const { handleInboundCallEvent } = await import("@/lib/voice/inbound");
  // Force AI for this agent by creating the voice call path
  return handleInboundCallEvent({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    payload: { forcedAgentId: agentId, source: "softphone_forward_ai" },
  });
}

async function ringExternalTargets(
  input: { workspaceId: string; fromE164: string; toE164: string; telnyxCallControlId?: string },
  targets: string[],
  sequential: boolean,
) {
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
  if (!connectionId || !input.telnyxCallControlId) return;
  const list = sequential ? targets.slice(0, 1) : targets;
  for (const to of list) {
    await telnyxRequest("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        from: input.toE164,
        to: normalizeE164(to),
        client_state: Buffer.from(
          JSON.stringify({
            workspaceId: input.workspaceId,
            kind: "simultaneous_ring",
            parentCallControlId: input.telnyxCallControlId,
          }),
        ).toString("base64"),
      },
    }).catch(() => undefined);
  }
}
