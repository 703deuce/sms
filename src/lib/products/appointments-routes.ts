/** Appointments V1 route prefixes — shared shell routes included. */
export const APPOINTMENTS_APP_ROUTE_PREFIXES = [
  "/appointments",
  "/conversations",
  "/contacts",
  "/analytics",
  "/numbers",
  "/compliance",
  "/integrations",
  "/settings",
  "/help",
] as const;

export function isAppointmentsProductPath(pathname: string): boolean {
  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) return true;
  return APPOINTMENTS_APP_ROUTE_PREFIXES.some(
    (p) => p !== "/appointments" && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

export function appointmentsShellHome(): string {
  return "/appointments/overview";
}
