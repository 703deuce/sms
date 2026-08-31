import { getBlockOutcomes, type BlockOutcome } from "./block-registry/outcomes";

/** Kimi canvas output handle — outcomeId is the semantic sourceHandle. */
export type KimiNodeOutput = {
  outcomeId: string;
  label: string;
  kind: "yes" | "no" | "neutral";
  pie?: boolean;
};

const PIE_COLORS = ["#2dd4bf", "#fb923c", "#818cf8", "#f472b6", "#fbbf24", "#34d399"];

function outcomeKind(outcomeId: string, index: number): "yes" | "no" | "neutral" {
  if (outcomeId === "yes" || outcomeId === "subscribed" || outcomeId === "sent" || outcomeId === "clicked" || outcomeId === "reply_received" || outcomeId === "added" || outcomeId === "assigned" || outcomeId === "positive") {
    return "yes";
  }
  if (outcomeId === "no" || outcomeId === "failed" || outcomeId === "timed_out" || outcomeId === "no_reply" || outcomeId === "unsubscribed" || outcomeId === "blocked" || outcomeId === "negative") {
    return "no";
  }
  // Alternate neutral colors for multi-outcome nodes
  return index % 3 === 1 ? "no" : index % 3 === 2 ? "neutral" : "yes";
}

export function outcomesToKimiOutputs(
  blockType: string,
  config?: Record<string, unknown>,
): KimiNodeOutput[] {
  const outcomes = getBlockOutcomes(blockType, config);
  if (outcomes.length === 0) return [];
  if (outcomes.length === 1 && outcomes[0].id === "default" && !outcomes[0].label) {
    return [{ outcomeId: "default", label: "", kind: "neutral" }];
  }
  return outcomes.map((o, i) => ({
    outcomeId: o.id,
    label: o.hint ? `${o.label} (${o.hint})` : o.label,
    kind: outcomeKind(o.id, i),
    pie: outcomes.length > 1,
  }));
}

export function kimiOutputColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}

export function handleFromKimiEdge(outcomeId: string): string {
  return outcomeId || "default";
}

export function kimiEdgeFromHandle(handle: string, outcomes: BlockOutcome[]): {
  outcomeId: string;
  label: string;
  kind: "yes" | "no" | "neutral";
} {
  const match = outcomes.find((o) => o.id === handle);
  if (match) {
    const idx = outcomes.indexOf(match);
    return {
      outcomeId: match.id,
      label: match.hint ? `${match.label} (${match.hint})` : match.label,
      kind: outcomeKind(match.id, idx),
    };
  }
  if (handle === "yes" || handle === "no") {
    return { outcomeId: handle, label: handle === "yes" ? "Yes" : "No", kind: handle };
  }
  return { outcomeId: handle, label: handle === "default" ? "" : handle, kind: "neutral" };
}
