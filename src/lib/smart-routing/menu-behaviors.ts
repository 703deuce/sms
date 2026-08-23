import type { DraftConfig, DraftEdge, DraftNode } from "./types";

export type MenuNoInputAction =
  | "ring_main_team"
  | "ring_destination"
  | "ring_group"
  | "replay_menu"
  | "voicemail"
  | "callback"
  | "mctb"
  | "end";

export type MenuBehaviors = {
  noInput?: {
    action: MenuNoInputAction;
    destinationId?: string;
    destinationIds?: string[];
  };
  invalidInput?: {
    action: "replay" | "replay_once_ring_team" | "operator" | "voicemail";
    maxRetries?: number;
  };
  operator?: {
    enabled?: boolean;
    destinationId?: string;
  };
  screeningMode?: "off" | "all" | "unknown_only";
};

function edgeId(from: string, condition: string, to: string): string {
  return `${from}_${condition}_${to}`;
}

function findFirstNode(nodes: DraftNode[], type: string): DraftNode | undefined {
  return nodes.find((n) => n.type === type);
}

function ensureEdge(edges: DraftEdge[], edge: DraftEdge): DraftEdge[] {
  const exists = edges.some(
    (e) =>
      e.fromNodeId === edge.fromNodeId &&
      e.conditionType === edge.conditionType &&
      e.conditionValue === edge.conditionValue,
  );
  if (exists) return edges;
  return [...edges, edge];
}

/**
 * Apply customer-facing menu behavior settings to draft edges before compile.
 * Does not mutate membership on ring groups — only wires timeout/invalid/operator paths.
 */
export function applyMenuBehaviorsToDraft(draft: DraftConfig): DraftConfig {
  const metadata = (draft.metadata ?? {}) as { menuBehaviors?: MenuBehaviors };
  const behaviors = metadata.menuBehaviors;
  if (!behaviors) return draft;

  const nodes = [...(draft.nodes ?? [])];
  let edges = [...(draft.edges ?? [])];
  const menuNodes = nodes.filter((n) => n.type === "MENU" || n.type === "GATHER_DTMF");

  const vmNode = findFirstNode(nodes, "VOICEMAIL");
  const hangupNode = findFirstNode(nodes, "HANGUP");
  const callbackNode = findFirstNode(nodes, "CALLBACK");
  const ringNode = findFirstNode(nodes, "RING_GROUP");
  const mctbNode = findFirstNode(nodes, "SMS_CONSENT");

  for (const menu of menuNodes) {
    if (behaviors.noInput?.action) {
      let targetId: string | undefined;
      switch (behaviors.noInput.action) {
        case "ring_main_team":
          targetId = ringNode?.id;
          break;
        case "ring_destination":
        case "ring_group":
          if (behaviors.noInput.destinationId) {
            const transfer = nodes.find(
              (n) =>
                n.type === "TRANSFER_EXTERNAL" &&
                String(n.config.destinationId ?? "") === behaviors.noInput?.destinationId,
            );
            targetId = transfer?.id ?? ringNode?.id;
          } else if (behaviors.noInput.destinationIds?.length) {
            targetId = ringNode?.id;
          }
          break;
        case "replay_menu":
          targetId = menu.id;
          break;
        case "voicemail":
          targetId = vmNode?.id;
          break;
        case "callback":
          targetId = callbackNode?.id;
          break;
        case "mctb":
          targetId = mctbNode?.id;
          break;
        case "end":
          targetId = hangupNode?.id;
          break;
      }
      if (targetId) {
        edges = ensureEdge(edges, {
          id: edgeId(menu.id, "timeout", targetId),
          fromNodeId: menu.id,
          toNodeId: targetId,
          conditionType: "timeout",
        });
      }
    }

    if (behaviors.invalidInput?.action) {
      let targetId: string | undefined;
      switch (behaviors.invalidInput.action) {
        case "replay":
          targetId = menu.id;
          break;
        case "replay_once_ring_team":
          targetId = menu.id;
          edges = ensureEdge(edges, {
            id: edgeId(menu.id, "invalid_retry", ringNode?.id ?? vmNode?.id ?? menu.id),
            fromNodeId: menu.id,
            toNodeId: ringNode?.id ?? vmNode?.id ?? menu.id,
            conditionType: "invalid",
            conditionValue: "2",
          });
          break;
        case "operator":
          targetId = behaviors.operator?.destinationId
            ? nodes.find(
                (n) =>
                  n.type === "TRANSFER_EXTERNAL" &&
                  String(n.config.destinationId ?? "") === behaviors.operator?.destinationId,
              )?.id
            : ringNode?.id;
          break;
        case "voicemail":
          targetId = vmNode?.id;
          break;
      }
      if (targetId) {
        edges = ensureEdge(edges, {
          id: edgeId(menu.id, "invalid", targetId),
          fromNodeId: menu.id,
          toNodeId: targetId,
          conditionType: "invalid",
        });
      }
    }

    if (behaviors.operator?.enabled) {
      const opDest = behaviors.operator.destinationId;
      const opTarget =
        opDest
          ? nodes.find(
              (n) =>
                n.type === "TRANSFER_EXTERNAL" &&
                String(n.config.destinationId ?? "") === opDest,
            )?.id
          : ringNode?.id;
      if (opTarget) {
        edges = ensureEdge(edges, {
          id: edgeId(menu.id, "digit", "0"),
          fromNodeId: menu.id,
          toNodeId: opTarget,
          conditionType: "digit",
          conditionValue: "0",
        });
        const opts = (menu.config.menuOptions as Array<{ digit: string; label: string }>) ?? [];
        if (!opts.some((o) => o.digit === "0")) {
          menu.config = {
            ...menu.config,
            menuOptions: [...opts, { digit: "0", label: "Operator" }],
          };
        }
      }
    }
  }

  return { ...draft, nodes, edges, metadata: { ...metadata, menuBehaviors: behaviors } };
}
