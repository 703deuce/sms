import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { validateServiceArea, type ServiceAreaConfig } from "@/lib/voice/eligibility/validate";
import { setEligibility } from "@/lib/voice/session-runtime/state";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";
import { SYSTEM_FIELD_IDS } from "@/lib/voice/field-runtime/system-fields";
import { recordFieldsForLiveKitVoice } from "@/lib/voice/field-runtime/save-voice-fast";
import { prepareFieldsForPersistence } from "@/lib/voice/workflow-runtime/field-persist";

function looksLikePlaceholderAddress(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (!lower) return true;
  if (/^(the |my |your |caller'?s? )?(service )?address[.!]?$/.test(lower)) return true;
  if (/service address$/i.test(lower) && !/\d/.test(lower)) return true;
  if (lower.includes("address") && !/\d/.test(lower) && !/,/.test(lower) && lower.length < 24) {
    return true;
  }
  return false;
}

function loadServiceAreaConfig(ctx: LiveKitCallContext): ServiceAreaConfig {
  const meta = (ctx.workflowDefinition?.metadata || {}) as Record<string, unknown>;
  const serviceAreas = meta.serviceAreas as ServiceAreaConfig | undefined;
  if (serviceAreas) return serviceAreas;

  const agentConfig = (ctx.session as { serviceAreaConfig?: ServiceAreaConfig }).serviceAreaConfig;
  return agentConfig || {};
}

export async function domainValidateEligibility(input: {
  ctx: LiveKitCallContext;
  address?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "validate_eligibility");
  if (blocked) return blocked;

  let address =
    input.address ||
    input.ctx.session.collectedFields.sys_address ||
    input.ctx.session.collectedFields.service_address ||
    input.ctx.session.collectedFields.fld_service_address ||
    null;

  if (input.address?.trim() && looksLikePlaceholderAddress(input.address)) {
    address =
      input.ctx.session.collectedFields.sys_address ||
      input.ctx.session.collectedFields.service_address ||
      input.ctx.session.collectedFields.fld_service_address ||
      null;
  } else if (input.address?.trim()) {
    const addressFieldId =
      input.ctx.session.fieldManifest.find(
        (f) =>
          f.field_id === "fld_service_address" ||
          f.field_id === SYSTEM_FIELD_IDS.address ||
          f.type === "address",
      )?.field_id || SYSTEM_FIELD_IDS.address;

    const prepared = prepareFieldsForPersistence({
      session: input.ctx.session,
      extracted: { [addressFieldId]: input.address.trim() },
    });

    if (Object.keys(prepared.fields).length) {
      const recorded = await recordFieldsForLiveKitVoice({
        amySession: input.ctx.session,
        fields: prepared.fields,
      });
      if (recorded.ok) {
        input.ctx.session = recorded.amySession;
        address = prepared.fields[addressFieldId] || input.address.trim();
      }
    }
  }

  const outcome = validateServiceArea({
    address,
    config: loadServiceAreaConfig(input.ctx),
  });

  input.ctx.session = setEligibility(input.ctx.session, outcome);

  if (outcome.status === "out_of_area") {
    return structuredFailure({
      speak: outcome.message || "That address is outside our service area.",
      code: "OUT_OF_SERVICE_AREA",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["take_message", "end_call"],
      data: { eligibility: outcome },
    });
  }

  return structuredSuccess({
    speak: outcome.message || "You're in our service area.",
    workflowState: input.ctx.session.currentState,
    data: { eligibility: outcome },
    nextAllowedActions: ["check_availability", "record_current_field"],
  });
}

export async function domainClassifyIntent(input: {
  ctx: LiveKitCallContext;
  utterance?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "classify_intent");
  if (blocked) return blocked;

  const { inferClassifications, evaluateQualificationRules } = await import(
    "@/lib/voice/rules-engine/evaluate"
  );
  const rules =
    ((input.ctx.workflowDefinition?.metadata || {}) as { qualificationRules?: unknown })
      .qualificationRules || [];

  const classifications = inferClassifications({
    collectedFields: input.ctx.session.collectedFields,
    utterance: input.utterance,
  });

  const { patchSessionRuntimeExt } = await import("@/lib/voice/session-runtime/state");
  input.ctx.session = patchSessionRuntimeExt(input.ctx.session, { classifications });

  const evaluation = evaluateQualificationRules(
    Array.isArray(rules) ? rules : [],
    { classifications, collectedFields: input.ctx.session.collectedFields },
  );

  if (
    classifications.urgency === "emergency" ||
    classifications.safety === "gas_smell"
  ) {
    input.ctx.session = patchSessionRuntimeExt(input.ctx.session, {
      classifications,
      currentTask: "TransferTask",
    });
  }

  if (evaluation.primaryAction?.action === "transfer") {
    return structuredSuccess({
      speak: evaluation.primaryAction.message || "This sounds urgent. Let me connect you right away.",
      data: { classifications, evaluation },
      nextAllowedActions: ["request_human"],
    });
  }

  return structuredSuccess({
    speak: "Got it.",
    data: { classifications, evaluation },
    nextAllowedActions: ["record_current_field", "check_availability", "validate_eligibility"],
  });
}
