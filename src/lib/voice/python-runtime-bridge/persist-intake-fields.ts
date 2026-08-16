import { getPrisma } from "@/lib/db";
import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import {
  missingReceptionistFields,
  type ReceptionistCollectionPurpose,
} from "@/lib/voice/receptionist/field-collection-scope";
import type { PersistIntakeFieldsInput, PythonRuntimeError } from "./types";

function receptionistPurpose(purpose?: string): ReceptionistCollectionPurpose {
  if (purpose === "message") return "message";
  if (purpose === "booking") return "booking";
  if (purpose === "service") return "service";
  return "booking";
}

/** Lightweight persist — no voice-runtime / LiveKit imports (safe for internal API). */
export async function persistIntakeFieldsForPython(
  input: PersistIntakeFieldsInput,
): Promise<{ ok: true; fields: Record<string, string>; missingFieldIds: string[] } | PythonRuntimeError> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true, agentVersionId: true },
  });
  if (!call) return { ok: false, error: "Call not found", code: "CALL_NOT_FOUND" };

  const { loadVoiceAgentConfigForCall } = await import("@/lib/voice/real-estate/publish");
  const loaded = await loadVoiceAgentConfigForCall({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentVersionId: call.agentVersionId || undefined,
  });
  const advanced = loaded.config.advanced as Record<string, unknown> | undefined;
  const { getReceptionistCompiledFromAdvanced } = await import("@/lib/voice/receptionist/runtime");
  const compiled = getReceptionistCompiledFromAdvanced(advanced);
  if (!compiled) return { ok: false, error: "Not a receptionist agent", code: "NOT_RECEPTIONIST" };

  const manifest = compiled.fieldManifest;
  const prior =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const priorFields =
    prior.pythonIntakeFields && typeof prior.pythonIntakeFields === "object"
      ? (prior.pythonIntakeFields as Record<string, string>)
      : {};

  const merged = { ...priorFields };
  for (const [fieldId, value] of Object.entries(input.fields)) {
    const field = manifest.find((f) => f.id === fieldId);
    if (!field) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    try {
      merged[fieldId] = validateReceptionistFieldValue(field, trimmed);
    } catch {
      continue;
    }
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prior,
        pythonIntakeFields: merged,
        pythonIntakeUpdatedAt: new Date().toISOString(),
      } as object,
    },
  });

  const purpose = receptionistPurpose(input.purpose);
  const missing = missingReceptionistFields(manifest, merged, purpose).map((f) => f.id);

  return { ok: true, fields: merged, missingFieldIds: missing };
}
