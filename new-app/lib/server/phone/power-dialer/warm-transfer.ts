import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { resolveTransferControlId } from "@/lib/server/phone/transfer";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";

export type WarmTransferPhase =
  | "idle"
  | "consulting"
  | "announcing"
  | "bridged"
  | "completed"
  | "cancelled"
  | "failed";

export type WarmTransferState = {
  phase: WarmTransferPhase;
  attemptId: string;
  consultCallControlId?: string | null;
  targetE164?: string;
  error?: string;
  updatedAt: string;
};

export function parseWarmTransferState(raw: unknown): WarmTransferState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.phase !== "string" || typeof o.attemptId !== "string") return null;
  return {
    phase: o.phase as WarmTransferPhase,
    attemptId: o.attemptId,
    consultCallControlId:
      typeof o.consultCallControlId === "string" ? o.consultCallControlId : null,
    targetE164: typeof o.targetE164 === "string" ? o.targetE164 : undefined,
    error: typeof o.error === "string" ? o.error : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

async function persistTransferState(sessionId: string, state: WarmTransferState) {
  const prisma = getPrisma();
  await prisma.powerDialerSession.update({
    where: { id: sessionId },
    data: { transferStateJson: state },
  });
}

export async function startWarmTransfer(input: {
  workspaceId: string;
  attemptId: string;
  toE164: string;
  mode: "warm" | "cold" | "three_way";
}) {
  if (!isTelnyxPhoneConfigured()) {
    throw new Error("Telnyx is not configured — transfer unavailable");
  }
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { humanCall: true, session: true },
  });
  if (!attempt?.humanCall) throw new Error("No active call to transfer");
  const to = normalizeE164(input.toE164);
  const controlId = resolveTransferControlId(attempt.humanCall);
  if (!controlId) throw new Error("No active call leg to bridge");

  if (input.mode === "cold") {
    await telnyxCallAction(controlId, "transfer", { to });
    await persistTransferState(attempt.sessionId, {
      phase: "completed",
      attemptId: input.attemptId,
      targetE164: to,
      updatedAt: new Date().toISOString(),
    });
    return { phase: "completed" as WarmTransferPhase, mode: "cold" };
  }

  const state: WarmTransferState = {
    phase: "consulting",
    attemptId: input.attemptId,
    targetE164: to,
    updatedAt: new Date().toISOString(),
  };
  await persistTransferState(attempt.sessionId, state);

  try {
    if (input.mode === "three_way") {
      await telnyxCallAction(controlId, "dial", {
        to,
        from: attempt.humanCall.from,
        client_state: Buffer.from(
          JSON.stringify({ warmTransfer: "three_way", attemptId: input.attemptId }),
        ).toString("base64"),
      });
      state.phase = "bridged";
    } else {
      await telnyxCallAction(controlId, "transfer", {
        to,
        sip_headers: [{ name: "X-Transovo-Warm", value: "consult" }],
      });
      state.phase = "announcing";
    }
    state.updatedAt = new Date().toISOString();
    await persistTransferState(attempt.sessionId, state);
    return { phase: state.phase, mode: input.mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transfer failed";
    await persistTransferState(attempt.sessionId, {
      phase: "failed",
      attemptId: input.attemptId,
      targetE164: to,
      error: message,
      updatedAt: new Date().toISOString(),
    });
    throw new Error(`Could not complete transfer leg: ${message}`);
  }
}

export async function completeWarmTransfer(workspaceId: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { humanCall: true, session: true },
  });
  if (!attempt?.humanCall) throw new Error("Call not found");
  const state = parseWarmTransferState(attempt.session.transferStateJson);
  if (!state || state.attemptId !== attemptId) {
    throw new Error("No warm transfer in progress for this call");
  }
  const controlId = resolveTransferControlId(attempt.humanCall);
  if (!controlId) throw new Error("No call leg to complete transfer");
  await telnyxCallAction(controlId, "bridge", {});
  await persistTransferState(attempt.sessionId, {
    ...state,
    phase: "completed",
    updatedAt: new Date().toISOString(),
  });
  return { phase: "completed" as WarmTransferPhase };
}

export async function cancelWarmTransfer(workspaceId: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { session: true },
  });
  if (!attempt) throw new Error("Attempt not found");
  await persistTransferState(attempt.sessionId, {
    phase: "cancelled",
    attemptId,
    updatedAt: new Date().toISOString(),
  });
  return { phase: "cancelled" as WarmTransferPhase };
}
