import "server-only";

import type { CallerFieldRow } from "@/lib/receptionist-wizard/advanced-types";
import { createDefaultAdvancedSettings } from "@/lib/receptionist-wizard/advanced-defaults";
import type { VoiceV2IntakeWizardConfig } from "@/lib/voice-receptionist-wizard/intake/wizard-config";
import {
  BUILTIN_INTAKE_FIELD_KEYS,
  type BuiltinIntakeFieldKey,
  type IntakeRequirementLevel,
} from "@/lib/voice-receptionist-wizard/intake/types";
import { callerFieldIdToIntakeKey } from "@/lib/voice-receptionist-wizard/intake/compile-schema";
import { validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import { calendlyConfigFromWizard } from "@/lib/voice-receptionist-wizard/calendly-booking-config";
import { knowledgeConfigFromWizard } from "@/lib/voice-receptionist-wizard/knowledge-config";
import { qualificationConfigFromWizard } from "@/lib/voice-receptionist-wizard/qualification-config";
import {
  afterHoursHandlingFromWizard,
  validateAfterHoursHandlingWizard,
} from "@/lib/voice-receptionist-wizard/after-hours-handling-config";
import { DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG } from "@/lib/voice-receptionist-wizard/ai-call-recovery/types";
import { ensureWizardOperatingMaturity } from "./operating-maturity-wizard";
import type { AppointmentReceptionistWizardState } from "./types";
import { wizardCollectFieldIdToCallerRowId } from "./wizard-collect-field-id";

type WizardCollectField = AppointmentReceptionistWizardState["collectFields"][number];

export { wizardCollectFieldIdToCallerRowId } from "./wizard-collect-field-id";

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
      useForQualification: f.useForQualification === true,
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

  const bookingStrategy = deriveBookingStrategyFromWizard(state);
  const voiceV2PstnLiveBooking = false;
  const voiceV2Calendly = calendlyConfigFromWizard(state);
  const draftKbIds = Array.isArray(existingAdvanced?.knowledgeBaseIds)
    ? (existingAdvanced.knowledgeBaseIds as string[]).map(String).filter(Boolean)
    : [];
  const knowledge = knowledgeConfigFromWizard(state, draftKbIds);
  const knowledgeBaseIds = knowledge.knowledgeBaseIds.length
    ? knowledge.knowledgeBaseIds
    : draftKbIds;
  const qualification = qualificationConfigFromWizard(state);
  const voiceV2AfterHoursHandling = afterHoursHandlingFromWizard(state);
  const afterHoursValidation = validateAfterHoursHandlingWizard(state);
  if (afterHoursValidation.length) {
    throw new Error(`voice_v2_after_hours_invalid:${afterHoursValidation.join(",")}`);
  }
  const linkRaw = String(state.bookingLinkUrl || "").trim();
  const linkValidated = linkRaw ? validateBookingLinkUrl(linkRaw) : null;
  const bookingLink =
    bookingStrategy === "SEND_LINK" && linkValidated?.ok ? linkValidated.url : undefined;
  const bookingLinkLabel =
    bookingStrategy === "SEND_LINK"
      ? String(state.bookingLinkLabel || "Book your appointment").trim()
      : undefined;

  const voiceV2OperatingMaturity = ensureWizardOperatingMaturity(state);

  const voiceV2AiCallRecovery = {
    ...DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG,
    enabled: state.aiCallRecoveryEnabled === true,
    consentMode: state.aiCallRecoveryConsentMode || "DISABLED",
    sendingPhoneNumberId: state.aiCallRecoverySendingPhoneNumberId || null,
    continueOverSms: state.aiCallRecoveryContinueOverSms !== false,
    delaySeconds: state.aiCallRecoveryDelaySeconds ?? 0,
    sendWhenCallbackAlreadyCreated: state.aiCallRecoverySendWhenCallbackCreated === true,
  };

  return {
    ...(existingAdvanced || {}),
    capabilityPack: "appointment_receptionist",
    voiceV3PstnBooking:
      bookingStrategy === "MICROSOFT_365" && state.capabilities.includes("book_appointments"),
    voiceV2OperatingMaturity,
    voiceV2AiCallRecovery,
    conversationWorkflowMode: true,
    bookingStrategy,
    voiceV2PstnLiveBooking,
    ...(voiceV2Calendly ? { voiceV2Calendly } : {}),
    knowledge,
    qualification,
    voiceV2AfterHoursHandling,
    ...(knowledgeBaseIds.length ? { knowledgeBaseIds } : {}),
    ...(bookingLink ? { bookingLink, bookingLinkLabel } : {}),
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
