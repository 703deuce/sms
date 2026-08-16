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
import { resolveNumberInboundRoute } from "@/lib/numbers/inbound-number-routing";
import {
  PERSONAL_UNAVAILABLE_MESSAGE,
  readPersonalCallSettings,
} from "@/lib/numbers/personal-call-settings";

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

  if (pn && input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    const blocked = await prisma.suppression.findFirst({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { phone: from },
          { suppressionKey: `p:${from}` },
          { suppressionKey: `${input.workspaceId}:p:${from}` },
        ],
      },
    });
    if (blocked) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
      return { blocked: true as const, from };
    }

    const numberRoute = resolveNumberInboundRoute(pn);
    if (numberRoute.kind === "vault_silent") {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
      return { parked: true as const, silent: true, from };
    }
    if (numberRoute.kind === "vault_message") {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: {
          payload: numberRoute.message,
          voice: "female",
          language: "en-US",
        },
      }).catch(() => undefined);
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
      return { parked: true as const, from };
    }
    if (numberRoute.kind === "vault_voicemail") {
      const assignment = await prisma.phoneNumberAssignment.findFirst({
        where: { phoneNumberId: pn.id },
      });
      const human = await handleInboundHumanCall({
        workspaceId: input.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: input.telnyxCallControlId,
        routingNote: "vault_voicemail",
        autoAnswer: true,
      });
      const { leaveVoicemailOnCall } = await import("./voicemail-service");
      await leaveVoicemailOnCall({
        workspaceId: input.workspaceId,
        humanCallId: human.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        userId: assignment?.userId ?? null,
      });
      return { ...human, voicemail: true, vault: true };
    }
    if (numberRoute.kind === "announcement") {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: {
          payload: numberRoute.message,
          voice: "female",
          language: "en-US",
        },
      }).catch(() => undefined);
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
      return { announcement: true as const, from };
    }
    if (numberRoute.kind === "forward") {
      return forwardPersonalWithRing(input, pn, numberRoute);
    }
    if (numberRoute.kind === "voicemail") {
      const assignment = await prisma.phoneNumberAssignment.findFirst({
        where: { phoneNumberId: pn.id },
      });
      const human = await handleInboundHumanCall({
        workspaceId: input.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: input.telnyxCallControlId,
        routingNote: "number_voicemail",
        autoAnswer: true,
      });
      const { leaveVoicemailOnCall } = await import("./voicemail-service");
      await leaveVoicemailOnCall({
        workspaceId: input.workspaceId,
        humanCallId: human.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        userId: assignment?.userId ?? null,
      });
      return { ...human, voicemail: true };
    }
    if (numberRoute.kind === "unavailable") {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: {
          payload: PERSONAL_UNAVAILABLE_MESSAGE,
          voice: "female",
          language: "en-US",
        },
      }).catch(() => undefined);
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
      return { unavailable: true as const, from };
    }
  }

  // Blocked / suppressed callers — hang up immediately (non-number routes).
  const blocked = await prisma.suppression.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [
        { phone: from },
        { suppressionKey: `p:${from}` },
        { suppressionKey: `${input.workspaceId}:p:${from}` },
      ],
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
        autoAnswer: true,
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
    if (rule.targetType === "device" && rule.targetValue) {
      // Device key → owning user softphone notify (+ cellular if set).
      const device = await prisma.softphoneDevice.findFirst({
        where: {
          workspaceId: input.workspaceId,
          deviceKey: rule.targetValue,
          active: true,
        },
      });
      if (device) {
        return handleInboundHumanCall({
          workspaceId: input.workspaceId,
          fromE164: from,
          toE164: to,
          telnyxCallControlId: input.telnyxCallControlId,
          routingNote: `forward_user:${device.userId}`,
        });
      }
    }
    if (rule.mode === "simultaneous" || rule.mode === "sequential") {
      const cfg = (rule.configJson || {}) as { userIds?: string[]; targets?: string[] };
      // Targets from configJson, or comma-separated targetValue, or single external target.
      const targets = [
        ...(cfg.targets || []),
        ...(rule.targetValue
          ? String(rule.targetValue)
              .split(/[,\n]/)
              .map((s: string) => s.trim())
              .filter((s: string) => s.startsWith("+"))
          : []),
      ];
      // Resolve userIds → cellular numbers for multi-ring.
      for (const uid of cfg.userIds || []) {
        const us = await prisma.softphoneUserSettings.findUnique({
          where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: uid } },
        });
        if (us?.forwardToCellular) targets.push(us.forwardToCellular);
      }
      const uniqueTargets = [...new Set(targets.filter(Boolean))];
      if (uniqueTargets.length && input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
        const human = await handleInboundHumanCall({
          workspaceId: input.workspaceId,
          fromE164: from,
          toE164: to,
          telnyxCallControlId: input.telnyxCallControlId,
          routingNote: `forward_${rule.mode}`,
          autoAnswer: true,
        });
        await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hold`, {
          method: "POST",
          body: {},
        }).catch(() => undefined);
        await ringExternalTargets(
          input,
          uniqueTargets,
          rule.mode === "sequential",
          human.callId,
        );
        return { ...human, forwarded: true, mode: rule.mode };
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
  const prisma = getPrisma();
  // Keep customer on hold music while we screen the agent (never ask the caller to accept).
  const human = await handleInboundHumanCall({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    routingNote: `screening:${input.userId}`,
  });

  const userSettings = await prisma.softphoneUserSettings.findUnique({
    where: {
      workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId },
    },
  });
  const agentPhone = userSettings?.forwardToCellular;
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();

  // Always answer + hold the caller while screening (softphone Accept/Decline or cell DTMF).
  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
    method: "POST",
    body: {
      payload: "Please hold while we connect you.",
      voice: "female",
      language: "en-US",
    },
  }).catch(() => undefined);
  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  let screeningLegId: string | null = null;
  if (agentPhone && connectionId) {
    const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        from: input.toE164,
        to: normalizeE164(agentPhone),
        client_state: Buffer.from(
          JSON.stringify({
            workspaceId: input.workspaceId,
            humanCallId: human.callId,
            kind: "call_screening",
            userId: input.userId,
            parentCallControlId: input.telnyxCallControlId,
          }),
        ).toString("base64"),
      },
    }).catch(() => null);
    screeningLegId = dialed?.data?.call_control_id || null;
  }

  await prisma.humanCall.update({
    where: { id: human.callId },
    data: {
      status: "ringing",
      onHold: true,
      agentUserId: input.userId,
      notes: `screening:${input.userId}${agentPhone ? "" : " softphone_accept"}${
        screeningLegId ? ` [ring_legs:${screeningLegId}]` : ""
      }`,
    },
  });

  // Softphone-only screening timeout → voicemail if nobody Accepts.
  try {
    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    await enqueueJob({
      jobType: "phone_softphone_ring_timeout",
      queueName: "voice-calls",
      workspaceId: input.workspaceId,
      payload: {
        workspaceId: input.workspaceId,
        humanCallId: human.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        toE164: input.toE164,
      },
      idempotencyKey: `screening-timeout-${human.callId}`,
      runAfter: new Date(Date.now() + 30_000),
    });
  } catch {
    // ignore
  }

  return human;
}

async function forwardPersonalWithRing(
  input: {
    workspaceId: string;
    fromE164: string;
    toE164: string;
    telnyxCallControlId?: string;
  },
  pn: { id: string; settingsJson: unknown; voiceForwardTo: string | null },
  route: {
    destinations: string[];
    mode: "single" | "sequential" | "simultaneous";
    ringSeconds: number;
    unansweredAction: "voicemail" | "end";
    callScreening: boolean;
    callerIdDisplay: "original" | "transovo_number";
  },
) {
  const human = await handleInboundHumanCall({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    routingNote: `number_forward:${route.destinations.join(",")}`,
  });

  if (!input.telnyxCallControlId || !isTelnyxPhoneConfigured()) {
    return { ...human, forwarded: true };
  }

  const controlId = input.telnyxCallControlId;
  await telnyxRequest(`/calls/${controlId}/actions/answer`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
  await telnyxRequest(`/calls/${controlId}/actions/hold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  const sequential = route.mode === "sequential";
  const simultaneous = route.mode === "simultaneous";
  const targets = route.destinations;

  if (route.callScreening && targets[0]) {
    // Screening rings first destination with accept prompt (softphone path).
    const { dialHuntTarget } = await import("./hunt-service");
    const legId = await dialHuntTarget({
      workspaceId: input.workspaceId,
      humanCallId: human.callId,
      parentCallControlId: controlId,
      fromE164: input.toE164,
      target: targets[0],
      sequential: false,
    });
    const callSettings = readPersonalCallSettings(pn);
    const tag = `[personal_forward:screening] [forward_unanswered:${route.unansweredAction}] [ring_seconds:${route.ringSeconds}] [voicemail_enabled:${callSettings.voicemailEnabled ? "1" : "0"}]`;
    const call = await getPrisma().humanCall.findUnique({ where: { id: human.callId } });
    await getPrisma()
      .humanCall.update({
        where: { id: human.callId },
        data: {
          onHold: true,
          notes: `${call?.notes || ""}\n${tag}${legId ? ` [ring_legs:${legId}]` : ""}`.trim(),
        },
      })
      .catch(() => undefined);
  } else if (simultaneous && targets.length > 1) {
    await ringExternalTargets(
      input,
      targets,
      false,
      human.callId,
    );
  } else if (sequential && targets.length > 1) {
    await ringExternalTargets(input, targets, true, human.callId);
  } else {
    const { dialHuntTarget } = await import("./hunt-service");
    const legId = await dialHuntTarget({
      workspaceId: input.workspaceId,
      humanCallId: human.callId,
      parentCallControlId: controlId,
      fromE164: input.toE164,
      target: targets[0],
      sequential: false,
    });
    const callSettings = readPersonalCallSettings(pn);
    const tag = `[personal_forward:1] [forward_unanswered:${route.unansweredAction}] [ring_seconds:${route.ringSeconds}] [voicemail_enabled:${callSettings.voicemailEnabled ? "1" : "0"}] [caller_id:${route.callerIdDisplay}]`;
    const call = await getPrisma().humanCall.findUnique({ where: { id: human.callId } });
    await getPrisma()
      .humanCall.update({
        where: { id: human.callId },
        data: {
          onHold: true,
          notes: `${call?.notes || ""}\n${tag}${legId ? ` [ring_legs:${legId}]` : ""}`.trim(),
        },
      })
      .catch(() => undefined);
  }

  const callSettings = readPersonalCallSettings(pn);
  try {
    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    await enqueueJob({
      jobType:
        sequential && targets.length > 1
          ? "phone_hunt_advance"
          : "phone_softphone_ring_timeout",
      queueName: "voice-calls",
      workspaceId: input.workspaceId,
      payload: {
        workspaceId: input.workspaceId,
        humanCallId: human.callId,
        telnyxCallControlId: controlId,
        toE164: input.toE164,
        personalForward: true,
        forwardUnansweredAction: route.unansweredAction,
        voicemailEnabled: callSettings.voicemailEnabled,
      },
      idempotencyKey:
        sequential && targets.length > 1
          ? `hunt-advance-${human.callId}-0`
          : `personal-forward-timeout-${human.callId}`,
      runAfter: new Date(Date.now() + route.ringSeconds * 1000),
    });
  } catch {
    // ignore
  }

  return { ...human, forwarded: true, ringing: true };
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
  humanCallId?: string,
) {
  if (!input.telnyxCallControlId || !humanCallId) return;
  const { dialHuntTarget } = await import("./hunt-service");
  const list = sequential ? targets.slice(0, 1) : targets;
  const ringLegIds: string[] = [];
  for (const to of list) {
    const legId = await dialHuntTarget({
      workspaceId: input.workspaceId,
      humanCallId,
      parentCallControlId: input.telnyxCallControlId,
      fromE164: input.toE164,
      target: to,
      sequential,
    });
    if (legId) ringLegIds.push(legId);
  }
  const huntNote = `[hunt_targets:${targets.join(",")}] [hunt_index:0] [hunt_mode:${sequential ? "sequential" : "simultaneous"}]`;
  const call = await getPrisma().humanCall.findUnique({ where: { id: humanCallId } });
  if (call) {
    await getPrisma()
      .humanCall.update({
        where: { id: humanCallId },
        data: {
          onHold: true,
          notes: `${call.notes || ""}\n${huntNote}${ringLegIds.length ? ` [ring_legs:${ringLegIds.join(",")}]` : ""}`.trim(),
        },
      })
      .catch(() => undefined);
  }

  // Sequential: advance to next target if this one does not answer.
  // Simultaneous: unanswered overflow after ring window.
  try {
    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    await enqueueJob({
      jobType: sequential ? "phone_hunt_advance" : "phone_softphone_ring_timeout",
      queueName: "voice-calls",
      workspaceId: input.workspaceId,
      payload: {
        workspaceId: input.workspaceId,
        humanCallId,
        telnyxCallControlId: input.telnyxCallControlId,
        toE164: input.toE164,
      },
      idempotencyKey: sequential
        ? `hunt-advance-${humanCallId}-0`
        : `hunt-sim-timeout-${humanCallId}`,
      runAfter: new Date(Date.now() + 25_000),
    });
  } catch {
    // ignore
  }
}
