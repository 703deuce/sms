import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { extractDeterministicFieldsFromUtterance } from "../../../../voice-runtime/src/frontdesk/receptionist/collection-field-extractor";
import type {
  ExtractFieldsInput,
  PythonRuntimeError,
} from "./types";

export { persistIntakeFieldsForPython } from "./persist-intake-fields";
export { persistMessageForPython } from "./persist-message";
export { resolveTransferForPython } from "./resolve-transfer";
export { getAvailabilityForPython } from "./get-availability-for-python";
export { commitBookingForPython } from "./commit-booking-for-python";

export async function extractFieldsForPython(
  input: ExtractFieldsInput,
): Promise<{ ok: true; fields: Record<string, string>; correction: boolean } | PythonRuntimeError> {
  const result = extractDeterministicFieldsFromUtterance(
    input.transcript,
    input.manifest,
    input.currentFields,
    input.callerE164,
  );
  const validated: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(result.fields)) {
    const field = input.manifest.find((f) => f.id === fieldId);
    if (!field) continue;
    try {
      validated[fieldId] = validateReceptionistFieldValue(field, value);
    } catch {
      continue;
    }
  }
  return { ok: true, fields: validated, correction: result.correction };
}

export async function businessAnswerForPython(input: {
  workspaceId: string;
  agentId: string;
  topic: string;
}): Promise<{ ok: true; speak: string } | PythonRuntimeError> {
  const result = await resolveBusinessAnswer({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    topic: input.topic,
  });
  if (!result.ok) {
    return { ok: false, error: result.speak || "Knowledge lookup failed", code: "KNOWLEDGE_FAILED" };
  }
  return { ok: true, speak: result.speak };
}

export async function emitVoiceRuntimeEvent(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  event: string;
  workflow?: string;
  extra?: Record<string, unknown>;
}): Promise<{ ok: true }> {
  console.log(
    JSON.stringify({
      source: "python-voice-runtime-bridge",
      event: input.event,
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: input.workflow,
      timestamp: new Date().toISOString(),
      ...input.extra,
    }),
  );
  return { ok: true };
}
