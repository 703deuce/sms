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

export function resolveSearchAreaCodes(input: {
  numberType: NumberType;
  areaCode?: string;
  tollFreePrefix?: TollFreePrefix;
}): string[] {
  if (input.numberType === "local") {
    const code = input.areaCode?.replace(/\D/g, "").slice(0, 3) ?? "";
    return code.length === 3 ? [code] : [];
  }
  const prefix = input.tollFreePrefix ?? "all";
  if (prefix === "all") return [...TOLL_FREE_AREA_CODES];
  return [prefix];
}
