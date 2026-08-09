import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { loadWorkflowFieldDefinitions, toManifestEntries } from "@/lib/voice/field-runtime/loader";
import { getWorkflowRequirements } from "@/lib/voice/field-runtime/requirements";
import { SYSTEM_FIELD_IDS } from "@/lib/voice/field-runtime/system-fields";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import { normalizeSpokenEmail } from "@/lib/voice/field-runtime/validate";
import { updateSessionAfterRuntimeChange } from "@/lib/voice/realtime-session/init";
import type { LiveKitCallContext } from "./session-bootstrap";

const EMAIL_MANIFEST_ENTRY: RuntimeFieldManifestEntry = {
  field_id: SYSTEM_FIELD_IDS.email,
  label: "Email",
  type: "email",
  required: true,
  collection_instruction: "Ask for the caller's email address.",
};

function ensureManifestIncludes(
  manifest: RuntimeFieldManifestEntry[],
  field: RuntimeFieldManifestEntry,
): RuntimeFieldManifestEntry[] {
  if (manifest.some((entry) => entry.field_id === field.field_id)) return manifest;
  return [...manifest, field];
}

export function looksLikeSpokenEmail(value: string): boolean {
  const normalized = normalizeSpokenEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function bookingFailureNeedsFieldCollection(input: {
  confirmed: boolean;
  result: Record<string, unknown>;
  session: AmyRealtimeSession;
}): boolean {
  if (!input.confirmed || input.result.ok !== false) return false;

  const data =
    typeof input.result.data === "object" && input.result.data
      ? (input.result.data as Record<string, unknown>)
      : {};
  const booking =
    typeof data.booking === "object" && data.booking
      ? (data.booking as Record<string, unknown>)
      : {};
  const errorCode = String(input.result.error_code || booking.error_code || "");
  const speak = String(input.result.speak || "");
  const emailMissing = !input.session.collectedFields?.[SYSTEM_FIELD_IDS.email]?.trim();

  return (
    errorCode === "MISSING_REQUIRED_FIELD" ||
    data.needsFieldCollection === true ||
    (emailMissing && /email/i.test(speak))
  );
}

export async function reconcileSessionAfterBookingFieldGap(input: {
  ctx: LiveKitCallContext;
  session: AmyRealtimeSession;
  result: Record<string, unknown>;
  confirmed: boolean;
}): Promise<AmyRealtimeSession> {
  if (
    !bookingFailureNeedsFieldCollection({
      confirmed: input.confirmed,
      result: input.result,
      session: input.session,
    })
  ) {
    return input.session;
  }

  const requirements = await getWorkflowRequirements({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    callId: input.ctx.callId,
    workflow: "book_appointment",
    serviceName: input.ctx.session.serviceName,
  });

  let fieldManifest = [...requirements.fields_to_collect];
  let missingIds = requirements.missing_fields.map((field) => field.field_id);

  if (!input.session.collectedFields?.[SYSTEM_FIELD_IDS.email]?.trim()) {
    fieldManifest = ensureManifestIncludes(fieldManifest, EMAIL_MANIFEST_ENTRY);
    if (!missingIds.includes(SYSTEM_FIELD_IDS.email)) {
      missingIds = [SYSTEM_FIELD_IDS.email, ...missingIds];
    }
  }

  if (!input.session.collectedFields?.[SYSTEM_FIELD_IDS.name]?.trim()) {
    const defs = await loadWorkflowFieldDefinitions({
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      workflow: "book_appointment",
      serviceName: input.ctx.session.serviceName || undefined,
    });
    fieldManifest = toManifestEntries(defs);
    missingIds = fieldManifest
      .filter(
        (field) =>
          field.required && !input.session.collectedFields?.[field.field_id]?.trim(),
      )
      .map((field) => field.field_id);
  }

  const activeField =
    missingIds.find((id) => id === SYSTEM_FIELD_IDS.email) ||
    requirements.active_field ||
    missingIds[0] ||
    SYSTEM_FIELD_IDS.email;

  const next = await updateSessionAfterRuntimeChange(input.session, {
    currentState: "COLLECTING_FIELDS",
    missingFieldIds: missingIds,
    activeField,
    fieldManifest,
  });

  input.ctx.session = next;
  input.ctx.workflowState = "COLLECTING_FIELDS";
  return next;
}

export function resolveRecordFieldId(input: {
  session: AmyRealtimeSession;
  value: string;
  fieldId?: string;
}): string | null {
  if (input.fieldId?.trim()) return input.fieldId.trim();
  if (input.session.activeField?.trim()) return input.session.activeField.trim();

  if (looksLikeSpokenEmail(input.value)) {
    return SYSTEM_FIELD_IDS.email;
  }

  const missingEmail = !input.session.collectedFields?.[SYSTEM_FIELD_IDS.email]?.trim();
  if (
    missingEmail &&
    input.session.missingFieldIds.includes(SYSTEM_FIELD_IDS.email)
  ) {
    return SYSTEM_FIELD_IDS.email;
  }

  return null;
}
