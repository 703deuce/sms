import { callerFieldIdToIntakeKey } from "@/lib/voice-receptionist-wizard/intake/compile-schema";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { wizardCollectFieldIdToCallerRowId } from "@/lib/solutions/appointment-receptionist/wizard-collect-field-id";
import type { IntakeFieldDefinition, IntakeFieldType } from "./agent-config";

type WizardCollectField = AppointmentReceptionistWizardState["collectFields"][number];

function mapCollectFieldType(id: string, intakeKey: string): IntakeFieldType {
  if (intakeKey === "email" || id === "email") return "email";
  if (intakeKey === "phone" || id === "phone" || intakeKey === "callback_number") return "phone";
  return "text";
}

/**
 * Appointment receptionist wizard collectFields → authoritative Voice V3 intake (no V2 schema).
 */
export function compileWizardCollectFieldsToV3Intake(
  collectFields: WizardCollectField[] | undefined | null,
): IntakeFieldDefinition[] {
  const rows = collectFields ?? [];
  const out: IntakeFieldDefinition[] = [];
  const seen = new Set<string>();

  for (const f of rows) {
    if (f.enabled === false) continue;
    const rowId = wizardCollectFieldIdToCallerRowId(f.id);
    const key = callerFieldIdToIntakeKey(rowId);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const type = mapCollectFieldType(f.id, key);
    const label = f.label?.trim() || key;
    const description = `Caller ${label}.`;

    out.push({
      key,
      label,
      type,
      required: Boolean(f.required),
      description,
      collectionStrategy:
        type === "email" ? "voice_email" : type === "phone" ? "voice_phone" : "standard",
      verificationRequired: false,
    });
  }

  return out;
}

export function bookingRequiredIntakeKeys(fields: IntakeFieldDefinition[]): string[] {
  return fields.filter((f) => f.required).map((f) => f.key);
}

const DEFAULT_CALLBACK_REASON_KEYS = ["service_reason", "service", "notes", "reason"] as const;

/**
 * Per-operation callback requirements — independent from book_appointment intake.
 */
export function callbackRequiredIntakeKeys(
  wizard: AppointmentReceptionistWizardState,
  intakeFields: IntakeFieldDefinition[],
): string[] {
  const configuredIds = wizard.callbackRequiredCollectFieldIds;
  if (configuredIds?.length) {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const id of configuredIds) {
      const rowId = wizardCollectFieldIdToCallerRowId(id);
      const key = callerFieldIdToIntakeKey(rowId);
      if (!key || seen.has(key)) continue;
      if (!intakeFields.some((f) => f.key === key)) continue;
      seen.add(key);
      keys.push(key);
    }
    if (keys.length > 0) return keys;
  }

  const enabledKeys = new Set(intakeFields.map((f) => f.key));
  const required: string[] = [];
  if (enabledKeys.has("name")) required.push("name");
  if (enabledKeys.has("phone")) required.push("phone");
  const reasonKey = DEFAULT_CALLBACK_REASON_KEYS.find((k) => enabledKeys.has(k));
  required.push(reasonKey ?? "service_reason");
  return required;
}
