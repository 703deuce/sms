/**
 * Zero-DB answer test — hardcoded Say only. Telnyx answers as soon as this TeXML executes.
 * No profile lookup, no Play URL, no Gather, no DB.
 */
const DEFAULT_SUCCESS_MESSAGE =
  "If you're hearing this, it was a success.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildMctbInstantAnswerTestTexml(message?: string): string {
  const text = (message || process.env.MCTB_ANSWER_TEST_SAY_TEXT || DEFAULT_SUCCESS_MESSAGE).trim();
  return `<Say voice="female">${escapeXml(text)}</Say><Hangup/>`;
}

/** cert=C3 live CFNA path — answer test only, no DB on ingress. */
export function certModeUsesZeroDbAnswerTest(mode: string): boolean {
  if (process.env.MCTB_ENTRY_ZERO_DB_SAY === "1") return true;
  return mode === "C3";
}
