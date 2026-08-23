import { PlanLimitError } from "@/lib/plans";
import {
  isPremiumPosterTemplate,
  normalizePosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { canUsePremiumPosterTemplates } from "@/lib/reputation/qr-campaigns/limits";

/**
 * Normalize + enforce premium poster template access for an organization.
 * Trial / unpaid accounts are forced to the classic free poster.
 */
export async function resolveWritablePosterTemplateKey(params: {
  organizationId: string | null | undefined;
  requested: string | null | undefined;
}): Promise<string> {
  const normalized = normalizePosterTemplateKey(params.requested);
  if (!isPremiumPosterTemplate(normalized)) return normalized;

  if (!params.organizationId) {
    throw new PlanLimitError(
      "Premium poster templates require a paid plan. Upgrade to unlock the full template gallery.",
      "premium_poster_templates"
    );
  }

  const allowed = await canUsePremiumPosterTemplates(params.organizationId);
  if (!allowed) {
    throw new PlanLimitError(
      "Premium poster templates require a paid plan. Upgrade to unlock the full template gallery.",
      "premium_poster_templates"
    );
  }
  return normalized;
}
