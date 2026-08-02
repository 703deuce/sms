/**
 * Calendly write/action helpers used by automation execution.
 *
 * These live in a companion module (rather than on the adapter interface) because
 * the shared `ExternalIntegrationAdapter` contract is intentionally generic and
 * does not model scheduling-link / cancellation operations. The automation
 * action registry imports these directly for the `appointment.*` action ids.
 *
 * Requires the write OAuth scopes added in `calendly.ts`
 * (scheduling_links:write, shares:write, scheduled_events:write) — connections
 * authorized before those scopes existed must reconnect.
 */
import { integrationFetch } from "../framework/http";
import type { AdapterContext } from "../framework/types";

const CALENDLY_API = "https://api.calendly.com";

function calendlyApi<T = Record<string, unknown>>(
  path: string,
  ctx: AdapterContext,
  init?: RequestInit,
): Promise<T> {
  return integrationFetch<T>(`${CALENDLY_API}${path}`, {
    ...init,
    accessToken: ctx.accessToken,
  });
}

/**
 * Normalize Calendly API errors (plan/permission/scope) into a clear message.
 * Wrap every network call so automation logs surface actionable guidance.
 */
function wrapCalendlyError(err: unknown, op: string): never {
  const message = err instanceof Error ? err.message : String(err);
  if (/401|unauthor|invalid_token|expired/i.test(message)) {
    throw new Error(
      `UNSUPPORTED: Calendly rejected ${op} — token invalid or missing scope. Disconnect and reconnect Calendly to grant the new write scopes. (${message.slice(0, 160)})`,
    );
  }
  if (/403|forbidden|permission|scope/i.test(message)) {
    throw new Error(
      `UNSUPPORTED: Calendly ${op} is not permitted by this account (missing scope or role). Reconnect with the required scopes or use an admin account. (${message.slice(0, 160)})`,
    );
  }
  if (/402|payment|plan|standard|teams|enterprise|upgrade|subscription/i.test(message)) {
    throw new Error(
      `Blocked by Calendly plan: ${op} requires a paid Calendly plan. (${message.slice(0, 160)})`,
    );
  }
  throw new Error(`Calendly ${op} failed: ${message.slice(0, 200)}`);
}

type CalendlyResource = Record<string, unknown>;

async function getMe(ctx: AdapterContext): Promise<CalendlyResource> {
  const me = await calendlyApi<{ resource?: CalendlyResource }>("/users/me", ctx);
  return me.resource || {};
}

/** UUID is the last path segment of a Calendly resource URI. */
function uuidFromUri(uri: string): string {
  return uri.split("/").filter(Boolean).pop() || uri;
}

/**
 * Resolve a persistent scheduling URL from the connected user, or from a
 * specific event type when `eventTypeUri` is provided.
 */
export async function getSchedulingLink(
  ctx: AdapterContext,
  opts: { eventTypeUri?: string } = {},
): Promise<{ schedulingUrl: string; source: "event_type" | "user"; ownerUri: string }> {
  try {
    if (opts.eventTypeUri) {
      const uuid = uuidFromUri(opts.eventTypeUri);
      const res = await calendlyApi<{ resource?: CalendlyResource }>(
        `/event_types/${encodeURIComponent(uuid)}`,
        ctx,
      );
      const resource = res.resource || {};
      const url = String(resource.scheduling_url || "");
      if (!url) {
        throw new Error("Event type has no scheduling_url");
      }
      return {
        schedulingUrl: url,
        source: "event_type",
        ownerUri: String(resource.uri || opts.eventTypeUri),
      };
    }
    const me = await getMe(ctx);
    const url = String(me.scheduling_url || "");
    if (!url) {
      throw new Error("User has no scheduling_url");
    }
    return { schedulingUrl: url, source: "user", ownerUri: String(me.uri || "") };
  } catch (err) {
    return wrapCalendlyError(err, "get scheduling link");
  }
}

/** Find the first active event type owned by the connected user. */
async function resolveDefaultEventTypeUri(ctx: AdapterContext): Promise<string | null> {
  const me = await getMe(ctx);
  const user = String(me.uri || "");
  if (!user) return null;
  const res = await calendlyApi<{ collection?: CalendlyResource[] }>(
    `/event_types?user=${encodeURIComponent(user)}&active=true&count=1`,
    ctx,
  );
  const first = (res.collection || [])[0];
  return first ? String(first.uri || "") || null : null;
}

/**
 * Create a single-use scheduling link (POST /scheduling_links).
 * The `owner` must be an event type URI (owner_type "EventType").
 * Requires the `scheduling_links:write` scope.
 */
export async function createSingleUseSchedulingLink(
  ctx: AdapterContext,
  opts: {
    ownerUri?: string;
    ownerType?: string;
    maxEventCount?: 1;
    eventTypeUri?: string;
  } = {},
): Promise<{ bookingUrl: string; owner: string; ownerType: string }> {
  try {
    const ownerType = opts.ownerType || "EventType";
    let owner = opts.ownerUri || opts.eventTypeUri || null;
    if (!owner) {
      owner = await resolveDefaultEventTypeUri(ctx);
    }
    if (!owner) {
      throw new Error(
        "No event type available to create a single-use scheduling link — provide eventTypeUri/ownerUri",
      );
    }
    const res = await calendlyApi<{ resource?: CalendlyResource }>(
      "/scheduling_links",
      ctx,
      {
        method: "POST",
        body: JSON.stringify({
          max_event_count: opts.maxEventCount ?? 1,
          owner,
          owner_type: ownerType,
        }),
      },
    );
    const resource = res.resource || {};
    const url = String(resource.booking_url || "");
    if (!url) {
      throw new Error("Calendly did not return a booking_url");
    }
    return { bookingUrl: url, owner, ownerType };
  } catch (err) {
    return wrapCalendlyError(err, "create single-use scheduling link");
  }
}

/**
 * Cancel a scheduled event (POST /scheduled_events/{uuid}/cancellation).
 * Requires the `scheduled_events:write` scope.
 */
export async function cancelAppointment(
  ctx: AdapterContext,
  opts: { eventUuid?: string; eventUri?: string; reason?: string },
): Promise<{ canceled: true; eventUuid: string; reason: string | null }> {
  const uuid = opts.eventUuid || (opts.eventUri ? uuidFromUri(opts.eventUri) : "");
  if (!uuid) {
    throw new Error("cancelAppointment requires eventUuid or eventUri");
  }
  try {
    await calendlyApi(
      `/scheduled_events/${encodeURIComponent(uuid)}/cancellation`,
      ctx,
      {
        method: "POST",
        body: JSON.stringify({ reason: opts.reason || "Canceled via automation" }),
      },
    );
    return { canceled: true, eventUuid: uuid, reason: opts.reason || null };
  } catch (err) {
    return wrapCalendlyError(err, "cancel appointment");
  }
}

/**
 * List available times for an event type (GET /event_type_available_times).
 * Window is capped at 7 days by default (Calendly allows up to 31).
 */
export async function listEventTypeAvailableTimes(
  ctx: AdapterContext,
  opts: {
    eventTypeUri?: string;
    startTime?: string;
    endTime?: string;
  } = {},
): Promise<{
  eventTypeUri: string;
  slots: Array<{ startTime: string; status: string }>;
}> {
  try {
    let eventTypeUri = opts.eventTypeUri || null;
    if (!eventTypeUri) {
      eventTypeUri = await resolveDefaultEventTypeUri(ctx);
    }
    if (!eventTypeUri) {
      throw new Error("No event type available — provide eventTypeUri");
    }
    const start = opts.startTime || new Date(Date.now() + 60 * 60_000).toISOString();
    const end =
      opts.endTime ||
      new Date(Date.now() + 7 * 86400_000).toISOString();
    const params = new URLSearchParams({
      event_type: eventTypeUri,
      start_time: start,
      end_time: end,
    });
    const res = await calendlyApi<{
      collection?: Array<{ start_time?: string; status?: string }>;
    }>(`/event_type_available_times?${params}`, ctx);
    const slots = (res.collection || [])
      .map((s) => ({
        startTime: String(s.start_time || ""),
        status: String(s.status || "available"),
      }))
      .filter((s) => s.startTime);
    return { eventTypeUri, slots };
  } catch (err) {
    return wrapCalendlyError(err, "list available times");
  }
}

/**
 * Book a meeting via Calendly Scheduling API (POST /invitees).
 * This is the voice-agent / in-app path — no Calendly-hosted browser UI.
 * Requires a paid Calendly plan on the connected account.
 */
export async function bookEventInvitee(
  ctx: AdapterContext,
  opts: {
    eventTypeUri?: string;
    startTime: string;
    name: string;
    email: string;
    timezone?: string;
    phone?: string | null;
    locationKind?: string | null;
    location?: string | null;
  },
): Promise<{
  inviteeUri: string;
  eventUri: string;
  status: string | null;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
  startTime: string;
  eventTypeUri: string;
}> {
  if (!opts.startTime?.trim()) {
    throw new Error("bookEventInvitee requires startTime (UTC ISO)");
  }
  if (!opts.email?.trim() || !opts.name?.trim()) {
    throw new Error("bookEventInvitee requires name and email");
  }
  try {
    let eventTypeUri = opts.eventTypeUri || null;
    if (!eventTypeUri) {
      eventTypeUri = await resolveDefaultEventTypeUri(ctx);
    }
    if (!eventTypeUri) {
      throw new Error("No event type available — provide eventTypeUri");
    }

    // Resolve location.kind from the event type when the caller did not supply one.
    let locationKind = opts.locationKind || null;
    let locationValue = opts.location || null;
    if (!locationKind) {
      try {
        const uuid = uuidFromUri(eventTypeUri);
        const et = await calendlyApi<{ resource?: CalendlyResource }>(
          `/event_types/${encodeURIComponent(uuid)}`,
          ctx,
        );
        const locations =
          (et.resource?.locations as Array<{ kind?: string; location?: string }> | undefined) ||
          [];
        const first = locations[0];
        if (first?.kind) {
          locationKind = String(first.kind);
          if (!locationValue && first.location) locationValue = String(first.location);
        }
      } catch {
        // proceed without location — Calendly rejects only when the ET requires one
      }
    }

    const body: Record<string, unknown> = {
      event_type: eventTypeUri,
      start_time: opts.startTime,
      invitee: {
        name: opts.name.trim(),
        email: opts.email.trim().toLowerCase(),
        timezone: opts.timezone || "America/New_York",
        ...(opts.phone ? { text_reminder_number: opts.phone } : {}),
      },
    };
    if (locationKind) {
      body.location = {
        kind: locationKind,
        ...(locationValue ? { location: locationValue } : {}),
      };
    }

    const res = await calendlyApi<{ resource?: CalendlyResource }>("/invitees", ctx, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const resource = res.resource || {};
    const inviteeUri = String(resource.uri || "");
    const eventUri = String(resource.event || "");
    if (!inviteeUri || !eventUri) {
      throw new Error("Calendly did not return invitee/event URIs from POST /invitees");
    }
    return {
      inviteeUri,
      eventUri,
      status: (resource.status as string) || null,
      cancelUrl: (resource.cancel_url as string) || null,
      rescheduleUrl: (resource.reschedule_url as string) || null,
      startTime: opts.startTime,
      eventTypeUri,
    };
  } catch (err) {
    return wrapCalendlyError(err, "book invitee (Scheduling API)");
  }
}

/**
 * Convenience: pick the first open slot and book it (agent/voice happy path).
 */
export async function bookNextAvailableSlot(
  ctx: AdapterContext,
  opts: {
    eventTypeUri?: string;
    name: string;
    email: string;
    timezone?: string;
    phone?: string | null;
  },
): Promise<Awaited<ReturnType<typeof bookEventInvitee>> & { slotsConsidered: number }> {
  const avail = await listEventTypeAvailableTimes(ctx, {
    eventTypeUri: opts.eventTypeUri,
  });
  const open = avail.slots.filter((s) => /available/i.test(s.status) || !s.status);
  if (!open.length) {
    throw new Error(
      `No available Calendly slots in the next window for event type ${avail.eventTypeUri}`,
    );
  }
  const booked = await bookEventInvitee(ctx, {
    eventTypeUri: avail.eventTypeUri,
    startTime: open[0].startTime,
    name: opts.name,
    email: opts.email,
    timezone: opts.timezone,
    phone: opts.phone,
  });
  return { ...booked, slotsConsidered: open.length };
}

/**
 * Read a scheduled event and its first invitee, exposing the invitee
 * cancel/reschedule URLs (GET /scheduled_events/{uuid} + /invitees).
 */
export async function getAppointment(
  ctx: AdapterContext,
  opts: { eventUuid?: string; eventUri?: string },
): Promise<{
  event: CalendlyResource;
  invitee: CalendlyResource | null;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
  status: string | null;
  startsAt: string | null;
  endsAt: string | null;
}> {
  const uuid = opts.eventUuid || (opts.eventUri ? uuidFromUri(opts.eventUri) : "");
  if (!uuid) {
    throw new Error("getAppointment requires eventUuid or eventUri");
  }
  try {
    const eventRes = await calendlyApi<{ resource?: CalendlyResource }>(
      `/scheduled_events/${encodeURIComponent(uuid)}`,
      ctx,
    );
    const event = eventRes.resource || {};

    let invitee: CalendlyResource | null = null;
    let cancelUrl: string | null = null;
    let rescheduleUrl: string | null = null;
    try {
      const invRes = await calendlyApi<{ collection?: CalendlyResource[] }>(
        `/scheduled_events/${encodeURIComponent(uuid)}/invitees?count=1`,
        ctx,
      );
      invitee = (invRes.collection || [])[0] || null;
      if (invitee) {
        cancelUrl = (invitee.cancel_url as string) || null;
        rescheduleUrl = (invitee.reschedule_url as string) || null;
      }
    } catch {
      // invitee fetch may fail on plan/role — still return the event
    }

    return {
      event,
      invitee,
      cancelUrl,
      rescheduleUrl,
      status: (event.status as string) || null,
      startsAt: (event.start_time as string) || null,
      endsAt: (event.end_time as string) || null,
    };
  } catch (err) {
    return wrapCalendlyError(err, "retrieve appointment");
  }
}
