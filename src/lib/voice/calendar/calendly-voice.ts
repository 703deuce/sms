/**
 * Calendly routing for live voice tools — never silently fall back to internal
 * when the workspace has a connected Calendly integration.
 */

import { getConnection } from "@/lib/integrations/connections";

export type CalendlyConnection = NonNullable<Awaited<ReturnType<typeof getConnection>>>;

export async function getConnectedCalendly(
  workspaceId: string,
): Promise<CalendlyConnection | null> {
  const conn = await getConnection(workspaceId, "calendly");
  if (conn?.status === "connected" && conn.accessToken) return conn;
  return null;
}

export function requireCalendlyIntegrationOk<T extends { ok: boolean; code?: string; message?: string }>(
  result: T,
  operation: string,
): Extract<T, { ok: true }> {
  if (result.ok) return result as Extract<T, { ok: true }>;
  const detail = [result.code, result.message].filter(Boolean).join(": ");
  throw new Error(
    `Calendly ${operation} failed${detail ? ` (${detail})` : ""}. Reconnect Calendly or check integration write settings — bookings cannot use the internal calendar while Calendly is connected.`,
  );
}
