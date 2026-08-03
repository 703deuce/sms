import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isTelnyxVoiceConfigured, startAiAssistantOnCall } from "./telnyx/assistant-sync";

function encodeClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

async function logTransferEvent(
  workspaceId: string,
  callId: string,
  transferId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await getPrisma().voiceCallEvent.create({
    data: {
      workspaceId,
      callId,
      eventType: `transfer.${eventType}`,
      payload: { transferId, ...payload } as object,
    },
  });
}

async function returnCallerToAi(workspaceId: string, callId: string, reason: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId || !call.agentId) return { ok: false };

  const agent = await prisma.voiceAgent.findUnique({ where: { id: call.agentId } });
  if (!agent?.telnyxAssistantId) return { ok: false };
  if (agent.emergencyDisabled) return { ok: false, reason: "emergency_disabled" };

  if (isTelnyxVoiceConfigured() && !call.telnyxCallControlId.startsWith("mock_")) {
    await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/unhold`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    await startAiAssistantOnCall({
      callControlId: call.telnyxCallControlId,
      assistantId: agent.telnyxAssistantId,
      clientState: { workspaceId, callId, agentId: agent.id, transferFallback: true },
    }).catch(() => undefined);
  }

  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      status: "IN_PROGRESS",
      transferred: false,
      metadata: {
        ...(call.metadata as object),
        aiResumedAfterTransfer: true,
        transferFallbackReason: reason,
      } as object,
    },
  });

  return { ok: true };
}

export async function initiateTransfer(input: {
  workspaceId: string;
  callId: string;
  destination: string;
  transferType: string;
  summary?: string;
  fallbackDestinations?: string[];
  timeoutSeconds?: number;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
  });
  if (!call?.telnyxCallControlId) throw new Error("Call not active for transfer");

  const alloc = await prisma.voiceConcurrencyAllocation.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const maxLegs = alloc?.maxTransferLegs ?? 10;
  if (maxLegs > 0) {
    const activeLegs = await prisma.voiceTransfer.count({
      where: {
        workspaceId: input.workspaceId,
        status: { in: ["requested", "ringing", "bridging", "in_progress"] },
      },
    });
    if (activeLegs >= maxLegs) {
      throw new Error(`Transfer concurrency cap reached (${activeLegs}/${maxLegs})`);
    }
  }

  // Prefer named destination config when the destination matches a saved name or number.
  let destination = input.destination.toLowerCase().startsWith("sip:")
    ? input.destination
    : normalizeE164(input.destination);
  let fallbacks = (input.fallbackDestinations || []).map((d) =>
    d.toLowerCase().startsWith("sip:") ? d : normalizeE164(d),
  );
  const namedCandidates = await prisma.voiceTransferDestination.findMany({
    where: {
      workspaceId: input.workspaceId,
      enabled: true,
      OR: [
        { name: input.destination },
        { destination: input.destination },
        { destination },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  const namedDest =
    namedCandidates.find(
      (d: { agentId: string | null }) => d.agentId && d.agentId === call.agentId,
    ) ||
    namedCandidates.find((d: { agentId: string | null }) => !d.agentId) ||
    namedCandidates[0] ||
    null;
  if (namedDest) {
    destination = namedDest.destination.toLowerCase().startsWith("sip:")
      ? namedDest.destination
      : normalizeE164(namedDest.destination);
    if (namedDest.fallbackDestination) {
      const fb = namedDest.fallbackDestination;
      fallbacks = [
        fb.toLowerCase().startsWith("sip:") ? fb : normalizeE164(fb),
        ...fallbacks,
      ];
    }
  }
  const { assertSafeTransferDestination } = await import("./security/redaction");
  assertSafeTransferDestination(destination);

  const transfer = await prisma.voiceTransfer.create({
    data: {
      workspaceId: input.workspaceId,
      callId: call.id,
      transferType: input.transferType,
      destination,
      status: "requested",
      summary: input.summary,
      metadata: {
        fallbackDestinations: fallbacks,
        timeoutSeconds: input.timeoutSeconds || 30,
      } as object,
    },
  });

  await logTransferEvent(input.workspaceId, call.id, transfer.id, "requested", {
    destination,
    transferType: input.transferType,
  });

  if (!isTelnyxVoiceConfigured() || call.telnyxCallControlId.startsWith("mock_")) {
    await prisma.voiceTransfer.update({
      where: { id: transfer.id },
      data: { status: "completed", answered: true, completedAt: new Date() },
    });
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: { transferred: true, status: "TRANSFERRED" },
    });
    await logTransferEvent(input.workspaceId, call.id, transfer.id, "completed", { mode: "mock" });
    return { mode: "mock", transferId: transfer.id };
  }

  const isWarm = input.transferType === "warm_transfer";
  if (isWarm) {
    return initiateWarmTransfer({
      workspaceId: input.workspaceId,
      call,
      transfer,
      destination,
      fallbacks,
      summary: input.summary,
      timeoutSeconds: input.timeoutSeconds || 30,
    });
  }

  // SIP REFER when destination is a SIP URI or transferType explicitly requests it.
  const isSipRefer =
    input.transferType === "sip_refer" ||
    destination.toLowerCase().startsWith("sip:") ||
    input.destination.toLowerCase().startsWith("sip:");
  const referTarget = isSipRefer
    ? input.destination.toLowerCase().startsWith("sip:")
      ? input.destination
      : destination.toLowerCase().startsWith("sip:")
        ? destination
        : `sip:${destination.replace(/^\+/, "")}`
    : null;

  if (isSipRefer && referTarget) {
    try {
      await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/refer`, {
        method: "POST",
        body: {
          sip_address: referTarget,
          client_state: Buffer.from(
            JSON.stringify({
              workspaceId: input.workspaceId,
              callId: call.id,
              transferId: transfer.id,
              mode: "sip_refer",
            }),
          ).toString("base64"),
        },
        idempotencyKey: `refer-${transfer.id}`,
      });
    } catch {
      // Fallback to Call Control transfer if REFER is unsupported on the account.
      await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/transfer`, {
        method: "POST",
        body: {
          to: referTarget,
          timeout_secs: input.timeoutSeconds || 30,
        },
        idempotencyKey: `xfer-sip-${transfer.id}`,
      });
    }
  } else {
    const amdBody: Record<string, unknown> = {
      to: destination,
      timeout_secs: input.timeoutSeconds || 30,
    };
    // Prefer agent draftConfig.transfers.detectVoicemailOnTransfer when set.
    let detectAmd = true;
    if (call.agentId) {
      const agentRow = await prisma.voiceAgent.findUnique({ where: { id: call.agentId } });
      if (agentRow?.draftConfig) {
        const { parseVoiceAgentConfig } = await import("./types");
        const cfg = parseVoiceAgentConfig(agentRow.draftConfig);
        const transfersCfg = (cfg.transfers || {}) as Record<string, unknown>;
        if (typeof transfersCfg.detectVoicemailOnTransfer === "boolean") {
          detectAmd = transfersCfg.detectVoicemailOnTransfer;
        }
      }
    }
    if (detectAmd) {
      amdBody.answering_machine_detection = "detect";
    }
    await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/transfer`, {
      method: "POST",
      body: amdBody,
      idempotencyKey: `xfer-${transfer.id}`,
    });
  }

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      // Mark intent immediately; bridge/answer confirms completion.
      transferred: true,
      status: "TRANSFERRED",
      metadata: {
        ...(call.metadata as object),
        lastTransferType: isSipRefer ? "sip_refer" : input.transferType,
        transferInProgress: true,
        transferId: transfer.id,
      } as object,
    },
  });
  await prisma.voiceTransfer.update({
    where: { id: transfer.id },
    data: {
      status: "ringing",
      transferType: isSipRefer ? "sip_refer" : input.transferType,
      metadata: {
        ...((transfer.metadata as object) || {}),
        sipRefer: Boolean(isSipRefer),
        referTarget,
      } as object,
    },
  });
  await logTransferEvent(input.workspaceId, call.id, transfer.id, "ringing", {
    destination,
    transferType: isSipRefer ? "sip_refer" : input.transferType,
  });

  return { mode: "telnyx", transferId: transfer.id, sipRefer: Boolean(isSipRefer) };
}

/** Mark in-flight Call Control transfers completed when the call bridges. */
export async function completeTransfersOnBridge(input: {
  workspaceId: string;
  callId: string;
}) {
  const prisma = getPrisma();
  const pending = await prisma.voiceTransfer.findMany({
    where: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      status: {
        in: ["requested", "ringing", "bridging", "in_progress", "consulting"],
      },
    },
  });
  for (const t of pending) {
    await prisma.voiceTransfer.update({
      where: { id: t.id },
      data: {
        status: "completed",
        answered: true,
        completedAt: new Date(),
      },
    });
    await logTransferEvent(input.workspaceId, input.callId, t.id, "completed", {
      reason: "call.bridged",
    });
  }
  if (pending.length) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
    });
    if (call) {
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: {
          transferred: true,
          status: "TRANSFERRED",
          metadata: {
            ...(call.metadata as object),
            transferInProgress: false,
            transferCompletedAt: new Date().toISOString(),
          } as object,
        },
      });
    }
  }
  return { completed: pending.length };
}

async function initiateWarmTransfer(input: {
  workspaceId: string;
  call: {
    id: string;
    telnyxCallControlId: string | null;
    fromE164: string;
    toE164: string;
    agentId: string | null;
  };
  transfer: { id: string };
  destination: string;
  fallbacks: string[];
  summary?: string;
  timeoutSeconds: number;
}) {
  const prisma = getPrisma();
  const callerControlId = input.call.telnyxCallControlId!;

  await telnyxRequest(`/calls/${callerControlId}/actions/hold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  await prisma.voiceTransfer.update({
    where: { id: input.transfer.id },
    data: { status: "consulting" },
  });
  await logTransferEvent(input.workspaceId, input.call.id, input.transfer.id, "consulting", {
    destination: input.destination,
  });

  const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
  let detectAmd = true;
  if (input.call.agentId) {
    const agentRow = await prisma.voiceAgent.findUnique({ where: { id: input.call.agentId } });
    if (agentRow?.draftConfig) {
      const { parseVoiceAgentConfig } = await import("./types");
      const cfg = parseVoiceAgentConfig(agentRow.draftConfig);
      const transfersCfg = (cfg.transfers || {}) as Record<string, unknown>;
      if (typeof transfersCfg.detectVoicemailOnTransfer === "boolean") {
        detectAmd = transfersCfg.detectVoicemailOnTransfer;
      }
    }
  }
  const consultBody: Record<string, unknown> = {
    connection_id: connectionId,
    from: input.call.toE164,
    to: input.destination,
    client_state: encodeClientState({
      workspaceId: input.workspaceId,
      callId: input.call.id,
      transferId: input.transfer.id,
      kind: "warm_transfer_consult",
      callerControlId,
      summary: input.summary || "",
      fallbackDestinations: input.fallbacks,
    }),
  };
  if (detectAmd) {
    consultBody.answering_machine_detection = "detect";
  }
  const consultLeg = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
    method: "POST",
    body: consultBody,
  });

  const consultControlId = consultLeg.data?.call_control_id;
  if (!consultControlId) throw new Error("Consult leg dial failed");

  await prisma.voiceTransfer.update({
    where: { id: input.transfer.id },
    data: {
      metadata: {
        consultControlId,
        callerControlId,
        fallbackDestinations: input.fallbacks,
        timeoutSeconds: input.timeoutSeconds,
        summary: input.summary,
        // AI voice path has no "Complete transfer" UI — auto-bridge after consult hears summary.
        autoCompleteOnAnswer: true,
      } as object,
    },
  });

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "voice_warm_transfer_timeout",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      callId: input.call.id,
      transferId: input.transfer.id,
    },
    idempotencyKey: `warm-transfer-timeout-${input.transfer.id}`,
    runAfter: new Date(Date.now() + input.timeoutSeconds * 1000),
  });

  return { mode: "telnyx", transferId: input.transfer.id, consultControlId };
}

/** Bridge caller and consult leg after consult answers (warm transfer complete). */
export async function completeWarmTransfer(input: {
  workspaceId: string;
  callId: string;
  transferId: string;
  consultControlId: string;
  callerControlId: string;
  summary?: string;
}) {
  const prisma = getPrisma();

  if (input.summary && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.consultControlId}/actions/speak`, {
      method: "POST",
      body: {
        payload: input.summary,
        voice: "female",
        language: "en-US",
      },
    }).catch(() => undefined);
  }

  if (isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.callerControlId}/actions/unhold`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    await telnyxRequest(`/calls/${input.callerControlId}/actions/bridge`, {
      method: "POST",
      body: { call_control_id: input.consultControlId },
    }).catch(() => undefined);
  }

  await prisma.voiceTransfer.update({
    where: { id: input.transferId },
    data: {
      status: "completed",
      answered: true,
      completedAt: new Date(),
      summary: input.summary,
    },
  });
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: { transferred: true, status: "TRANSFERRED" },
  });
  await logTransferEvent(input.workspaceId, input.callId, input.transferId, "completed", {
    consultControlId: input.consultControlId,
  });

  return { ok: true };
}

/** Cancel warm transfer — hang up consult and return caller to AI or unhold. */
export async function cancelWarmTransfer(input: {
  workspaceId: string;
  callId: string;
  transferId: string;
  reason?: string;
}) {
  const prisma = getPrisma();
  const transfer = await prisma.voiceTransfer.findFirst({
    where: { id: input.transferId, workspaceId: input.workspaceId },
  });
  if (!transfer) return { ok: false };

  const meta = (transfer.metadata || {}) as Record<string, unknown>;
  const consultControlId = meta.consultControlId as string | undefined;
  const callerControlId = meta.callerControlId as string | undefined;

  if (consultControlId && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${consultControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  await prisma.voiceTransfer.update({
    where: { id: transfer.id },
    data: {
      status: "cancelled",
      completedAt: new Date(),
      metadata: { ...meta, cancelReason: input.reason || "cancelled" } as object,
    },
  });
  await logTransferEvent(input.workspaceId, input.callId, transfer.id, "cancelled", {
    reason: input.reason,
  });

  const fallbacks = (meta.fallbackDestinations as string[]) || [];
  if (fallbacks.length) {
    const next = fallbacks[0];
    const rest = fallbacks.slice(1);
    return initiateTransfer({
      workspaceId: input.workspaceId,
      callId: input.callId,
      destination: next,
      transferType: "warm_transfer",
      summary: transfer.summary,
      fallbackDestinations: rest,
      timeoutSeconds: Number(meta.timeoutSeconds || 30),
    });
  }

  return returnCallerToAi(input.workspaceId, input.callId, input.reason || "transfer_cancelled");
}

export async function handleWarmTransferTimeoutJob(payload: {
  workspaceId: string;
  callId: string;
  transferId: string;
}) {
  const prisma = getPrisma();
  const transfer = await prisma.voiceTransfer.findFirst({
    where: { id: payload.transferId, workspaceId: payload.workspaceId },
  });
  if (!transfer || transfer.status === "completed" || transfer.status === "cancelled") {
    return { skipped: true };
  }
  const meta = (transfer.metadata || {}) as Record<string, unknown>;
  // Give auto-complete a grace window after consult answer; if it never finishes, cancel.
  if (
    (transfer.status === "consult_answered" || meta.awaitingComplete) &&
    meta.autoCompleteOnAnswer
  ) {
    const answeredAtMs = Number(meta.consultAnsweredAtMs || 0) || transfer.createdAt.getTime();
    if (Date.now() - answeredAtMs < 20_000) {
      return { skipped: true, reason: "awaiting_auto_complete" };
    }
  }

  return cancelWarmTransfer({
    workspaceId: payload.workspaceId,
    callId: payload.callId,
    transferId: payload.transferId,
    reason: "timeout",
  });
}

/** Handle consult leg answered for warm transfer (called from webhook client_state). */
export async function handleWarmTransferConsultAnswered(input: {
  workspaceId: string;
  callId: string;
  transferId: string;
  consultControlId: string;
  callerControlId: string;
  summary?: string;
}) {
  const prisma = getPrisma();
  // Consult answered: whisper/speak context to the destination agent, keep caller held.
  if (input.summary && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.consultControlId}/actions/speak`, {
      method: "POST",
      body: {
        payload: input.summary,
        voice: "female",
        language: "en-US",
      },
    }).catch(() => undefined);
  }

  const transfer = await prisma.voiceTransfer.findFirst({
    where: { id: input.transferId, workspaceId: input.workspaceId },
  });
  const meta = (transfer?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceTransfer.update({
    where: { id: input.transferId },
    data: {
      status: "consult_answered",
      answered: true,
      metadata: {
        ...meta,
        consultControlId: input.consultControlId,
        callerControlId: input.callerControlId,
        summary: input.summary,
        awaitingComplete: true,
        consultAnsweredAtMs: Date.now(),
      } as object,
    },
  });
  await logTransferEvent(input.workspaceId, input.callId, input.transferId, "consult_answered", {
    consultControlId: input.consultControlId,
  });

  // AI warm transfers auto-bridge after the summary speaks (give TTS a moment).
  if (meta.autoCompleteOnAnswer) {
    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    await enqueueJob({
      jobType: "voice_warm_transfer_complete",
      queueName: "voice-calls",
      workspaceId: input.workspaceId,
      payload: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        transferId: input.transferId,
        consultControlId: input.consultControlId,
        callerControlId: input.callerControlId,
        // Summary already spoken on consult answer — avoid double TTS.
      },
      idempotencyKey: `warm-transfer-complete-${input.transferId}`,
      runAfter: new Date(Date.now() + 4500),
    });
    return { ok: true, awaitingComplete: true, scheduledComplete: true };
  }

  return { ok: true, awaitingComplete: true };
}

export async function handleTransferAmdResult(
  callId: string,
  workspaceId: string,
  amdResult: string,
) {
  const prisma = getPrisma();
  const transfer = await prisma.voiceTransfer.findFirst({
    where: { callId, workspaceId },
    orderBy: { createdAt: "desc" },
  });
  if (!transfer) return;

  if (amdResult === "machine" || amdResult === "machine_end_beep") {
    await prisma.voiceTransfer.update({
      where: { id: transfer.id },
      data: {
        status: "voicemail",
        voicemailDetected: true,
        completedAt: new Date(),
      },
    });
    await logTransferEvent(workspaceId, callId, transfer.id, "amd_voicemail", { amdResult });

    const meta = (transfer.metadata || {}) as Record<string, unknown>;
    const consultControlId = meta.consultControlId as string | undefined;
    if (consultControlId && isTelnyxVoiceConfigured()) {
      await telnyxRequest(`/calls/${consultControlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }

    await returnCallerToAi(workspaceId, callId, "amd_voicemail");
  }
}
