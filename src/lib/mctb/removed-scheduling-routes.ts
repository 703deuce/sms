import { MCTB_ROUTES } from "@/lib/mctb/routes";

/**
 * Legacy MCTB scheduling UI routes (removed from nav).
 * Pages redirect — full Transovo scheduler remains at /appointments/*.
 */
export const MCTB_REMOVED_SCHEDULING_REDIRECTS: Record<string, string> = {
  [MCTB_ROUTES.calendar]: "/appointments/calendar",
  [MCTB_ROUTES.appointments]: "/appointments",
  [MCTB_ROUTES.appointmentsNew]: "/appointments/types",
  [MCTB_ROUTES.booking]: "/appointments/types",
  [MCTB_ROUTES.reminders]: "/appointments/reminders",
};

export function resolveRemovedMctbSchedulingRedirect(pathname: string): string | null {
  if (pathname === MCTB_ROUTES.calendar || pathname.startsWith(`${MCTB_ROUTES.calendar}/`)) {
    return "/appointments/calendar";
  }
  if (pathname === MCTB_ROUTES.appointments || pathname.startsWith(`${MCTB_ROUTES.appointments}/`)) {
    return "/appointments";
  }
  if (pathname === MCTB_ROUTES.booking || pathname.startsWith(`${MCTB_ROUTES.booking}/`)) {
    return "/appointments/types";
  }
  if (pathname === MCTB_ROUTES.reminders || pathname.startsWith(`${MCTB_ROUTES.reminders}/`)) {
    return "/appointments/reminders";
  }
  return MCTB_REMOVED_SCHEDULING_REDIRECTS[pathname] ?? null;
}
