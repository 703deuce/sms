import { getAdapter } from "./registry";
import { getCatalogEntry } from "./catalog";
import type { ExternalProviderId, FeatureSupport, NormalizedActionId } from "./types";
import type { IntegrationActionId } from "./actions-registry";

/** Map automation/AI action ids onto adapter capability action keys. */
export const ACTION_TO_CAPABILITY: Partial<Record<IntegrationActionId, NormalizedActionId>> = {
  "contact.upsert": "upsert_contact",
  "customer.upsert": "upsert_customer",
  "contact.add_tag": "add_tag",
  "contact.remove_tag": "remove_tag",
  "contact.add_to_list": "add_to_list",
  "contact.remove_from_list": "remove_from_list",
  "deal.upsert": "upsert_deal",
  "deal.change_stage": "upsert_deal",
  "task.create": "create_task",
  "note.create": "create_note",
  "ticket.create": "upsert_ticket",
  "ticket.update": "upsert_ticket",
  "ticket.add_private_note": "add_ticket_comment",
  "ticket.add_public_reply": "add_ticket_comment",
  "order.add_note": "add_order_note",
};

export type CapabilityTruth = {
  provider: ExternalProviderId;
  actionId?: string;
  capability?: NormalizedActionId;
  supported: boolean;
  support?: FeatureSupport;
  reason?: string;
  reconnectHint?: string;
};

/** Single source of truth for UI action menus — never hardcode capabilities per page. */
export function getActionCapabilityTruth(
  provider: ExternalProviderId,
  actionId: IntegrationActionId,
  opts?: { accountCapabilities?: string[]; missingScopes?: string[] },
): CapabilityTruth {
  const catalog = getCatalogEntry(provider);
  const capability = ACTION_TO_CAPABILITY[actionId];
  if (!capability) {
    return {
      provider,
      actionId,
      supported: false,
      reason: `Unknown capability mapping for ${actionId}`,
    };
  }

  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch {
    return {
      provider,
      actionId,
      capability,
      supported: false,
      reason: `${catalog?.displayName || provider} adapter is not registered.`,
    };
  }

  const support = adapter.capabilities.actions[capability];
  if (!support || support === "unsupported") {
    return {
      provider,
      actionId,
      capability,
      supported: false,
      support: support || "unsupported",
      reason: `${catalog?.displayName || provider} does not support ${actionId}.`,
    };
  }

  if (opts?.accountCapabilities && !opts.accountCapabilities.includes(capability)) {
    return {
      provider,
      actionId,
      capability,
      supported: false,
      support,
      reason: "This connected account does not expose this capability (plan, module, or role).",
      reconnectHint:
        "Reconnect with an account that has the required permissions, or upgrade the provider plan.",
    };
  }

  if (opts?.missingScopes?.length) {
    return {
      provider,
      actionId,
      capability,
      supported: false,
      support,
      reason: `Missing OAuth scopes: ${opts.missingScopes.join(", ")}`,
      reconnectHint: "Disconnect and reconnect to grant the required scopes.",
    };
  }

  return { provider, actionId, capability, supported: true, support };
}

export function listActionTruthForProvider(provider: ExternalProviderId): CapabilityTruth[] {
  return (Object.keys(ACTION_TO_CAPABILITY) as IntegrationActionId[]).map((actionId) =>
    getActionCapabilityTruth(provider, actionId),
  );
}
