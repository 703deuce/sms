import "server-only";

import type { CallerFieldRow } from "@/lib/receptionist-wizard/advanced-types";
import { createDefaultAdvancedSettings } from "@/lib/receptionist-wizard/advanced-defaults";
import type { VoiceV2IntakeWizardConfig } from "@/lib/voice-v2/intake/wizard-config";
import {
  BUILTIN_INTAKE_FIELD_KEYS,
  type BuiltinIntakeFieldKey,
  type IntakeRequirementLevel,
} from "@/lib/voice-v2/intake/types";
import { callerFieldIdToIntakeKey } from "@/lib/voice-v2/intake/compile-schema";
import type { AppointmentReceptionistWizardState } from "./types";

type WizardCollectField = AppointmentReceptionistWizardState["collectFields"][number];

/** Map 8-page wizard collect field ids → receptionist caller field ids. */
export function wizardCollectFieldIdToCallerRowId(id: string): string {
  const trimmed = id.trim();
  if (trimmed === "full_name") return "name";
  if (trimmed === "service") return "reason";
  return trimmed;
}

function askWhenForField(
  rowId: string,
  required: boolean,
): CallerFieldRow["askWhen"] {
  if (rowId === "phone") return "new_callers";
  if (rowId === "email" || rowId === "address") return required ? "when_booking" : "when_booking";
  return "every_caller";
}

export function wizardCollectFieldsToCallerRows(
  collectFields: WizardCollectField[],
): CallerFieldRow[] {
  return collectFields.map((f) => {
    const rowId = wizardCollectFieldIdToCallerRowId(f.id);
    return {
      id: rowId,
      label: f.label?.trim() || rowId,
      question: undefined,
      required: Boolean(f.required),
      askWhen: askWhenForField(rowId, Boolean(f.required)),
      confirm: rowId === "phone" || rowId === "email",
      enabled: f.enabled !== false,
    };
  });
}

function requirementLevel(
  field: WizardCollectField,
  intakeKey: string,
): IntakeRequirementLevel {
  if (!field.required) return "OPTIONAL";
  if (
    intakeKey === "email" ||
    intakeKey === "address" ||
    field.id === "email" ||
    field.id === "address"
  ) {
    return "REQUIRED_BEFORE_BOOKING";
  }
  return "REQUIRED_FOR_RECORD";
}

/** Built-in + custom keys for voiceV2Intake.fields from wizard collectFields. */
export function wizardCollectFieldsToVoiceV2Intake(
  collectFields: WizardCollectField[],
): VoiceV2IntakeWizardConfig {
  const fields: VoiceV2IntakeWizardConfig["fields"] = {};

  for (const key of BUILTIN_INTAKE_FIELD_KEYS) {
    fields[key] = { enabled: false };
  }

  for (const f of collectFields) {
    const intakeKey = callerFieldIdToIntakeKey(wizardCollectFieldIdToCallerRowId(f.id));
    const enabled = f.enabled !== false;
    const level = requirementLevel(f, intakeKey);

    if (BUILTIN_INTAKE_FIELD_KEYS.includes(intakeKey as BuiltinIntakeFieldKey)) {
      fields[intakeKey as BuiltinIntakeFieldKey] = {
        enabled,
        requirementLevel: level,
        label: f.label?.trim() || undefined,
      };
      continue;
    }

    if (!enabled) continue;
    fields[intakeKey] = {
      enabled: true,
      requirementLevel: level,
      label: f.label?.trim() || intakeKey,
      questionText: `What is your ${(f.label || intakeKey).toLowerCase()}?`,
    };
  }

  return { fields };
}

export function mergeAppointmentWizardAdvanced(
  state: AppointmentReceptionistWizardState,
  existingAdvanced: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const defaults = createDefaultAdvancedSettings();
  const prev = (existingAdvanced?.receptionistAdvanced as typeof defaults | undefined) ?? defaults;
  const callerFields = wizardCollectFieldsToCallerRows(state.collectFields || []);
  const voiceV2Intake = wizardCollectFieldsToVoiceV2Intake(state.collectFields || []);

  const books = state.capabilities.includes("book_appointments");

  return {
    ...(existingAdvanced || {}),
    capabilityPack: "appointment_receptionist",
    conversationWorkflowMode: true,
    voiceV2PstnLiveBooking: books,
    voiceV2Intake,
    receptionistAdvanced: {
      ...prev,
      callerFields,
      conversationBehavior: {
        ...prev.conversationBehavior,
        avoidDuplicateQuestions: true,
        handleOutOfOrderAnswers: true,
        confirmImportantDetails: state.conversationBehaviors?.confirmDetails ?? true,
      },
      bookingPolicy: {
        ...prev.bookingPolicy,
        askPreferredDayFirst: state.bookingBehavior?.askPreferredDayFirst ?? true,
        offerEarliestAvailability: state.bookingBehavior?.offerEarliestThree ?? false,
        confirmDateTimeVerbally: state.bookingBehavior?.confirmBeforeBooking ?? true,
        sendSmsConfirmation: state.bookingBehavior?.sendSmsAfterBooking ?? false,
        slotsToOffer: state.bookingBehavior?.offerEarliestThree ? 3 : 2,
      },
      transferPolicy: {
        ...prev.transferPolicy,
        destinationE164: state.transferDestinationPhone?.trim() || prev.transferPolicy.destinationE164,
        warmTransfer: state.warmTransfer ?? prev.transferPolicy.warmTransfer,
      },
      actionPermissions: {
        ...prev.actionPermissions,
        bookAppointments: state.capabilities.includes("book_appointments"),
        rescheduleAppointments: state.capabilities.includes("reschedule"),
        cancelAppointments: state.capabilities.includes("cancel"),
        takeMessages: state.capabilities.includes("take_messages"),
        sendSms:
          state.capabilities.includes("send_sms_confirmations") ||
          state.bookingBehavior?.sendSmsAfterBooking,
        transferCalls: state.capabilities.includes("transfer_calls"),
        updateContact: true,
      },
    },
  };
}
