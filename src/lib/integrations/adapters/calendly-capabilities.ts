/**
 * Normalized Calendly capability / health for UI + MCTB AI Booking orchestrator.
 * Rule CAL-CONN-001
 */
import { getConnection } from "@/lib/integrations/connections";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { CALENDLY_OAUTH_SCOPES } from "@/lib/integrations/adapters/calendly";
import { calendlyApiFetch, CalendlyConnectorError } from "@/lib/integrations/adapters/calendly-client";
import { getEventTypeDetail, isEventTypeAiBookable } from "@/lib/integrations/adapters/calendly-event-types";

export type CalendlyConnectionHealth =
  | "CONNECTED"
  | "CONNECTED_MISSING_SCOPES"
  | "NEEDS_RECONNECT"
  | "PLAN_BLOCKED"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "DISCONNECTED";

export type CalendlyCapabilities = {
  connected: boolean;
  health: CalendlyConnectionHealth;
  scopesRequested: readonly string[];
  scopesGranted: string[] | null;
  canReadEventTypes: boolean;
  canReadAvailability: boolean;
  canCreateBooking: boolean;
  canCancelBooking: boolean;
  canCreateSchedulingLink: boolean;
  nativeApiReschedule: false;
  webhookAvailable: boolean;
  planBlocked: boolean;
  needsReconnect: boolean;
  directBookingPreflightOk: boolean;
  notes: string[];
};

const AI_BOOKING_MIN_SCOPES = [
  "users:read",
  "event_types:read",
  "availability:read",
  "scheduled_events:read",
  "scheduled_events:write",
] as const;

function scopesFromConnection(config: Record<string, unknown>): string[] | null {
  const raw = config.grantedScopes ?? config.scopes;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) return raw.split(/[\s,]+/).filter(Boolean);
  return null;
}

export async function getCalendlyCapabilities(
  workspaceId: string,
  opts?: { eventTypeUri?: string | null },
): Promise<CalendlyCapabilities> {
  const notes: string[] = [];
  const conn = await getConnection(workspaceId, "calendly");
  if (!conn || conn.status === "disconnected") {
    return {
      connected: false,
      health: "DISCONNECTED",
      scopesRequested: CALENDLY_OAUTH_SCOPES,
      scopesGranted: null,
      canReadEventTypes: false,
      canReadAvailability: false,
      canCreateBooking: false,
      canCancelBooking: false,
      canCreateSchedulingLink: false,
      nativeApiReschedule: false,
      webhookAvailable: false,
      planBlocked: false,
      needsReconnect: false,
      directBookingPreflightOk: false,
      notes: ["Calendly not connected"],
    };
  }

  if (conn.status === "needs_reauth") {
    return {
      connected: false,
      health: "NEEDS_RECONNECT",
      scopesRequested: CALENDLY_OAUTH_SCOPES,
      scopesGranted: scopesFromConnection((conn.configJson || {}) as Record<string, unknown>),
      canReadEventTypes: false,
      canReadAvailability: false,
      canCreateBooking: false,
      canCancelBooking: false,
      canCreateSchedulingLink: false,
      nativeApiReschedule: false,
      webhookAvailable: false,
      planBlocked: false,
      needsReconnect: true,
      directBookingPreflightOk: false,
      notes: [conn.lastError || "Reconnect Calendly"],
    };
  }

  const cfg = (conn.configJson || {}) as Record<string, unknown>;
  const granted = scopesFromConnection(cfg);
  const missingScope = Boolean(
    granted && AI_BOOKING_MIN_SCOPES.some((s) => !granted.includes(s)),
  );

  if (missingScope) {
    notes.push("Reconnect Calendly to grant AI Booking scopes (availability:read, scheduled_events:write, …)");
  }

  let health: CalendlyConnectionHealth = missingScope
    ? "CONNECTED_MISSING_SCOPES"
    : "CONNECTED";
  let planBlocked = false;
  let directBookingPreflightOk = false;

  try {
    const ctx = await buildAdapterContext(workspaceId, "calendly");
    await calendlyApiFetch<{ resource?: { uri?: string } }>("/users/me", ctx, { op: "users/me" });
    const canReadEventTypes = !missingScope;
    const canReadAvailability = !missingScope;
    let canCreateBooking = !missingScope;
    const canCancelBooking = !missingScope;
    const canCreateSchedulingLink =
      !missingScope &&
      (granted?.includes("scheduling_links:write") ||
        CALENDLY_OAUTH_SCOPES.includes("scheduling_links:write"));

    if (opts?.eventTypeUri) {
      const et = await getEventTypeDetail(ctx, opts.eventTypeUri);
      const bookable = isEventTypeAiBookable(et);
      if (!bookable.ok) {
        notes.push(...bookable.reasons);
        canCreateBooking = false;
      } else {
        directBookingPreflightOk = canCreateBooking;
      }
    }

    return {
      connected: true,
      health,
      scopesRequested: CALENDLY_OAUTH_SCOPES,
      scopesGranted: granted,
      canReadEventTypes,
      canReadAvailability,
      canCreateBooking,
      canCancelBooking,
      canCreateSchedulingLink,
      nativeApiReschedule: false,
      webhookAvailable: true,
      planBlocked,
      needsReconnect: false,
      directBookingPreflightOk,
      notes,
    };
  } catch (err) {
    if (err instanceof CalendlyConnectorError) {
      if (err.code === "CALENDLY_PLAN_REQUIRED") {
        planBlocked = true;
        health = "PLAN_BLOCKED";
      } else if (err.code === "CALENDLY_RATE_LIMITED") health = "RATE_LIMITED";
      else if (err.code === "CALENDLY_AUTH_REQUIRED") health = "NEEDS_RECONNECT";
      else health = "PROVIDER_UNAVAILABLE";
      notes.push(err.message);
    } else {
      health = "PROVIDER_UNAVAILABLE";
      notes.push(err instanceof Error ? err.message : String(err));
    }
    return {
      connected: conn.status === "connected",
      health,
      scopesRequested: CALENDLY_OAUTH_SCOPES,
      scopesGranted: granted,
      canReadEventTypes: false,
      canReadAvailability: false,
      canCreateBooking: false,
      canCancelBooking: false,
      canCreateSchedulingLink: false,
      nativeApiReschedule: false,
      webhookAvailable: false,
      planBlocked,
      needsReconnect: health === "NEEDS_RECONNECT",
      directBookingPreflightOk: false,
      notes,
    };
  }
}
