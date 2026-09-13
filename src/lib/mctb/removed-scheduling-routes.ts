import { MCTB_ROUTES } from "@/lib/mctb/routes";

/**
 * Legacy MCTB scheduling UI routes (removed from nav).
 * Pages redirect — full Transovo scheduler remains at /appointments/*.
 */
export const MCTB_REMOVED_SCHEDULING_REDIRECTS: Record<string, string> = {
  [MCTB_ROUTES.calendar]: MCTB_ROUTES.conversations,
  [MCTB_ROUTES.appointments]: MCTB_ROUTES.conversations,
  [MCTB_ROUTES.appointmentsNew]: MCTB_ROUTES.conversations,
  [MCTB_ROUTES.booking]: MCTB_ROUTES.setupRecovery,
  [MCTB_ROUTES.reminders]: MCTB_ROUTES.setupRecovery,
};

export function resolveRemovedMctbSchedulingRedirect(pathname: string): string | null {
  if (pathname === MCTB_ROUTES.calendar || pathname.startsWith(`${MCTB_ROUTES.calendar}/`)) {
    return MCTB_ROUTES.conversations;
  }
  if (pathname === MCTB_ROUTES.appointments || pathname.startsWith(`${MCTB_ROUTES.appointments}/`)) {
    return MCTB_ROUTES.conversations;
  }
  if (pathname === MCTB_ROUTES.booking || pathname.startsWith(`${MCTB_ROUTES.booking}/`)) {
    return MCTB_ROUTES.setupRecovery;
  }
  if (pathname === MCTB_ROUTES.reminders || pathname.startsWith(`${MCTB_ROUTES.reminders}/`)) {
    return MCTB_ROUTES.setupRecovery;
  }
  return MCTB_REMOVED_SCHEDULING_REDIRECTS[pathname] ?? null;
}
