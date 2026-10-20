import "server-only";

import type { AgentConfig, ConversationalRoute } from "@/lib/agent";
import { isConversationalIvrEditor } from "@/lib/receptionist/runtime-profile";
import { getForwardingConfig } from "@/lib/server/phone/routing/store";

async function hydrateOneRoute(
  workspaceId: string,
  route: ConversationalRoute,
  ctx: {
    destinations: Awaited<ReturnType<typeof getForwardingConfig>>["destinations"];
    groups: Awaited<ReturnType<typeof getForwardingConfig>>["groups"];
  },
): Promise<ConversationalRoute> {
  if (!route.enabled || !route.destinationRef) {
    return { ...route, publishRingGroupPlan: undefined };
  }

  if (route.destinationKind === "transfer_destination") {
    return { ...route, publishRingGroupPlan: undefined };
  }

  if (route.destinationKind === "forwarding_destination") {
    const row = ctx.destinations.find((d) => d.id === route.destinationRef);
    if (!row || !row.enabled) {
      return {
        ...route,
        destinationPhoneE164: undefined,
        destinationLabel: row?.name ?? route.destinationLabel,
        publishRingGroupPlan: undefined,
      };
    }
    return {
      ...route,
      destinationPhoneE164: row.phoneE164,
      destinationLabel: row.name,
      publishRingGroupPlan: undefined,
    };
  }

  if (route.destinationKind === "ring_group") {
    const group = ctx.groups.find((g) => g.id === route.destinationRef);
    if (!group || !group.enabled) {
      return {
        ...route,
        destinationPhoneE164: undefined,
        destinationLabel: group?.name ?? route.destinationLabel,
        publishRingGroupPlan: undefined,
      };
    }
    const strategy = group.strategy === "simultaneous" ? "simultaneous" : "sequential";
    const members: Array<{
      destinationId: string;
      phoneE164: string;
      label: string;
      timeoutSec: number;
    }> = [];
    for (const m of group.members) {
      if (!m.enabled || !m.destination?.enabled) continue;
      const e164 = m.destination.phoneE164?.trim() || "";
      if (!e164) continue;
      members.push({
        destinationId: m.destination.id,
        phoneE164: e164,
        label: m.destination.name,
        timeoutSec: m.destination.ringTimeoutSec ?? 25,
      });
    }
    return {
      ...route,
      destinationPhoneE164: undefined,
      destinationLabel: group.name,
      publishRingGroupPlan: members.length
        ? { strategy, members }
        : undefined,
    };
  }

  return route;
}

/**
 * Refresh Conversational IVR route dial targets from authoritative Phone forwarding config at publish time.
 */
export async function hydrateConversationalRoutesFromPhone(
  workspaceId: string,
  editor: AgentConfig,
): Promise<AgentConfig> {
  if (!isConversationalIvrEditor(editor)) return editor;
  const routes = editor.conversationalRoutes ?? [];
  if (!routes.length) return editor;

  const { destinations, groups } = await getForwardingConfig(workspaceId);
  const hydrated = await Promise.all(
    routes.map((r) => hydrateOneRoute(workspaceId, r, { destinations, groups })),
  );
  return { ...editor, conversationalRoutes: hydrated };
}
