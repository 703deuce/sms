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

  // Play hold music / announcement while ringing
  if (isTelnyxPhoneConfigured()) {
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
      await telnyxRequest("/calls", {
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
      }).catch(() => undefined);
    }
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

  if (action === "external" && queue.overflowTarget && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/transfer`, {
      method: "POST",
      body: { to: queue.overflowTarget },
    }).catch(() => undefined);
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: { status: "transferred", disposition: `overflow:${queue.overflowTarget}` },
    });
    return { rang: [], overflow: true as const, action };
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
  if (!call || ["in_progress", "completed", "answered"].includes(call.status)) {
    return { skipped: true };
  }
  const queue = await prisma.callQueue.findUnique({ where: { id: payload.queueId } });
  if (!queue) return { skipped: true };
  return overflowQueue(payload, queue);
}
