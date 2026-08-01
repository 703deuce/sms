/**
 * Sequential / simultaneous hunt-group helpers for forwarding + queue member advance.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isTelnyxPhoneConfigured } from "./human-call-service";

function encodeClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function parseHuntTargets(notes: string | null | undefined): string[] {
  const m = (notes || "").match(/\[hunt_targets:([^\]]+)\]/);
  if (!m?.[1]) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseHuntIndex(notes: string | null | undefined): number {
  const m = (notes || "").match(/\[hunt_index:(\d+)\]/);
  return m?.[1] ? Number(m[1]) : 0;
}

export async function dialHuntTarget(input: {
  workspaceId: string;
  humanCallId: string;
  parentCallControlId: string;
  fromE164: string;
  target: string;
  sequential: boolean;
}) {
  if (!isTelnyxPhoneConfigured()) return null;
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
  if (!connectionId) return null;
  const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from: input.fromE164,
      to: normalizeE164(input.target),
      client_state: encodeClientState({
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        kind: "simultaneous_ring",
        parentCallControlId: input.parentCallControlId,
        sequential: input.sequential,
      }),
    },
  }).catch(() => null);
  return dialed?.data?.call_control_id || null;
}

/** Advance sequential hunt to the next target, or overflow to voicemail. */
export async function advanceSequentialHunt(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string;
  toE164: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || ["in_progress", "completed", "transferred", "voicemail"].includes(call.status)) {
    return { skipped: true };
  }

  const targets = parseHuntTargets(call.notes);
  const index = parseHuntIndex(call.notes);
  const nextIndex = index + 1;

  // Hang up previous ring legs.
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

  if (nextIndex >= targets.length) {
    const { leaveVoicemailOnCall } = await import("./voicemail-service");
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: input.telnyxCallControlId,
    }).catch(() => undefined);
    return { overflow: true };
  }

  const nextTarget = targets[nextIndex]!;
  const legId = await dialHuntTarget({
    workspaceId: input.workspaceId,
    humanCallId: call.id,
    parentCallControlId: input.telnyxCallControlId,
    fromE164: input.toE164,
    target: nextTarget,
    sequential: true,
  });

  const notes = (call.notes || "")
    .replace(/\[hunt_index:\d+\]/, `[hunt_index:${nextIndex}]`)
    .replace(/\[ring_legs:[^\]]*\]/, legId ? `[ring_legs:${legId}]` : "");

  await prisma.humanCall.update({
    where: { id: call.id },
    data: { notes: notes.includes("[hunt_index:") ? notes : `${notes} [hunt_index:${nextIndex}]`.trim() },
  });

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "phone_hunt_advance",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: input.telnyxCallControlId,
      toE164: input.toE164,
    },
    idempotencyKey: `hunt-advance-${call.id}-${nextIndex}`,
    runAfter: new Date(Date.now() + 25_000),
  });

  return { advanced: true, nextIndex, target: nextTarget };
}
