import type { NumberSearchState } from "./types";

export type UnderstandingChip = {
  id: string;
  label: string;
  kind: "explicit" | "ai" | "filter";
};

export function buildUnderstandingChips(state: NumberSearchState): UnderstandingChip[] {
  const chips: UnderstandingChip[] = [];

  for (const code of state.areaCodes) {
    chips.push({ id: `area:${code}`, label: code, kind: "explicit" });
  }

  if (state.industry) {
    chips.push({
      id: `industry:${state.industry}`,
      label: capitalize(state.industry),
      kind: "explicit",
    });
  }

  if (state.maxPriceCents != null) {
    chips.push({
      id: "max_price",
      label: `Under $${(state.maxPriceCents / 100).toFixed(0)}`,
      kind: "filter",
    });
  }

  if (state.minPriceCents != null) {
    chips.push({
      id: "min_price",
      label: `Over $${(state.minPriceCents / 100).toFixed(0)}`,
      kind: "filter",
    });
  }

  for (const kw of state.explicitKeywords) {
    chips.push({ id: `explicit:${kw}`, label: kw, kind: "explicit" });
  }

  for (const kw of state.aiGeneratedKeywords) {
    chips.push({ id: `ai:${kw}`, label: kw, kind: "ai" });
  }

  chips.push({
    id: `type:${state.numberType}`,
    label: state.numberType === "tollfree" ? "Toll-free" : "Local",
    kind: "filter",
  });

  if (state.intent === "business") {
    chips.push({ id: "intent:business", label: "Business", kind: "filter" });
  } else if (state.intent === "personal") {
    chips.push({ id: "intent:personal", label: "Personal", kind: "filter" });
  }

  return chips;
}

export function removeChipFromState(
  state: NumberSearchState,
  chipId: string,
): Partial<NumberSearchState> {
  if (chipId.startsWith("area:")) {
    const code = chipId.slice(5);
    return { areaCodes: state.areaCodes.filter((c) => c !== code) };
  }
  if (chipId.startsWith("industry:")) {
    return { industry: undefined };
  }
  if (chipId === "max_price") return { maxPriceCents: undefined };
  if (chipId === "min_price") return { minPriceCents: undefined };
  if (chipId.startsWith("explicit:")) {
    const kw = chipId.slice(9);
    return {
      explicitKeywords: state.explicitKeywords.filter((k) => k !== kw),
      excludedKeywords: [...new Set([...state.excludedKeywords, kw])],
      keywords: state.keywords.filter((k) => k.toUpperCase() !== kw),
    };
  }
  if (chipId.startsWith("ai:")) {
    const kw = chipId.slice(3);
    return {
      aiGeneratedKeywords: state.aiGeneratedKeywords.filter((k) => k !== kw),
      excludedKeywords: [...new Set([...state.excludedKeywords, kw])],
      keywords: state.keywords.filter((k) => k.toUpperCase() !== kw),
    };
  }
  if (chipId === "type:local") return { numberType: "local" };
  if (chipId === "type:tollfree") return { numberType: "tollfree" };
  return {};
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
