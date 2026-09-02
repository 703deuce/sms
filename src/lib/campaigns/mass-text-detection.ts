/** Pure helper — safe for server and client components. */
export function campaignLooksLikeMassText(configJson: unknown): boolean {
  if (!configJson || typeof configJson !== "object") return false;
  const config = configJson as Record<string, unknown>;
  return (
    (config.broadcastVersion === 1 && config.productSource === "mass_text") ||
    config.productSource === "mass_text" ||
    config.massTexting === true
  );
}

export function campaignDetailIsKimiBroadcast(configJson: unknown): boolean {
  if (!configJson || typeof configJson !== "object") return false;
  return (configJson as Record<string, unknown>).broadcastVersion === 1;
}
