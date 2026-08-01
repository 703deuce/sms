/**
 * Event subscription declarations per provider.
 * The bus routes automatically — never hardcode provider event switches at call sites.
 */

import { ALL_CRM_PLATFORM_EVENT_TYPES, type CrmPlatformEventType, type CrmProviderId } from "../types";

export type EventSupportLevel = "supported" | "optional" | "unsupported";

export type ProviderEventSubscription = {
  provider: CrmProviderId;
  supported: CrmPlatformEventType[];
  optional: CrmPlatformEventType[];
  unsupported: CrmPlatformEventType[];
};

function build(
  provider: CrmProviderId,
  supported: CrmPlatformEventType[],
  optional: CrmPlatformEventType[] = [],
): ProviderEventSubscription {
  const known = new Set<CrmPlatformEventType>([...supported, ...optional]);
  return {
    provider,
    supported,
    optional,
    unsupported: ALL_CRM_PLATFORM_EVENT_TYPES.filter((t) => !known.has(t)),
  };
}

const COMMS: CrmPlatformEventType[] = [
  "call.incoming",
  "call.outgoing",
  "call.missed",
  "call.completed",
  "voicemail.received",
  "recording.ready",
  "transcript.ready",
  "ai_summary.ready",
  "sms.sent",
  "sms.delivered",
  "sms.failed",
  "sms.received",
  "callback.scheduled",
  "task.created",
  "task.completed",
  "contact.created",
  "contact.updated",
];

const OPTIONAL_META: CrmPlatformEventType[] = [
  "appointment.booked",
  "user.created",
  "user.updated",
];

const SUBSCRIPTIONS: Record<CrmProviderId, ProviderEventSubscription> = {
  salesforce: build("salesforce", COMMS, [...OPTIONAL_META, "lead.created"]),
  zoho: build("zoho", COMMS, [...OPTIONAL_META, "lead.created"]),
  // Pipedrive: no native Leads — lead.created is unsupported
  pipedrive: build("pipedrive", COMMS, OPTIONAL_META),
};

export function getProviderSubscription(provider: CrmProviderId): ProviderEventSubscription {
  return SUBSCRIPTIONS[provider];
}

export function eventSupportLevel(
  provider: CrmProviderId,
  type: CrmPlatformEventType,
): EventSupportLevel {
  const sub = SUBSCRIPTIONS[provider];
  if (sub.supported.includes(type)) return "supported";
  if (sub.optional.includes(type)) return "optional";
  return "unsupported";
}

export function providerAcceptsEvent(
  provider: CrmProviderId,
  type: CrmPlatformEventType,
): boolean {
  return eventSupportLevel(provider, type) !== "unsupported";
}

export function listAllSubscriptions(): ProviderEventSubscription[] {
  return Object.values(SUBSCRIPTIONS);
}
