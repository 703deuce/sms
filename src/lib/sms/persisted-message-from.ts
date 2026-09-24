/**
 * Canonical E.164 for Message.from persistence — must match the provider send route.
 */
export function resolvePersistedOutboundMessageFrom(input: {
  poolFrom?: string | null;
  senderRouteFromE164?: string | null;
  explicitFrom?: string | null;
  preferredWorkspaceFrom?: string | null;
  registrationFrom?: string | null;
}): string {
  const pool = input.poolFrom?.trim();
  if (pool) return pool;

  const route = input.senderRouteFromE164?.trim();
  if (route) return route;

  const explicit = input.explicitFrom?.trim();
  if (explicit) return explicit;

  const preferred = input.preferredWorkspaceFrom?.trim();
  if (preferred) return preferred;

  const reg = input.registrationFrom?.trim();
  if (reg) return reg;

  return "messaging_service";
}

/**
 * Provider API From — same precedence as persistence when senderRoute is set.
 */
export function resolveProviderOutboundFromE164(input: {
  poolFrom?: string | null;
  senderRouteFromE164?: string | null;
  explicitFrom?: string | null;
  preferredWorkspaceFrom?: string | null;
}): string | undefined {
  const pool = input.poolFrom?.trim();
  if (pool) return pool;
  const route = input.senderRouteFromE164?.trim();
  if (route) return route;
  const explicit = input.explicitFrom?.trim();
  if (explicit) return explicit;
  const preferred = input.preferredWorkspaceFrom?.trim();
  if (preferred) return preferred;
  return undefined;
}
