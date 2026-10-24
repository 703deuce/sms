/**
 * Required sections for GPT-Live (Amy) function-tool descriptions on the LiveKit session.
 * Clarity beats brevity — models route intent via tool choice using these contracts.
 */

export const AMY_LIVE_TOOL_DESCRIPTION_REQUIRED_SECTIONS = [
  "WHAT THIS TOOL DOES",
  "WHEN YOU MUST USE THIS TOOL",
  "WHEN NOT TO USE THIS TOOL",
  "WHILE THE TOOL RUNS",
  "SUCCESS BOUNDARY",
  "FAILURE / NON-SUCCESS",
  "ARGUMENTS",
] as const;

export type AmyLiveToolDescriptionSection =
  (typeof AMY_LIVE_TOOL_DESCRIPTION_REQUIRED_SECTIONS)[number];

export function assertAmyLiveToolDescriptionMeetsSpec(
  toolName: string,
  description: string | null | undefined,
): void {
  const text = (description ?? "").trim();
  if (!text) {
    throw new Error(`${toolName}: missing tool description`);
  }
  const missing: string[] = [];
  for (const section of AMY_LIVE_TOOL_DESCRIPTION_REQUIRED_SECTIONS) {
    if (!text.includes(section)) {
      missing.push(section);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `${toolName}: description missing required section(s): ${missing.join(", ")}`,
    );
  }
  if (text.length < 400) {
    throw new Error(
      `${toolName}: description too short (${text.length} chars) — live tools need full contracts`,
    );
  }
}
