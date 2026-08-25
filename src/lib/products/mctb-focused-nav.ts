/**
 * When true, voice shell sidebar emphasizes MCTB only.
 * Smart Routing / Call Forwarding routes remain in the codebase but are hidden from primary nav.
 */
export function isMctbFocusedCustomerNav(): boolean {
  return process.env.TRANSOVO_MCTB_FOCUSED_NAV !== "false";
}
