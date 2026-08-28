import type { AutomationDefinition } from "../types";

/** Resolve next node by arbitrary sourceHandle (named outcome). */
export function resolveOutcomeTarget(
  def: AutomationDefinition,
  nodeId: string,
  outcome: string,
): string | null {
  const exact = def.edges.find(
    (e) => e.source === nodeId && (e.sourceHandle || "default") === outcome,
  );
  if (exact) return exact.target;
  const fallback = def.edges.find(
    (e) =>
      e.source === nodeId &&
      (!e.sourceHandle || e.sourceHandle === "default"),
  );
  return fallback?.target ?? null;
}

export function outcomeResult(
  def: AutomationDefinition,
  nodeId: string,
  outcome: string,
  output?: Record<string, unknown>,
) {
  return {
    nextNodeId: resolveOutcomeTarget(def, nodeId, outcome),
    output: { branch: outcome, ...output },
  };
}
