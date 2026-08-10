import {
  domainSubmitCallerInformation,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { inferFieldsFromUtterance } from "@/lib/voice/workflow-runtime/field-extraction";
import { prepareFieldsForPersistence } from "@/lib/voice/workflow-runtime/field-persist";
import { executeDeterministicPipeline } from "./deterministic-executor";

export type AutoCaptureResult = {
  ctx: LiveKitCallContext;
  applied: boolean;
  speak?: string;
};

/**
 * When the caller provides field values in speech but the model has not invoked
 * capture_caller_information yet, persist inferred values before the LLM turn.
 */
export async function autoCaptureCallerInformationFromUtterance(input: {
  ctx: LiveKitCallContext;
  userText: string;
}): Promise<AutoCaptureResult> {
  const utterance = input.userText.trim();
  if (!utterance) return { ctx: input.ctx, applied: false };

  const { canonical, allowedToolNames } = compileToolsForCallContext(input.ctx);
  if (!allowedToolNames.has("capture_caller_information")) {
    return { ctx: input.ctx, applied: false };
  }

  const missingCount = canonical?.missingFieldIds.length ?? input.ctx.session.missingFieldIds.length;
  if (missingCount === 0) return { ctx: input.ctx, applied: false };

  const inferred = inferFieldsFromUtterance({
    session: input.ctx.session,
    utterance,
  });
  const prepared = prepareFieldsForPersistence({
    session: input.ctx.session,
    extracted: inferred,
    utterance,
    activeFieldId: input.ctx.session.activeField,
  });

  if (prepared.errors.length > 0 || !Object.keys(prepared.fields).length) {
    return { ctx: input.ctx, applied: false };
  }

  let ctx = input.ctx;
  const result = await domainSubmitCallerInformation({
    ctx,
    extractedFields: prepared.fields,
    utterance,
  });

  if (!result.ok) {
    return { ctx, applied: false, speak: result.speak };
  }

  // domainSubmitCallerInformation already reconciled canonical state — do not re-transition.
  compileToolsForCallContext(ctx);

  const pipeline = await executeDeterministicPipeline({
    ctx,
    preferenceSpoken: utterance,
  });
  ctx = pipeline.ctx;

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "auto_capture_caller_information",
      callId: ctx.callId,
      fields: Object.keys(prepared.fields),
      ok: result.ok,
      deterministicSteps: pipeline.steps.map((s) => s.toolName),
    }),
  );

  return {
    ctx,
    applied: true,
    speak: result.speak,
  };
}
