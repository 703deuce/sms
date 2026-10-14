export type MapsFailureCategory = "degradation" | "timeout" | "auth" | "unknown";

export function isProviderDegradationPattern(_message: string): boolean {
  return false;
}
