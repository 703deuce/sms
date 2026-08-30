/**
 * Minimal valid TeXML for Telnyx certification — no DB, no Gather, no redirects.
 */
export function buildMinimalCertTexml(): string {
  return `<Say voice="female">Test successful.</Say><Pause length="5"/><Hangup/>`;
}

export function buildCertModeATexml(): string {
  return buildMinimalCertTexml();
}
