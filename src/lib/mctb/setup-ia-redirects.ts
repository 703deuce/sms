import { MCTB_ROUTES } from "@/lib/mctb/routes";

type SearchRecord = Record<string, string | string[] | undefined>;

function pickSearch(search: SearchRecord | undefined, key: string): string | undefined {
  if (!search) return undefined;
  const v = search[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Legacy `/mctb/setup/*` and related paths → launch IA canonical routes. */
export function resolveMctbSetupIaRedirect(
  pathname: string,
  search?: SearchRecord,
): string | null {
  const path = pathname.split("?")[0];
  const open = pickSearch(search, "open");
  const test = pickSearch(search, "test");
  const section = pickSearch(search, "section");

  if (path === MCTB_ROUTES.numbers || path === "/voice/numbers") {
    const q = open ? `?open=${encodeURIComponent(open)}` : "?open=manage";
    return `${MCTB_ROUTES.phone}${q}`;
  }

  if (path === MCTB_ROUTES.setup || path === MCTB_ROUTES.setupStart) {
    return `${MCTB_ROUTES.missedCallRecovery}?tab=general`;
  }

  if (path === MCTB_ROUTES.setupRecovery) {
    return `${MCTB_ROUTES.missedCallRecovery}?tab=general`;
  }
  if (path === MCTB_ROUTES.setupMissedCallRules) {
    return `${MCTB_ROUTES.missedCallRecovery}?tab=rules`;
  }
  if (path === MCTB_ROUTES.setupConsent) {
    return `${MCTB_ROUTES.missedCallRecovery}?tab=consent`;
  }
  if (path === MCTB_ROUTES.setupExclusions) {
    return `${MCTB_ROUTES.missedCallRecovery}?tab=exclusions`;
  }

  if (path === MCTB_ROUTES.setupTextBack) {
    return section === "booking" ? `${MCTB_ROUTES.textBack}?section=booking` : MCTB_ROUTES.textBack;
  }
  if (path === MCTB_ROUTES.setupLinks) {
    return `${MCTB_ROUTES.textBack}?section=booking`;
  }

  if (path === MCTB_ROUTES.setupVoicemail) {
    return `${MCTB_ROUTES.voicemail}?tab=greeting`;
  }

  if (path === MCTB_ROUTES.setupNotifications) {
    return MCTB_ROUTES.notifications;
  }

  if (path === MCTB_ROUTES.setupPhone) {
    const params = new URLSearchParams();
    if (open) params.set("open", open);
    if (test) params.set("test", test);
    const q = params.toString();
    return q ? `${MCTB_ROUTES.phone}?${q}` : MCTB_ROUTES.phone;
  }

  if (path === MCTB_ROUTES.setupTest) {
    return `${MCTB_ROUTES.phone}?test=1`;
  }

  return null;
}
