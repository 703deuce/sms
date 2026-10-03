/** Map provisioning/API codes to onboarding-safe copy (no provider jargon). */
export function formatMctbOnboardingUserError(raw: string | null | undefined): string {
  const code = String(raw || "").trim();
  if (!code) return "Something went wrong. Please try again.";

  const normalized = code.toLowerCase();
  const table: Record<string, string> = {
    no_telnyx_toll_free_available:
      "We couldn’t reserve your dedicated forwarding number right now. You can still fill in your business details and tap Continue—we’ll keep trying in the background. If this stays stuck, contact Transovo support.",
    toll_free_ingress_provision_failed:
      "We couldn’t finish setting up call forwarding yet. You can continue setup and try again from Phone & forwarding.",
    trial_number_provision_failed:
      "We couldn’t assign a recovery number yet. You can continue and retry from setup.",
    ingress_import_failed:
      "We couldn’t import your forwarding number yet. Try again in a few minutes or contact support.",
  };

  if (table[normalized]) return table[normalized];
  if (normalized.includes("no_telnyx_toll_free")) return table.no_telnyx_toll_free_available;

  return code.length > 80
    ? "Something went wrong while setting up your number. Please try again."
    : code;
}
