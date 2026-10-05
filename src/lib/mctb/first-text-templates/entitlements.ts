import type { MctbFirstTextTemplateId } from "./types";

/**
 * Plan gating for first-text templates — adjust here when pricing changes.
 * Free users see all templates; paid-only rows use upgrade treatment on select.
 */
export const MCTB_FIRST_TEXT_FREE_TEMPLATE_IDS: readonly MctbFirstTextTemplateId[] = [
  "simple",
  "what_do_you_need",
];

export const MCTB_FIRST_TEXT_PAID_TEMPLATE_IDS: readonly MctbFirstTextTemplateId[] = [
  "on_a_job",
  "quick_question",
  "callback_time",
];

export type MctbFirstTextEntitlementInput = {
  recoveryPaid: boolean;
};

export function isMctbFirstTextTemplateEntitled(
  templateId: MctbFirstTextTemplateId,
  entitlements: MctbFirstTextEntitlementInput,
): boolean {
  if (MCTB_FIRST_TEXT_FREE_TEMPLATE_IDS.includes(templateId)) return true;
  if (MCTB_FIRST_TEXT_PAID_TEMPLATE_IDS.includes(templateId)) {
    return entitlements.recoveryPaid;
  }
  return false;
}
