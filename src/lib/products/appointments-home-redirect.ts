import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";

const LIST_FILTER_KEYS = [
  "staffIds",
  "locationId",
  "resourceId",
  "domainType",
  "payment",
  "attention",
] as const;

/** Appointments V1 home is the overview dashboard — not the legacy list default tab. */
export const APPOINTMENTS_V1_HOME_PATH = "/appointments/overview";

/**
 * True when `/appointments` should redirect to `/appointments/overview`
 * (bare path or default `?tab=upcoming` with no search/filters).
 */
export function shouldRedirectAppointmentsRootToOverview(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): boolean {
  if (!isAppointmentsV1Primary()) return false;

  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      const v = searchParams.get(key);
      return v ?? undefined;
    }
    const raw = searchParams[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const q = (get("q") || "").trim();
  if (q) return false;

  for (const key of LIST_FILTER_KEYS) {
    if (get(key)) return false;
  }

  const tab = get("tab");
  if (!tab || tab === "upcoming") return true;
  return false;
}

/** After login, map legacy `/appointments` entry to overview home. */
export function normalizeAppointmentsPostLoginPath(path: string): string {
  if (!isAppointmentsV1Primary()) return path;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/appointments")) return path;

  try {
    const url = new URL(trimmed, "http://local");
    if (url.pathname !== "/appointments") return path;
    if (shouldRedirectAppointmentsRootToOverview(url.searchParams)) {
      return APPOINTMENTS_V1_HOME_PATH;
    }
  } catch {
    if (trimmed === "/appointments") return APPOINTMENTS_V1_HOME_PATH;
  }
  return path;
}
