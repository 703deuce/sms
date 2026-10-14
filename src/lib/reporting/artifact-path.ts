/** Storage path guard for report artifacts (no Supabase imports — safe for unit tests). */
export function assertSafeArtifactStoragePath(path: string): void {
  if (!path || path.includes("..") || !path.startsWith("businesses/")) {
    throw new Error("Invalid artifact storage path");
  }
}
