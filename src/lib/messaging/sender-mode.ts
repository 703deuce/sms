export type MassMessagingSenderMode = "PLATFORM" | "WORKSPACE";

export function parseMassMessagingSenderMode(
  raw: unknown,
  fallback: MassMessagingSenderMode = "WORKSPACE",
): MassMessagingSenderMode {
  if (raw === "PLATFORM" || raw === "platform") return "PLATFORM";
  if (raw === "WORKSPACE" || raw === "workspace") return "WORKSPACE";
  return fallback;
}
