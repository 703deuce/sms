/**
 * Queue ring runtime — rings members per strategy, handles overflow.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "./human-call-service";
import { getPresenceMap } from "./presence-service";

export async function ringQueueMembers(input: {
  workspaceId: string;
  queueId: string;
  humanCallId: string;
  telnyxCallControlId: string;
}) {
  const prisma = getPrisma();
  const queue = await prisma.callQueue.findFirst({
    where: { id: input.queueId, workspaceId: input.workspaceId, active: true },
  });
  if (!queue) return { rang: [], overflow: true as const, reason: "queue_missing" };

  const presence = await getPresenceMap(input.workspaceId);
  const available = (queue.memberUserIds as string[]).filter((uid: string) => {
    const p = presence.get(uid);
    if (!p) return true;
    if (p.status === "dnd" || p.status === "offline" || p.status === "on_call") return false;
    return p.queueAvailable !== false;
  });

  if (!available.length) {
    return overflowQueue(input, queue);
  }

  let ordered = [...available];
  if (
    queue.strategy === "round_robin" ||
    queue.strategy === "sequential" ||
    queue.strategy === "linear"
  ) {
    const cfg = (queue.configJson || {}) as { lastIndex?: number };
    const start = ((cfg.lastIndex || 0) + 1) % ordered.length;
    ordered = [...ordered.slice(start), ...ordered.slice(0, start)];
    await prisma.callQueue.update({
      where: { id: queue.id },
      data: { configJson: { ...cfg, lastIndex: start } },
    });
    if (queue.strategy === "sequential" || queue.strategy === "linear") {
      ordered = ordered.slice(0, 1);
    }
  } else if (queue.strategy === "longest_idle") {
    // Prefer users whose presence was updated longest ago while available.
    ordered.sort((a, b) => {
      const pa = presence.get(a)?.updatedAt?.getTime() || 0;
      const pb = presence.get(b)?.updatedAt?.getTime() || 0;
      return pa - pb;
    });
  }

  // Estimated wait TTS + hold music / announcement while ringing
  if (isTelnyxPhoneConfigured()) {
    const waitingAhead = await prisma.humanCall.count({
      where: {
        workspaceId: input.workspaceId,
        queueId: queue.id,
        status: { in: ["queued", "ringing"] },
        id: { not: input.humanCallId },
      },
    });
    const avgHandleSeconds = Number(
      ((queue.configJson || {}) as { avgHandleSeconds?: number }).avgHandleSeconds ||
        queue.timeoutSeconds ||
        120,
    );
    const etaMinutes = Math.max(
      1,
      Math.ceil(((waitingAhead + 1) * avgHandleSeconds) / 60),
    );
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
      method: "POST",
      body: {
        payload: `Please hold. Your estimated wait time is about ${etaMinutes} minute${etaMinutes === 1 ? "" : "s"}.`,
        voice: "female",
        language: "en-US",
      },
    }).catch(() => undefined);

    if (queue.announcementUrl) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/playback_start`, {
        method: "POST",
        body: { audio_url: queue.announcementUrl, loop: "infinity" },
      }).catch(() => undefined);
    } else if (queue.holdMusicUrl) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/playback_start`, {
        method: "POST",
        body: { audio_url: queue.holdMusicUrl, loop: "infinity" },
      }).catch(() => undefined);
    }
  }

  // Mark human call as queued; agents see it via ringing poll + presence.
  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      queueId: queue.id,
      status: "queued",
      notes: `queue:${queue.name} strategy:${queue.strategy}`,
    },
  });

  // Softphone poll ring + optional PSTN/cellular dial for members with forwardToCellular / ringMobile.
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
  const ringLegIds: string[] = [];
  for (const userId of ordered) {
    await prisma.softphonePresence.upsert({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } },
      create: {
        workspaceId: input.workspaceId,
        userId,
        status: "available",
        queueAvailable: true,
      },
      update: {},
    }).catch(() => undefined);

    const userSettings = await prisma.softphoneUserSettings.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } },
    });
    if (
      isTelnyxPhoneConfigured() &&
      connectionId &&
      userSettings?.ringMobile !== false &&
      userSettings?.forwardToCellular
    ) {
      const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
        method: "POST",
        body: {
          connection_id: connectionId,
          from: (
            await prisma.humanCall.findUnique({ where: { id: input.humanCallId } })
          )?.to,
          to: userSettings.forwardToCellular,
          client_state: Buffer.from(
            JSON.stringify({
              workspaceId: input.workspaceId,
              humanCallId: input.humanCallId,
              kind: "queue_member_ring",
              parentCallControlId: input.telnyxCallControlId,
              userId,
            }),
          ).toString("base64"),
        },
      }).catch(() => null);
      const legId = dialed?.data?.call_control_id;
      if (legId) ringLegIds.push(legId);
    }
  }
  if (ringLegIds.length) {
    await prisma.humanCall
      .update({
        where: { id: input.humanCallId },
        data: {
          notes: `queue:${queue.name} strategy:${queue.strategy} [ring_legs:${ringLegIds.join(",")}]`,
        },
      })
      .catch(() => undefined);
  }

  // Schedule overflow if nobody answers
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "phone_queue_overflow",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      queueId: queue.id,
      humanCallId: input.humanCallId,
      telnyxCallControlId: input.telnyxCallControlId,
    },
    idempotencyKey: `queue-overflow-${input.humanCallId}`,
    runAfter: new Date(Date.now() + (queue.timeoutSeconds || 30) * 1000),
  });

  return { rang: ordered, overflow: false as const, strategy: queue.strategy };
}

async function overflowQueue(
  input: {
    workspaceId: string;
    queueId: string;
    humanCallId: string;
    telnyxCallControlId: string;
  },
  queue: {
    overflowAction: string;
    overflowTarget: string | null;
    callbackEnabled: boolean;
  },
) {
  const prisma = getPrisma();
  const action = queue.overflowAction || "voicemail";

  if (action === "hangup" && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: { status: "missed", disposition: "queue_overflow_hangup", endedAt: new Date() },
    });
    return { rang: [], overflow: true as const, action };
  }

  // UI historically used "forward"; runtime also accepts "external".
  if (
    (action === "external" || action === "forward") &&
    queue.overflowTarget &&
    isTelnyxPhoneConfigured()
  ) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/transfer`, {
      method: "POST",
      body: { to: queue.overflowTarget },
    }).catch(() => undefined);
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: { status: "transferred", disposition: `overflow:${queue.overflowTarget}` },
    });
    return { rang: [], overflow: true as const, action: "forward" };
  }

  if (action === "ai_agent" && queue.overflowTarget) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: queue.overflowTarget, workspaceId: input.workspaceId },
    });
    if (agent?.telnyxAssistantId && isTelnyxPhoneConfigured()) {
      const { startAiAssistantOnCall } = await import("@/lib/voice/telnyx/assistant-sync");
      await startAiAssistantOnCall({
        callControlId: input.telnyxCallControlId,
        assistantId: agent.telnyxAssistantId,
      }).catch(() => undefined);
      await prisma.humanCall.update({
        where: { id: input.humanCallId },
        data: { status: "ai_fallback", disposition: `ai:${agent.id}` },
      });
      return { rang: [], overflow: true as const, action };
    }
  }

  // Default voicemail / callback
  if (queue.callbackEnabled) {
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: { status: "callback_requested", disposition: "queue_callback" },
    });
  } else {
    const { leaveVoicemailOnCall } = await import("./voicemail-service");
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      telnyxCallControlId: input.telnyxCallControlId,
      queueId: input.queueId,
    }).catch(() => undefined);
  }

  return { rang: [], overflow: true as const, action: action || "voicemail" };
}

export async function handleQueueOverflowJob(payload: {
  workspaceId: string;
  queueId: string;
  humanCallId: string;
  telnyxCallControlId: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findUnique({ where: { id: payload.humanCallId } });
  if (
    !call ||
    [
      "in_progress",
      "completed",
      "answered",
      "transferred",
      "voicemail",
      "parked",
      "missed",
      "ai_fallback",
      "callback_requested",
      "failed",
    ].includes(call.status)
  ) {
    return { skipped: true };
  }
  // Cancel outstanding cellular ring legs before overflow.
  const ringLegMatch = (call.notes || "").match(/\[ring_legs:([^\]]+)\]/);
  if (ringLegMatch?.[1] && isTelnyxPhoneConfigured()) {
    for (const legId of ringLegMatch[1]
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)) {
      await telnyxRequest(`/calls/${legId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
  }
  const queue = await prisma.callQueue.findUnique({ where: { id: payload.queueId } });
  if (!queue) return { skipped: true };
  return overflowQueue(payload, queue);
}
