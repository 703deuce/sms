/** Client-safe copies of public API / webhook catalogs (keep in sync with server modules). */
export const PD_API_SCOPES_CLIENT = [
  "contacts:read",
  "contacts:write",
  "lists:read",
  "lists:write",
  "campaigns:read",
  "sessions:read",
  "attempts:read",
  "dispositions:read",
  "callbacks:read",
  "callbacks:write",
  "tasks:read",
  "tasks:write",
  "dnc:read",
  "dnc:write",
  "webhooks:manage",
  "dial:write",
] as const;

export const POWER_DIALER_WEBHOOK_EVENTS_CLIENT = [
  "call.started",
  "call.answered",
  "call.ended",
  "disposition.saved",
  "callback.created",
  "contact.created",
  "contact.updated",
  "session.started",
  "session.ended",
  "campaign.completed",
  "dnc.added",
] as const;
