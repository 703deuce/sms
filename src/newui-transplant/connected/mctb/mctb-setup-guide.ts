/** Reopen first-run onboarding wizard with current authoritative configuration. */
export const MCTB_SETUP_GUIDE_QUERY = "mctbSetupGuide";

export function openMctbSetupGuide(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(MCTB_SETUP_GUIDE_QUERY, "1");
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new Event("mctb:setup-guide-request"));
}
