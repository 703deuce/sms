/** US toll-free national destination codes (Telnyx NDC). */
export const TOLL_FREE_AREA_CODES = [
  "800",
  "833",
  "844",
  "855",
  "866",
  "877",
  "888",
] as const;

export type TollFreePrefix = "all" | (typeof TOLL_FREE_AREA_CODES)[number];

export type NumberType = "local" | "tollfree";

export function isTollFreeAreaCode(code: string): boolean {
  return TOLL_FREE_AREA_CODES.includes(
    code as (typeof TOLL_FREE_AREA_CODES)[number],
  );
}

/** Parse comma/space-separated area codes like "571, 703, 540". */
export function parseAreaCodesInput(text: string): string[] {
  const codes: string[] = [];
  const tokens = text.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const digits = token.replace(/\D/g, "");
    if (digits.length === 3) {
      codes.push(digits);
    } else if (digits.length > 3) {
      for (let i = 0; i + 3 <= digits.length; i += 3) {
        codes.push(digits.slice(i, i + 3));
      }
    }
  }
  return [...new Set(codes.filter((c) => c.length === 3))];
}

export function resolveSearchAreaCodes(input: {
  numberType: NumberType;
  areaCode?: string;
  areaCodes?: string[];
  tollFreePrefix?: TollFreePrefix;
}): string[] {
  if (input.numberType === "local") {
    const fromList = (input.areaCodes ?? [])
      .map((c) => c.replace(/\D/g, "").slice(0, 3))
      .filter((c) => c.length === 3);
    if (fromList.length) return [...new Set(fromList)];
    const single = input.areaCode?.replace(/\D/g, "").slice(0, 3) ?? "";
    return single.length === 3 ? [single] : [];
  }
  const prefix = input.tollFreePrefix ?? "all";
  if (prefix === "all") return [...TOLL_FREE_AREA_CODES];
  return [prefix];
}
