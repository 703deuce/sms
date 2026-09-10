import type { RoutingRule } from "@/lib/appointments/types";

/** Deterministic routing from booking answers (pure — safe for client/tests). */
export function resolveRoutingDestination(
  rules: RoutingRule[] | undefined,
  answers: Record<string, string>,
): RoutingRule["destination"] | null {
  if (!rules?.length) return null;

  for (const rule of rules) {
    const logic = rule.logic || "and";
    const results = rule.conditions.map((c) => {
      const answer = answers[c.field] || "";
      if (c.operator === "equals") return answer === c.value;
      if (c.operator === "not_equals") return answer !== c.value;
      return false;
    });
    const match = logic === "or" ? results.some(Boolean) : results.every(Boolean);
    if (match) return rule.destination;
  }
  return null;
}
