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
  let fullHuntOrder = [...available];
  if (
    queue.strategy === "round_robin" ||
    queue.strategy === "sequential" ||
    queue.strategy === "linear"
  ) {
    const cfg = (queue.configJson || {}) as { lastIndex?: number };
    const start = ordered.length ? ((cfg.lastIndex || 0) + 1) % ordered.length : 0;
    ordered = [...ordered.slice(start), ...ordered.slice(0, start)];
    fullHuntOrder = [...ordered];
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
    fullHuntOrder = [...ordered];
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
  // Sequential/linear: only the current member is active; ring_all fans out to ordered.
  const activeUserTag =
    queue.strategy === "sequential" || queue.strategy === "linear"
      ? ` [queue_active_user:${ordered[0] || ""}]`
      : "";
  let notes = `queue:${queue.name} strategy:${queue.strategy} [queue_members:${fullHuntOrder.join(",")}] [queue_member_index:0]${activeUserTag}`;

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
    notes = `${notes} [ring_legs:${ringLegIds.join(",")}]`;
  }
  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      queueId: queue.id,
      status: "queued",
      notes,
    },
  });

  // Push / notify only members currently being rung (sequential = one user).
  try {
    const { notifyUsersForInboundCall } = await import("./incoming-notify");
    const callRow = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
    await notifyUsersForInboundCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      fromE164: callRow?.from || "",
      toE164: callRow?.to || "",
      userIds: ordered,
    });
  } catch (err) {
    console.warn("[queue] member notify failed", err);
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
      const { assertAiCallAdmission, canStartMultiPartyAi } = await import(
        "@/lib/voice/platform/admission"
      );
      const admission = await assertAiCallAdmission({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        direction: "INBOUND",
      });
      if (!admission.ok) {
        return { rang: [], overflow: false as const, action, blocked: admission.code };
      }
      // When the human call is already in a conference, require multiPartyEnabled.
      const human = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
      if (human?.conferenceId) {
        const allowed = await canStartMultiPartyAi(input.workspaceId, agent.id);
        if (!allowed) {
          return {
            rang: [],
            overflow: false as const,
            action,
            blocked: "multi_party_disabled",
          };
        }
      }
      const { startAiAssistantOnCall } = await import("@/lib/voice/telnyx/assistant-sync");
      await startAiAssistantOnCall({
        callControlId: input.telnyxCallControlId,
        assistantId: agent.telnyxAssistantId,
        clientState: {
          workspaceId: input.workspaceId,
          agentId: agent.id,
          multiParty: Boolean(human?.conferenceId),
        },
      }).catch(() => undefined);
      await prisma.humanCall.update({
        where: { id: input.humanCallId },
        data: { status: "ai_fallback", disposition: `ai:${agent.id}` },
      });
      return { rang: [], overflow: true as const, action };
    }
  }

  // Explicit callback overflow (or legacy callbackEnabled flag).
  if (action === "callback" || queue.callbackEnabled) {
    if (isTelnyxPhoneConfigured()) {
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/speak`, {
        method: "POST",
        body: {
          payload:
            "We are sorry no one is available. We have recorded your number and will call you back shortly. Goodbye.",
          voice: "female",
          language: "en-US",
        },
      }).catch(() => undefined);
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
    const call = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: {
        status: "callback_requested",
        disposition: "queue_callback",
        endedAt: new Date(),
        notes: `${call?.notes || ""}\n[callback_requested:${call?.from || ""}]`.trim(),
      },
    });
    try {
      const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
      await enqueueJob({
        jobType: "phone_queue_callback",
        queueName: "voice-calls",
        workspaceId: input.workspaceId,
        payload: {
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          queueId: input.queueId,
          toE164: call?.from || null,
        },
        idempotencyKey: `queue-callback-${input.humanCallId}`,
        runAfter: new Date(Date.now() + 60_000),
      });
    } catch {
      // best-effort
    }
    return { rang: [], overflow: true as const, action: "callback" };
  }

  const { leaveVoicemailOnCall } = await import("./voicemail-service");
  await leaveVoicemailOnCall({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    telnyxCallControlId: input.telnyxCallControlId,
    queueId: input.queueId,
  }).catch(() => undefined);

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

  // Sequential / linear: try the next queue member before overflowing.
  if (queue.strategy === "sequential" || queue.strategy === "linear") {
    const membersMatch = (call.notes || "").match(/\[queue_members:([^\]]+)\]/);
    const indexMatch = (call.notes || "").match(/\[queue_member_index:(\d+)\]/);
    const members = membersMatch?.[1]
      ? membersMatch[1].split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const index = indexMatch?.[1] ? Number(indexMatch[1]) : 0;
    const nextIndex = index + 1;
    if (nextIndex < members.length) {
      const nextUserId = members[nextIndex]!;
      const userSettings = await prisma.softphoneUserSettings.findUnique({
        where: {
          workspaceId_userId: { workspaceId: payload.workspaceId, userId: nextUserId },
        },
      });
      const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
      let newLeg: string | null = null;
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
            from: call.to,
            to: userSettings.forwardToCellular,
            client_state: Buffer.from(
              JSON.stringify({
                workspaceId: payload.workspaceId,
                humanCallId: payload.humanCallId,
                kind: "queue_member_ring",
                parentCallControlId: payload.telnyxCallControlId,
                userId: nextUserId,
              }),
            ).toString("base64"),
          },
        }).catch(() => null);
        newLeg = dialed?.data?.call_control_id || null;
      }
      let notes = (call.notes || "")
        .replace(/\[queue_member_index:\d+\]/, `[queue_member_index:${nextIndex}]`)
        .replace(
          /\[ring_legs:[^\]]*\]/,
          newLeg ? `[ring_legs:${newLeg}]` : "[ring_legs:]",
        )
        .replace(
          /\[queue_active_user:[^\]]*\]/,
          `[queue_active_user:${nextUserId}]`,
        );
      if (!notes.includes("[queue_member_index:")) {
        notes = `${notes} [queue_member_index:${nextIndex}]`.trim();
      }
      if (!notes.includes("[queue_active_user:")) {
        notes = `${notes} [queue_active_user:${nextUserId}]`.trim();
      }
      if (newLeg && !notes.includes("[ring_legs:")) {
        notes = `${notes} [ring_legs:${newLeg}]`.trim();
      }
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          notes,
          status: "queued",
        },
      });
      try {
        const { notifyUsersForInboundCall } = await import("./incoming-notify");
        await notifyUsersForInboundCall({
          workspaceId: payload.workspaceId,
          humanCallId: payload.humanCallId,
          fromE164: call.from,
          toE164: call.to,
          userIds: [nextUserId],
        });
      } catch (err) {
        console.warn("[queue] next-member notify failed", err);
      }
      const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
      await enqueueJob({
        jobType: "phone_queue_overflow",
        queueName: "voice-calls",
        workspaceId: payload.workspaceId,
        payload: { ...payload },
        idempotencyKey: `queue-overflow-${payload.humanCallId}-m${nextIndex}`,
        runAfter: new Date(Date.now() + (queue.timeoutSeconds || 30) * 1000),
      });
      return { advanced: true, nextUserId, nextIndex };
    }
  }

  return overflowQueue(payload, queue);
}
