import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import {
  captureUsPhoneDigits,
  validateReceptionistFieldValue,
} from "@/lib/voice/receptionist/field-validation";
import { validateBookingNotesField } from "../booking-field-validation";
import { persistConfirmedBookingEmail } from "../booking-email-state";
import { afterReceptionistFieldPersisted } from "../booking-field-coherence";
import type { FrontDeskUserData } from "../userdata";

export type ActiveFieldPersistResult =
  | { status: "saved"; fieldId: string; normalized: string }
  | { status: "incomplete_phone"; digits: string; message: string }
  | { status: "invalid"; fieldId: string; message: string }
  | { status: "no_active_field" }
  | { status: "unknown_field"; fieldId: string };

/**
 * Normalize, validate, and persist a caller transcript for the active collection field.
 * No LLM tool call — runtime owns bookkeeping.
 */
export function persistActiveFieldAnswer(
  ud: FrontDeskUserData,
  activeFieldId: string,
  transcript: string,
  field: AgentFieldDefinition,
  priorPhoneDigits = "",
): ActiveFieldPersistResult {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return {
      status: "invalid",
      fieldId: activeFieldId,
      message: `Please share your ${field.label}.`,
    };
  }

  if (activeFieldId === "email" || field.type === "email") {
    const persisted = persistConfirmedBookingEmail(ud, trimmed);
    if (!persisted.ok) {
      return {
        status: "invalid",
        fieldId: activeFieldId,
        message: "Please say your email address clearly, or spell it if needed.",
      };
    }
    ud.collectionPhoneDigitsBuffer = undefined;
    return { status: "saved", fieldId: activeFieldId, normalized: persisted.email };
  }

  const notesCheck = validateBookingNotesField(activeFieldId, trimmed);
  if (!notesCheck.ok) {
    return {
      status: "invalid",
      fieldId: activeFieldId,
      message: notesCheck.message,
    };
  }

  let normalized: string;
  if (field.type === "phone" || activeFieldId === "phone") {
    const phoneCapture = captureUsPhoneDigits(notesCheck.normalized, priorPhoneDigits);
    if (phoneCapture.status === "incomplete") {
      return {
        status: "incomplete_phone",
        digits: phoneCapture.digits,
        message: phoneCapture.message,
      };
    }
    ud.collectionPhoneDigitsBuffer = undefined;
    normalized = phoneCapture.normalized;
  } else {
    ud.collectionPhoneDigitsBuffer = undefined;
    normalized = validateReceptionistFieldValue(field, notesCheck.normalized);
  }

  if (!ud.receptionistFields) ud.receptionistFields = {};
  const previous = ud.receptionistFields[activeFieldId];
  ud.receptionistFields[activeFieldId] = normalized;
  afterReceptionistFieldPersisted(ud, activeFieldId, normalized, previous);
  if (!ud.authoritativeFieldIds) ud.authoritativeFieldIds = [];
  if (!ud.authoritativeFieldIds.includes(activeFieldId)) {
    ud.authoritativeFieldIds.push(activeFieldId);
  }

  return { status: "saved", fieldId: activeFieldId, normalized };
}
