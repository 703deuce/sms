import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3OperationStatus, VoiceV3OperationType } from "./types";
import { beginMutatingOperation, finishMutatingOperation } from "./dispatch-mutations";
import { mapProviderFailureToRecoveryCode } from "./provider-failure-map";

export type AuthoritativeRuntime = {
  getSnapshot: () => VoiceV3CallContext;
  replaceContext: (ctx: VoiceV3CallContext) => void;
};

export type OperationSideEffectResult<T> =
  | { ok: true; value: T }
  | { ok: false; failureCode: string; outcomeUncertain?: boolean };

export function classifyThrownProviderError(error: unknown): {
  failureCode: string;
  outcomeUncertain: boolean;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const outcomeUncertain =
    lower.includes("outcome") && (lower.includes("unknown") || lower.includes("uncertain"));
  return {
    failureCode: mapProviderFailureToRecoveryCode(message),
    outcomeUncertain,
  };
}

function terminalFromFailure(input: {
  failureCode: string;
  outcomeUncertain?: boolean;
}): Exclude<VoiceV3OperationStatus, "PENDING" | "RUNNING"> {
  if (input.outcomeUncertain) return "OUTCOME_UNKNOWN";
  return "FAILED";
}

/**
 * Single lifecycle for FIND / BOOK / RESCHEDULE / CANCEL side effects.
 * Registers RUNNING before `execute`, then exactly one terminal status.
 */
export async function runAuthoritativeOperation<T>(input: {
  runtime: AuthoritativeRuntime;
  operationId: string;
  type: VoiceV3OperationType;
  schedulingGeneration?: number;
  goalId?: string;
  /** Optional context patch applied together with operation start (phase transitions). */
  prepareStart?: (ctx: VoiceV3CallContext) => VoiceV3CallContext;
  isStillAuthoritative: (ctx: VoiceV3CallContext) => boolean;
  execute: () => Promise<OperationSideEffectResult<T>>;
  applySuccess: (ctx: VoiceV3CallContext, value: T) => VoiceV3CallContext;
  applyFailure?: (
    ctx: VoiceV3CallContext,
    terminal: Exclude<VoiceV3OperationStatus, "PENDING" | "RUNNING">,
    failureCode: string,
  ) => VoiceV3CallContext;
}): Promise<OperationSideEffectResult<T>> {
  const { runtime, operationId } = input;
  let started = runtime.getSnapshot();
  if (input.prepareStart) {
    started = input.prepareStart(started);
  }
  started = beginMutatingOperation(started, {
    operationId,
    type: input.type,
    schedulingGeneration: input.schedulingGeneration,
    goalId: input.goalId,
  });
  runtime.replaceContext(started);

  const finish = (
    status: Exclude<VoiceV3OperationStatus, "PENDING" | "RUNNING">,
    failureCode?: string,
  ) => {
    let ctx = finishMutatingOperation(runtime.getSnapshot(), operationId, status, failureCode);
    runtime.replaceContext(ctx);
    return ctx;
  };

  try {
    const effect = await input.execute();

    if (!input.isStillAuthoritative(runtime.getSnapshot())) {
      const terminal = "STALE" as const;
      let ctx = finish(terminal, "stale");
      if (input.applyFailure) {
        ctx = input.applyFailure(ctx, terminal, "stale");
        runtime.replaceContext(ctx);
      }
      return { ok: false, failureCode: "stale", outcomeUncertain: false };
    }

    if (!effect.ok) {
      const terminal = terminalFromFailure(effect);
      let ctx = finish(terminal, effect.failureCode);
      if (input.applyFailure) {
        ctx = input.applyFailure(ctx, terminal, effect.failureCode);
        runtime.replaceContext(ctx);
      }
      return effect;
    }

    let ctx = finish("SUCCEEDED");
    ctx = input.applySuccess(ctx, effect.value);
    runtime.replaceContext(ctx);
    return effect;
  } catch (error) {
    const classified = classifyThrownProviderError(error);
    const terminal = terminalFromFailure(classified);
    let ctx = finish(terminal, classified.failureCode);
    if (input.applyFailure) {
      ctx = input.applyFailure(ctx, terminal, classified.failureCode);
      runtime.replaceContext(ctx);
    }
    return {
      ok: false,
      failureCode: classified.failureCode,
      outcomeUncertain: classified.outcomeUncertain,
    };
  }
}

/** FIND uses the same registry but is read-only — no outcome-unknown on success path. */
export async function runAuthoritativeReadOperation<T>(input: {
  runtime: AuthoritativeRuntime;
  operationId: string;
  type: "FIND_AVAILABILITY";
  schedulingGeneration: number;
  prepareStart: (ctx: VoiceV3CallContext) => VoiceV3CallContext;
  isStillAuthoritative: (ctx: VoiceV3CallContext) => boolean;
  execute: () => Promise<OperationSideEffectResult<T>>;
  applySuccess: (ctx: VoiceV3CallContext, value: T) => VoiceV3CallContext;
  applyFailure: (ctx: VoiceV3CallContext, failureCode: string) => VoiceV3CallContext;
}): Promise<OperationSideEffectResult<T>> {
  return runAuthoritativeOperation({
    ...input,
    type: input.type,
    schedulingGeneration: input.schedulingGeneration,
    applyFailure: (ctx, terminal, failureCode) => {
      if (terminal === "STALE") return ctx;
      return input.applyFailure(ctx, failureCode);
    },
  });
}
