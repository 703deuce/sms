export const PD_API_SCOPES = [
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

export type PowerDialerApiScope = (typeof PD_API_SCOPES)[number];

export function scopeAllows(required: PowerDialerApiScope, granted: string[]): boolean {
  if (granted.includes("admin")) return true;
  return granted.includes(required);
}
