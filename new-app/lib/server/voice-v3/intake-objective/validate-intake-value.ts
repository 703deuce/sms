import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import type { IntakeFieldDefinition } from "../config/agent-config";
import type { CapturedField } from "../state/call-context";
import type { IntakeFieldRejection, IntakeFieldRejectionCode } from "./types";
import { defaultCollectionStrategy } from "./types";
import { isLlmPlaceholderString } from "./coerce-llm-literal";

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reject(
  field: string,
  code: IntakeFieldRejectionCode,
  message: string,
): IntakeFieldRejection {
  return { field, code, message };
}

export function normalizeIntakeStringValue(raw: string): string {
  return raw.trim();
}

export function validateAndNormalizeIntakeValue(
  field: IntakeFieldDefinition,
  raw: string,
): { ok: true; value: string } | { ok: false; rejection: IntakeFieldRejection } {
  const trimmed = normalizeIntakeStringValue(raw);
  if (!trimmed && field.type !== "text") {
    return {
      ok: false,
      rejection: reject(field.key, "EMPTY_VALUE", "Value cannot be empty."),
    };
  }
  if (!trimmed) {
    return {
      ok: false,
      rejection: reject(field.key, "EMPTY_VALUE", "Value cannot be empty."),
    };
  }

  switch (field.type) {
    case "email": {
      const normalized = trimmed.toLowerCase();
      if (!EMAIL_RE.test(normalized)) {
        return {
          ok: false,
          rejection: reject(field.key, "INVALID_FORMAT", "Email format is invalid."),
        };
      }
      return { ok: true, value: normalized };
    }
    case "phone": {
      if (isLlmPlaceholderString(trimmed)) {
        return {
          ok: false,
          rejection: reject(field.key, "EMPTY_VALUE", "Value cannot be empty."),
        };
      }
      const e164 = normalizePhoneE164(trimmed);
      if (!e164) {
        return {
          ok: false,
          rejection: reject(field.key, "INVALID_FORMAT", "Phone number is too short."),
        };
      }
      return { ok: true, value: e164 };
    }
    case "number": {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        return {
          ok: false,
          rejection: reject(field.key, "INVALID_FORMAT", "Expected a number."),
        };
      }
      return { ok: true, value: String(n) };
    }
    case "date":
    case "time":
    case "text":
    default: {
      if (field.enumValues?.length && !field.enumValues.includes(trimmed)) {
        return {
          ok: false,
          rejection: reject(field.key, "INVALID_ENUM", "Value is not an allowed option."),
        };
      }
      return { ok: true, value: trimmed };
    }
  }
}

/** Type-aware: false and 0 can be valid when stored as captured strings. */
export function hasUsableCapturedValue(
  field: IntakeFieldDefinition,
  captured: CapturedField | undefined,
): boolean {
  if (!captured) return false;
  const v = captured.value;
  if (v === "false" || v === "0") return true;
  if (!v || !v.trim()) return false;
  return true;
}

export function verificationRequiredForField(
  field: IntakeFieldDefinition,
): boolean {
  return field.verificationRequired === true;
}

export function intakeFieldStatusFromCapture(
  field: IntakeFieldDefinition,
  captured: CapturedField | undefined,
): import("./types").IntakeFieldStatus {
  if (!captured || captured.verificationStatus === "declined") {
    return captured?.verificationStatus === "declined" ? "DECLINED" : "MISSING";
  }
  if (!hasUsableCapturedValue(field, captured)) return "MISSING";

  const explicit = captured.verificationStatus;
  if (explicit === "verified") return "VERIFIED";
  if (explicit === "candidate") return "CANDIDATE";
  if (explicit === "collected") return "COLLECTED";

  const strategy = defaultCollectionStrategy(field);
  if (strategy === "voice_email" && verificationRequiredForField(field)) {
    return "CANDIDATE";
  }
  return "COLLECTED";
}

/** User-facing objective label — simple for standard fields; rich only when verification applies. */
export function intakeFieldObjectiveLabel(
  field: IntakeFieldDefinition,
  captured: CapturedField | undefined,
): string {
  const status = intakeFieldStatusFromCapture(field, captured);
  if (status === "MISSING" || status === "DECLINED") return "missing";
  if (verificationRequiredForField(field)) {
    if (status === "VERIFIED") return "verified";
    if (status === "CANDIDATE") return "candidate (needs confirmation)";
    return "collected";
  }
  return "collected";
}

export function fieldSatisfiesObjectiveRequirement(
  field: IntakeFieldDefinition,
  captured: CapturedField | undefined,
): boolean {
  const status = intakeFieldStatusFromCapture(field, captured);
  if (status === "DECLINED" || status === "MISSING") return false;
  if (verificationRequiredForField(field)) {
    return status === "VERIFIED";
  }
  return status === "COLLECTED" || status === "VERIFIED";
}
