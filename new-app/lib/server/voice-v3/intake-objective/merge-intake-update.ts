import type { CapturedField } from "../state/call-context";
import type { IntakeFieldDefinition } from "../config/agent-config";
import {
  fieldDefinitionByKey,
  type MergeIntakeUpdateInput,
  type MergeIntakeUpdateResult,
} from "./types";
import { defaultCollectionStrategy } from "./types";
import { verificationRequiredForField } from "./validate-intake-value";
import { validateAndNormalizeIntakeValue } from "./validate-intake-value";

function nextVerificationStatus(
  field: IntakeFieldDefinition,
  existing: CapturedField | undefined,
  newValue: string,
): CapturedField["verificationStatus"] {
  const strategy = defaultCollectionStrategy(field);
  const needsVerify = verificationRequiredForField(field);

  if (strategy === "voice_email" && needsVerify) {
    if (existing?.verificationStatus === "verified" && existing.value === newValue) {
      return "verified";
    }
    if (existing?.verificationStatus === "candidate" && existing.value === newValue) {
      return "verified";
    }
    return "candidate";
  }

  return "collected";
}

export function mergeIntakeUpdate(input: MergeIntakeUpdateInput): MergeIntakeUpdateResult {
  const values = { ...input.current };
  const updatedFields: string[] = [];
  const rejectedFields: MergeIntakeUpdateResult["rejectedFields"] = [];
  const fieldsChanged: string[] = [];
  const updatedAt = input.at.toISOString();

  for (const [key, raw] of Object.entries(input.update)) {
    if (raw === null || raw === undefined) continue;

    const field = fieldDefinitionByKey(input.config, key);
    if (!field) {
      rejectedFields.push({
        field: key,
        code: "UNKNOWN_FIELD",
        message: "Field is not configured for this agent.",
      });
      continue;
    }

    const validated = validateAndNormalizeIntakeValue(field, String(raw));
    if (!validated.ok) {
      rejectedFields.push(validated.rejection);
      continue;
    }

    const existing = values[key];
    const verificationStatus = nextVerificationStatus(field, existing, validated.value);
    const valueChanged = existing?.value !== validated.value;

    values[key] = {
      value: validated.value,
      source: "caller",
      confidence: 0.85,
      updatedAt,
      revision: valueChanged ? (existing?.revision ?? 0) + 1 : (existing?.revision ?? 0),
      verificationStatus,
    };

    updatedFields.push(key);
    if (valueChanged || !existing) {
      fieldsChanged.push(key);
    }
  }

  return {
    values,
    updatedFields,
    rejectedFields,
    fieldsChanged,
  };
}
