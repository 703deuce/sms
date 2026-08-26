import "server-only";

import { getPrisma } from "@/lib/db";
import {
  parseStoredTrace,
  serializeMctbVoicemailLifecycleTrace,
  type StoredVoicemailLifecycleTrace,
} from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle-trace";

export type { StoredVoicemailLifecycleTrace } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle-trace";
export { parseMctbVoicemailLifecycleTrace } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle-trace";

export type MctbVoicemailLifecycleInput = {
  workspaceId: string;
  messageId: string;
  event: string;
  providerCallId?: string | null;
  buildSha?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function appendMctbVoicemailLifecycleEvent(input: MctbVoicemailLifecycleInput) {
  const workspaceId = String(input.workspaceId || "").trim();
  const messageId = String(input.messageId || "").trim();
  const event = String(input.event || "").trim();
  if (!workspaceId || !messageId || !event) {
    return { ok: false, error: "missing_required_fields" };
  }

  const prisma = getPrisma();
  const existing = await prisma.voicemailMessage.findFirst({
    where: { id: messageId, workspaceId },
    select: { id: true, internalNotes: true, transcriptionError: true },
  });
  if (!existing) {
    return { ok: false, error: "message_not_found" };
  }

  const trace = parseStoredTrace(existing.internalNotes);
  if (input.providerCallId && !trace.providerCallId) {
    trace.providerCallId = input.providerCallId;
  }
  if (input.buildSha && (!trace.buildSha || trace.buildSha === "unknown")) {
    trace.buildSha = input.buildSha;
  }

  trace.events.push({
    at: new Date().toISOString(),
    event,
    payload: input.payload || undefined,
  });

  const serialized = serializeMctbVoicemailLifecycleTrace(trace);
  const failureEvents = new Set([
    "finalize_failed",
    "encode_failed",
    "upload_failed",
    "recording_too_short",
    "record_error",
    "complete_rejected",
  ]);
  const shouldSetError = failureEvents.has(event);
  const errorHint =
    shouldSetError && input.payload?.error
      ? String(input.payload.error)
      : shouldSetError
        ? event
        : null;

  await prisma.voicemailMessage.update({
    where: { id: messageId },
    data: {
      internalNotes: serialized,
      ...(errorHint ? { transcriptionError: errorHint.slice(0, 500) } : {}),
    },
  });

  console.log(
    JSON.stringify({
      service: "transovo-web",
      event: "mctb_voicemail_lifecycle",
      timestamp: new Date().toISOString(),
      workspaceId,
      messageId,
      lifecycleEvent: event,
      providerCallId: input.providerCallId || trace.providerCallId || null,
      buildSha: input.buildSha || trace.buildSha || null,
      payload: input.payload || null,
    }),
  );

  return { ok: true, eventCount: trace.events.length };
}
