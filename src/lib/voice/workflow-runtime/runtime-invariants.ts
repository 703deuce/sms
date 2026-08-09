import type { TurnToolEnvelope } from "./schema";
import type { CanonicalWorkflowState } from "./canonical-state";
import { expectedToolForNextAction } from "./canonical-state";
import { filterConversationalTools } from "./tool-surface";

export type RuntimeInvariantViolation = {
  code: "RUNTIME_INVARIANT_VIOLATION";
  message: string;
  expectedTool: string | null;
  expectedNextAction: string;
  currentNodeId: string;
  legacyState: string;
  availableTools: string[];
  missingFieldIds: string[];
};

export type RuntimeInvariantResult =
  | { ok: true; canonical: CanonicalWorkflowState }
  | { ok: false; violation: RuntimeInvariantViolation; repaired?: boolean };

function toolSupportsAction(toolNames: string[], expectedTool: string | null): boolean {
  if (!expectedTool) return true;
  return toolNames.includes(expectedTool);
}

/**
 * Validate that declared progression matches exposed tools before an LLM turn.
 * When repair is possible (stale early node + fields complete), caller should recompile.
 */
export function validateRuntimeInvariants(input: {
  canonical: CanonicalWorkflowState;
  envelope: TurnToolEnvelope;
  allowRepair?: boolean;
}): RuntimeInvariantResult {
  const conversational = filterConversationalTools(input.envelope.toolNames);
  const expectedTool = expectedToolForNextAction(input.canonical.expectedNextAction);

  const legacyMismatch =
    input.envelope.currentNodeId !== input.canonical.currentNodeId;

  const toolMismatch =
    expectedTool &&
    !toolSupportsAction(conversational, expectedTool) &&
    !toolSupportsAction(input.envelope.toolNames, expectedTool);

  if (!legacyMismatch && !toolMismatch) {
    return { ok: true, canonical: input.canonical };
  }

  const violation: RuntimeInvariantViolation = {
    code: "RUNTIME_INVARIANT_VIOLATION",
    message: toolMismatch
      ? `Expected next action "${input.canonical.expectedNextAction}" requires tool "${expectedTool}" but it is not exposed`
      : `Envelope node "${input.envelope.currentNodeId}" disagrees with canonical node "${input.canonical.currentNodeId}"`,
    expectedTool,
    expectedNextAction: input.canonical.expectedNextAction,
    currentNodeId: input.canonical.currentNodeId,
    legacyState: input.canonical.legacyState,
    availableTools: conversational,
    missingFieldIds: input.canonical.missingFieldIds,
  };

  if (input.allowRepair && legacyMismatch && !toolMismatch) {
    return { ok: false, violation, repaired: true };
  }

  return { ok: false, violation };
}
