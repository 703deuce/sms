# Voice V3 intake — full source snapshot (copyable)

Snapshot of the **production intake stack**: bulk `update_intake` (name, email, phone, custom wizard fields in one call), per-field `set_intake_*` tools, `collect_intake_field`, schema build, merge, and validation.

**Canonical paths in repo** — this file duplicates source for offline copy/paste. Imports (`@/lib/...`) are unchanged from production.

## Example bulk tool call (model → Node)

For an agent with fields `name`, `phone`, `email`, `service_reason`, `favorite_dinosaur`:

```json
{
  "name": "Anthony Johnson",
  "phone": "+15551234567",
  "email": "anthony@example.com",
  "service_reason": null,
  "favorite_dinosaur": "Triceratops"
}
```

- Non-null keys are validated and merged into call state.
- `null` keys mean “caller did not provide this turn” — **existing saved values are kept**.

---


## update_intake tool description (OpenAI)

`new-app/lib/server/voice-v3/tools/astra-tool-contracts.ts`

```typescript
export const UPDATE_INTAKE_TOOL_DESCRIPTION = `Save one or more pieces of caller-provided information in the authoritative state for the current call. Use this whenever the caller clearly provides or corrects configured caller/intake information such as their name, email address, phone number, service reason, or another configured business field. When the caller clearly provides or corrects such information, call this tool during the current delegated work rather than intentionally carrying that information only in conversation for later persistence. Save every clearly provided configured field from the same caller statement in one call when possible. Fields may be provided in any order. If the caller clearly corrects an earlier value, save the newest clear value. Do not guess incomplete or uncertain information. This function updates caller/intake information only. It does not search availability, find an existing appointment, book, reschedule, cancel, transfer, or end the call. Do not use it merely because the caller mentions a scheduling date or time.`;
```

## Intake field types (config)

`new-app/lib/server/voice-v3/config/agent-config.ts` (excerpt)

```typescript
export type IntakeFieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "time";

export type IntakeCollectionStrategy =
  | "standard"
  | "voice_email"
  | "voice_phone"
  | "voice_address"
  | "voice_date";

export interface IntakeFieldDefinition {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  description: string;
  collectionStrategy?: IntakeCollectionStrategy;
  verificationRequired?: boolean;
  enumValues?: string[];
}
```

## Wizard → intakeFields

`/workspace/new-app/lib/server/voice-v3/config/wizard-collect-fields-v3.ts`

```typescript
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

```

## Bulk schema + normalize

`/workspace/new-app/lib/server/voice-v3/intake-objective/build-intake-tool-schema.ts`

```typescript
import { z } from "zod";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isLlmPlaceholderString } from "./coerce-llm-literal";

const SEMANTIC_HINTS: Record<string, string> = {
  name: "Caller's full name as clearly provided or corrected.",
  email: "Caller's email address as clearly provided or corrected.",
  phone: "Caller's phone number when explicitly provided or corrected.",
  service_reason: "Reason the caller needs service or assistance.",
};

export function intakeFieldSchemaDescription(field: VoiceV3AgentConfig["intakeFields"][number]): string {
  const hint =
    field.description?.trim() ||
    SEMANTIC_HINTS[field.key] ||
    `${field.label} (${field.type})`;
  const enumNote =
    field.enumValues?.length
      ? ` Allowed values: ${field.enumValues.join(", ")}.`
      : "";
  return `${field.required ? "Configured intake" : "Optional intake"}: ${hint}${enumNote} Null if caller did not provide or correct this field in this turn.`;
}

function zodNullableFieldSchema(field: VoiceV3AgentConfig["intakeFields"][number]): z.ZodNullable<z.ZodType<string>> {
  const desc = intakeFieldSchemaDescription(field);
  if (field.enumValues && field.enumValues.length > 0) {
    return z.enum(field.enumValues as [string, ...string[]]).nullable().describe(desc);
  }
  return z.string().nullable().describe(desc);
}

export function buildUpdateIntakeZodSchema(config: VoiceV3AgentConfig) {
  const fieldShape: Record<string, z.ZodNullable<z.ZodType<string>>> = {};
  for (const f of config.intakeFields) {
    fieldShape[f.key] = zodNullableFieldSchema(f);
  }
  return z.object(fieldShape);
}

export function normalizeUpdateIntakeArguments(
  config: VoiceV3AgentConfig,
  raw: unknown,
): Record<string, unknown> {
  const row =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  for (const f of config.intakeFields) {
    if (!(f.key in row)) {
      row[f.key] = null;
      continue;
    }
    const v = row[f.key];
    if (typeof v === "string" && isLlmPlaceholderString(v)) {
      row[f.key] = null;
    }
  }
  return row;
}

```

## LLM placeholder coercion

`/workspace/new-app/lib/server/voice-v3/intake-objective/coerce-llm-literal.ts`

```typescript
import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";

const PLACEHOLDER_LITERALS = new Set([
  "null",
  "none",
  "n/a",
  "na",
  "undefined",
  "unknown",
  "not provided",
  "not applicable",
]);

/** Model sometimes emits JSON-null semantics as strings under strict tool schemas. */
export function isLlmPlaceholderString(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_LITERALS.has(lower)) return true;
  // Single punctuation / stray JSON token (e.g. "}") — not a phone number.
  if (trimmed.length <= 2 && !/\d/.test(trimmed)) return true;
  return false;
}

/**
 * Optional tool phone argument: drop placeholders and normalize spoken US numbers to E.164.
 * Returns undefined when the model should have omitted the field (use ANI / intake fallback).
 */
export function coerceOptionalToolPhoneArg(
  raw: string | null | undefined,
): string | null | undefined {
  if (raw === null || raw === undefined) return raw;
  if (isLlmPlaceholderString(raw)) return undefined;
  const normalized = normalizePhoneE164(raw);
  return normalized ?? undefined;
}

```

## Validate + normalize per type

`/workspace/new-app/lib/server/voice-v3/intake-objective/validate-intake-value.ts`

```typescript
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

```

## Merge bulk update (core)

`/workspace/new-app/lib/server/voice-v3/intake-objective/merge-intake-update.ts`

```typescript
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
      confidence: 1,
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

```

## LiveKit field kind map

`/workspace/new-app/lib/server/voice-v3/intake-objective/resolve-intake-collection-kind.ts`

```typescript
import type { IntakeFieldDefinition } from "../config/agent-config";

export type IntakeCollectionKind =
  | "livekit_get_name"
  | "livekit_get_email"
  | "livekit_get_phone"
  | "livekit_get_address"
  | "livekit_get_dob"
  | "livekit_function_tool";

const STANDARD_FIELD_TO_COLLECTION: Record<string, IntakeCollectionKind> = {
  name: "livekit_get_name",
  full_name: "livekit_get_name",
  email: "livekit_get_email",
  phone: "livekit_get_phone",
  service_reason: "livekit_function_tool",
  address: "livekit_get_address",
  dob: "livekit_get_dob",
  date_of_birth: "livekit_get_dob",
};

/** Mirrors voice-runtime-python/transovo_voice/voice_v3/intake_collection.py */
export function resolveIntakeCollectionKind(field: IntakeFieldDefinition): IntakeCollectionKind {
  const key = field.key.trim().toLowerCase();
  const fieldType = field.type.trim().toLowerCase();
  if (key in STANDARD_FIELD_TO_COLLECTION) {
    return STANDARD_FIELD_TO_COLLECTION[key];
  }
  if (fieldType === "email") return "livekit_get_email";
  if (fieldType === "phone") return "livekit_get_phone";
  if (fieldType === "name") return "livekit_get_name";
  if (fieldType === "address") return "livekit_get_address";
  if (fieldType === "date" || fieldType === "dob") return "livekit_get_dob";
  return "livekit_function_tool";
}

export function hasLiveKitActiveCollector(field: IntakeFieldDefinition): boolean {
  return resolveIntakeCollectionKind(field) !== "livekit_function_tool";
}

```

## Shared caller facts after save

`/workspace/new-app/lib/server/voice-v3/intake-objective/build-shared-caller-facts.ts`

```typescript
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { resolveStoredIntakeString } from "./resolve-stored-intake";

/**
 * Compact summary for Live thinking/commentary — authoritative values already on file.
 * Helps Live avoid re-asking and answer "do you already have my name?" correctly.
 */
export function buildSharedCallerFactsLiveSummary(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string {
  const lines: string[] = [];
  for (const field of config.intakeFields) {
    const value = resolveStoredIntakeString(context.intake.values, field.key);
    if (!value) continue;
    lines.push(`- ${field.label} (${field.key}): ${value}`);
  }
  const ani = context.telephony.inboundCallerE164?.trim();
  if (ani && !resolveStoredIntakeString(context.intake.values, "phone")) {
    lines.push(`- Inbound caller ID (ANI): ${ani}`);
  }
  if (lines.length === 0) {
    return "SHARED CALLER FACTS (authoritative): (none persisted yet for this call)";
  }
  return [
    "SHARED CALLER FACTS (authoritative — reuse; do not ask again unless the caller wants to change them):",
    ...lines,
  ].join("\n");
}

```

## update_intake tool (execute)

`/workspace/new-app/lib/server/voice-v3/tools/update-intake-tool.ts`

```typescript
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import {
  buildIntakeObjectiveContext,
  buildUpdateIntakeZodSchema,
  deriveIntakeObjective,
  mergeIntakeUpdate,
  normalizeUpdateIntakeArguments,
} from "../intake-objective";
import { hasLiveKitActiveCollector } from "../intake-objective/resolve-intake-collection-kind";
import { logIntakeTelemetry } from "../intake-objective/telemetry";
import { buildSharedCallerFactsLiveSummary } from "../intake-objective/build-shared-caller-facts";
import { LiveContextPublisher } from "../live/live-context-publisher";
import { UPDATE_INTAKE_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";

export type UpdateIntakeArgs = Record<string, unknown>;

export function buildUpdateIntakeOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "update_intake",
    parameters: buildUpdateIntakeZodSchema(config),
    description: UPDATE_INTAKE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const updateIntakeTool: VoiceToolDefinition<UpdateIntakeArgs> = {
  name: "update_intake",
  description: "update_intake",
  parameters: {},
  validate: (raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("expected object");
    }
    return raw as UpdateIntakeArgs;
  },
  execute: async (ctx, raw) => {
    const config = ctx.runtime.config;
    const schema = buildUpdateIntakeZodSchema(config);
    const normalized = normalizeUpdateIntakeArguments(config, raw);
    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
      return voiceToolError(
        "INVALID_ARGUMENTS",
        "Intake update arguments are invalid.",
        { issues: parsed.error.issues.map((i) => i.message) },
      );
    }

    const started = Date.now();
    const snap = ctx.runtime.getSnapshot();
    const priorObjective = deriveIntakeObjective(config, snap);

    logIntakeTelemetry("INTAKE_UPDATE_REQUESTED", {
      call_id: ctx.callId,
      delegation_id: ctx.delegationId,
      function_call_id: ctx.functionCallId,
      objective_status: priorObjective.status,
    });

    const updatePayload: Record<string, string | null> = {};
    for (const field of config.intakeFields) {
      const v = parsed.data[field.key as keyof typeof parsed.data];
      updatePayload[field.key] = typeof v === "string" ? v : null;
    }

    const merged = mergeIntakeUpdate({
      current: snap.intake.values,
      update: updatePayload,
      config,
      at: new Date(),
      sourceCallId: ctx.callId,
      sourceDelegationId: ctx.delegationId,
    });

    if (merged.updatedFields.length === 0 && merged.rejectedFields.length === 0) {
      const objective = deriveIntakeObjective(config, snap);
      return toolOk("INTAKE_UPDATED", {
        updated_fields: [],
        rejected_fields: [],
        missing_required_fields: objective.missingRequiredFields,
        objective: {
          status: objective.status,
          missing_required_fields: objective.missingRequiredFields,
        },
        state_version: snap.runtime.version,
      });
    }

    logIntakeTelemetry("INTAKE_UPDATE_VALIDATED", {
      call_id: ctx.callId,
      delegation_id: ctx.delegationId,
      function_call_id: ctx.functionCallId,
      duration_ms: Date.now() - started,
    });

    const nextContext = {
      ...snap,
      updatedAt: new Date().toISOString(),
      intake: { values: merged.values },
      runtime: { version: snap.runtime.version + 1 },
    };
    ctx.runtime.replaceContext(nextContext);

    const after = ctx.runtime.getSnapshot();
    const objective = deriveIntakeObjective(config, after);

    if (merged.fieldsChanged.length > 0) {
      logIntakeTelemetry("INTAKE_FIELDS_UPDATED", {
        call_id: ctx.callId,
        delegation_id: ctx.delegationId,
        function_call_id: ctx.functionCallId,
        updated_field_names: merged.fieldsChanged,
        objective_status: objective.status,
        duration_ms: Date.now() - started,
      });
    }
    if (merged.rejectedFields.length > 0) {
      logIntakeTelemetry("INTAKE_FIELDS_REJECTED", {
        call_id: ctx.callId,
        delegation_id: ctx.delegationId,
        function_call_id: ctx.functionCallId,
        rejected_field_names: merged.rejectedFields.map((r) => r.field),
      });
    }
    if (objective.status !== priorObjective.status) {
      logIntakeTelemetry(
        objective.status === "COMPLETE"
          ? "INTAKE_OBJECTIVE_COMPLETED"
          : "INTAKE_OBJECTIVE_CHANGED",
        {
          call_id: ctx.callId,
          delegation_id: ctx.delegationId,
          missing_required_field_names: objective.missingRequiredFields,
          objective_status: objective.status,
        },
      );
    }

    const publisher = new LiveContextPublisher(ctx.sendContext);
    publisher.appendThinking(buildIntakeObjectiveContext(config, after), ctx.delegationId);
    publisher.appendCommentary(
      buildSharedCallerFactsLiveSummary(config, after),
      ctx.delegationId,
    );

    if (merged.updatedFields.length === 0 && merged.rejectedFields.length > 0) {
      return voiceToolError(
        "INVALID_INTAKE_FIELD",
        "One or more intake fields could not be saved.",
        {
          rejected_fields: merged.rejectedFields,
          missing_required_fields: objective.missingRequiredFields,
        },
        "error",
        false,
      );
    }

    return toolOk("INTAKE_UPDATED", {
      updated_fields: merged.updatedFields,
      rejected_fields: merged.rejectedFields.map((r) => {
        const field = config.intakeFields.find((f) => f.key === r.field);
        const suggestCollect =
          field &&
          (r.code === "INVALID_FORMAT" || r.code === "EMPTY_VALUE") &&
          hasLiveKitActiveCollector(field)
            ? { use_collect_intake_field: true, field_key: r.field }
            : undefined;
        return {
          field: r.field,
          code: r.code,
          ...(suggestCollect ? { recovery: suggestCollect } : {}),
        };
      }),
      missing_required_fields: objective.missingRequiredFields,
      objective: {
        status: objective.status,
        missing_required_fields: objective.missingRequiredFields,
      },
      state_version: after.runtime.version,
    });
  },
};

```

## Per-field + collect_intake_field tools

`/workspace/new-app/lib/server/voice-v3/tools/livekit-intake-tool-schemas.ts`

```typescript
import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { IntakeFieldDefinition, VoiceV3AgentConfig } from "../config/agent-config";
import { intakeFieldSchemaDescription } from "../intake-objective/build-intake-tool-schema";
import {
  hasLiveKitActiveCollector,
  resolveIntakeCollectionKind,
} from "../intake-objective/resolve-intake-collection-kind";

export const COLLECT_INTAKE_FIELD_TOOL_NAME = "collect_intake_field";

/** Stable LiveKit function name for one wizard intake field (passive capture). */
export function liveKitIntakeFieldToolName(fieldKey: string): string {
  const safe = fieldKey.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "field";
  return `set_intake_${safe}`;
}

function passiveFieldToolDescription(field: IntakeFieldDefinition): string {
  const base = `Record the caller's ${field.label} when they clearly provide or correct it in conversation. Persist by field id \`${field.key}\`. Do not use for scheduling dates/times — use set_scheduling_preference. Prefer update_intake when multiple intake fields are supplied in one statement.`;
  if (!hasLiveKitActiveCollector(field)) {
    return base;
  }
  const kind = resolveIntakeCollectionKind(field);
  const taskHint =
    kind === "livekit_get_phone"
      ? "GetPhoneNumberTask"
      : kind === "livekit_get_email"
        ? "GetEmailTask"
        : kind === "livekit_get_name"
          ? "GetNameTask"
          : kind === "livekit_get_address"
            ? "GetAddressTask"
            : "GetDOBTask";
  return `${base} When you need to ask the caller for this field and it is not already persisted, use collect_intake_field (LiveKit ${taskHint}) instead of guessing digits or spelling in this tool.`;
}

function buildPassiveFieldTool(field: IntakeFieldDefinition): FunctionTool {
  const toolName = liveKitIntakeFieldToolName(field.key);
  const zodTool = zodResponsesFunction({
    name: toolName,
    parameters: z.object({
      value: z
        .string()
        .nullable()
        .describe(
          `${intakeFieldSchemaDescription(field)} Use null if the caller did not clearly provide this value in this turn.`,
        ),
    }),
    description: passiveFieldToolDescription(field),
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

function buildCollectIntakeFieldTool(config: VoiceV3AgentConfig): FunctionTool | null {
  const keys = config.intakeFields.map((f) => f.key).filter(Boolean);
  if (keys.length === 0) return null;

  const keyEnum = z.enum(keys as [string, ...string[]]);
  const zodTool = zodResponsesFunction({
    name: COLLECT_INTAKE_FIELD_TOOL_NAME,
    parameters: z.object({
      field_key: keyEnum.describe(
        "Configured intake field to actively collect and validate when still missing and required for the current business action.",
      ),
    }),
    description:
      "Actively collect and validate ONE missing configured intake field using LiveKit prebuilt tasks (name, email, phone, address, date of birth). Use when you are asking the caller for that specific field and it is not already persisted — not for facts they clearly volunteered in the same turn (use update_intake for multi-field statements). Do not use for calendar scheduling semantics or free-text custom fields without a LiveKit task.",
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

/** LiveKit-native intake tools: per-field passive capture + active collection helper. */
export function buildLiveKitIntakeFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  if (!config.capabilities?.collectIntake && config.intakeFields.length === 0) {
    return [];
  }
  const tools: FunctionTool[] = config.intakeFields.map((f) => buildPassiveFieldTool(f));
  const collect = buildCollectIntakeFieldTool(config);
  if (collect) tools.push(collect);
  return tools;
}

/** Field metadata for the Python worker (task routing + persistence keys). */
export function buildLiveKitIntakeFieldMetadata(config: VoiceV3AgentConfig) {
  return config.intakeFields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    collectionStrategy: f.collectionStrategy ?? "standard",
    enumValues: f.enumValues ?? null,
    liveKitToolName: liveKitIntakeFieldToolName(f.key),
  }));
}

```
