/** MCTB product chrome — soft cool slate shell (shared across all `/mctb` routes). */
export function isMctbNeutralShellPath(pathname: string): boolean {
  return (
    pathname === "/mctb" ||
    pathname.startsWith("/mctb/") ||
    pathname === "/personal/voicemail"
  );
}
