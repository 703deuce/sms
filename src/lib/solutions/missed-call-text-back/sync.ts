import type { AutomationDefinition } from "@/lib/automations/types";
import { parseAutomationDefinition } from "@/lib/automations/types";
import {
  buildMissedCallTextBackDefinition,
  WIZARD_OWNED_NODE_IDS,
} from "@/lib/solutions/missed-call-text-back/graph";
import {
  MCTB_NODES,
  type MissedCallTextBackConfig,
} from "@/lib/solutions/missed-call-text-back/types";

function waitConfig(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return { days: 0, hours, minutes: rem, weeks: 0, respectBusinessHours: false };
}

function totalMinutesFromWait(cfg: Record<string, unknown>): number {
  return (
    Number(cfg.weeks || 0) * 7 * 24 * 60 +
    Number(cfg.days || 0) * 24 * 60 +
    Number(cfg.hours || 0) * 60 +
    Number(cfg.minutes || 0)
  );
}

function edgeKey(source: string, target: string, handle?: string | null) {
  return `${source}>${target}|${handle || "default"}`;
}

function canonicalOwnedEdgeKeys(hasFollowUp: boolean): Set<string> {
  const N = MCTB_NODES;
  const keys = [
    edgeKey(N.TRIGGER, N.WAIT_INITIAL),
    edgeKey(N.WAIT_INITIAL, N.SEND_INITIAL_SMS),
    edgeKey(N.SEND_INITIAL_SMS, N.WAIT_FOR_REPLY),
    edgeKey(N.WAIT_FOR_REPLY, N.CONDITION_REPLY),
    edgeKey(N.CONDITION_REPLY, N.END_REPLIED, "yes"),
  ];
  if (hasFollowUp) {
    keys.push(
      edgeKey(N.CONDITION_REPLY, N.WAIT_FOLLOW_UP, "no"),
      edgeKey(N.WAIT_FOLLOW_UP, N.SEND_FOLLOW_UP_SMS),
      edgeKey(N.SEND_FOLLOW_UP_SMS, N.END_DONE),
    );
  } else {
    keys.push(edgeKey(N.CONDITION_REPLY, N.END_DONE, "no"));
  }
  return new Set(keys);
}

/**
 * Detect whether the graph has structural changes outside wizard-owned nodes
 * or unexpected edges between wizard nodes.
 */
export function detectAdvancedCustomization(
  definition: unknown,
): boolean {
  const def = parseAutomationDefinition(definition);
  const unknownNodes = def.nodes.filter((n) => !WIZARD_OWNED_NODE_IDS.has(n.id));
  if (unknownNodes.length > 0) return true;

  // Unexpected block types on owned nodes.
  const expectedTypes: Record<string, string> = {
    [MCTB_NODES.TRIGGER]: "call_missed",
    [MCTB_NODES.WAIT_INITIAL]: "wait",
    [MCTB_NODES.SEND_INITIAL_SMS]: "send_sms",
    [MCTB_NODES.WAIT_FOR_REPLY]: "wait",
    [MCTB_NODES.CONDITION_REPLY]: "condition_has_responded",
    [MCTB_NODES.WAIT_FOLLOW_UP]: "wait",
    [MCTB_NODES.SEND_FOLLOW_UP_SMS]: "send_sms",
    [MCTB_NODES.END_REPLIED]: "end_automation",
    [MCTB_NODES.END_DONE]: "end_automation",
  };
  for (const node of def.nodes) {
    const expected = expectedTypes[node.id];
    if (expected && node.data.blockType !== expected) return true;
  }

  const ownedIds = new Set(
    def.nodes.map((n) => n.id).filter((id) => WIZARD_OWNED_NODE_IDS.has(id)),
  );
  const foreignEdges = def.edges.filter(
    (e) =>
      (!WIZARD_OWNED_NODE_IDS.has(e.source) || !WIZARD_OWNED_NODE_IDS.has(e.target)) &&
      (ownedIds.has(e.source) || ownedIds.has(e.target)),
  );
  if (foreignEdges.length > 0) return true;

  // Rewired edges between wizard-owned nodes (even without unknown nodes).
  const hasFollowUp = ownedIds.has(MCTB_NODES.SEND_FOLLOW_UP_SMS);
  const expected = canonicalOwnedEdgeKeys(hasFollowUp);
  const actualOwned = def.edges
    .filter(
      (e) =>
        WIZARD_OWNED_NODE_IDS.has(e.source) && WIZARD_OWNED_NODE_IDS.has(e.target),
    )
    .map((e) => edgeKey(e.source, e.target, e.sourceHandle));
  if (actualOwned.length !== expected.size) return true;
  for (const key of actualOwned) {
    if (!expected.has(key)) return true;
  }

  return false;
}

/**
 * Patch wizard-owned node configs in place. Preserves unknown nodes/edges.
 * Does not rebuild the whole graph.
 */
function cloneDefinition(existing: unknown): AutomationDefinition {
  const parsed = parseAutomationDefinition(existing);
  return {
    version: parsed.version,
    viewport: parsed.viewport ? { ...parsed.viewport } : { x: 0, y: 0, zoom: 1 },
    nodes: parsed.nodes.map((n) => ({
      ...n,
      position: { ...n.position },
      data: {
        ...n.data,
        config: { ...(n.data.config || {}) },
      },
    })),
    edges: parsed.edges.map((e) => ({ ...e })),
  };
}

export function applyWizardConfigToDefinition(
  existing: unknown,
  config: MissedCallTextBackConfig,
): { definition: AutomationDefinition; advancedCustomized: boolean } {
  const advancedCustomized = detectAdvancedCustomization(existing);
  const def = cloneDefinition(existing);

  // If graph is empty / missing trigger, seed a full canonical graph.
  if (!def.nodes.some((n) => n.id === MCTB_NODES.TRIGGER)) {
    return {
      definition: buildMissedCallTextBackDefinition(config),
      advancedCustomized: false,
    };
  }

  const patchNode = (
    id: string,
    patch: (cfg: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    const node = def.nodes.find((n) => n.id === id);
    if (!node) return;
    node.data.config = patch({ ...(node.data.config || {}) });
  };

  patchNode(MCTB_NODES.WAIT_INITIAL, () => waitConfig(config.initialDelayMinutes));
  patchNode(MCTB_NODES.SEND_INITIAL_SMS, (cfg) => ({
    ...cfg,
    body: config.firstMessage,
    stopOnReply: config.stopOnReply,
    phoneNumberId: config.phoneNumberId || cfg.phoneNumberId || "",
  }));
  patchNode(MCTB_NODES.WAIT_FOR_REPLY, () => waitConfig(config.replyWindowMinutes));

  if (!advancedCustomized) {
    // Safe structural follow-up updates only when not advanced-customized.
    const hasFollowUp = def.nodes.some((n) => n.id === MCTB_NODES.SEND_FOLLOW_UP_SMS);
    if (config.followUpEnabled && !hasFollowUp) {
      // Rebuild only the no-branch: replace with full graph but keep unknown nodes.
      const fresh = buildMissedCallTextBackDefinition(config);
      const unknown = def.nodes.filter((n) => !WIZARD_OWNED_NODE_IDS.has(n.id));
      const unknownEdges = def.edges.filter(
        (e) =>
          !WIZARD_OWNED_NODE_IDS.has(e.source) || !WIZARD_OWNED_NODE_IDS.has(e.target),
      );
      return {
        definition: {
          ...fresh,
          nodes: [...fresh.nodes, ...unknown],
          edges: [...fresh.edges, ...unknownEdges],
        },
        advancedCustomized: false,
      };
    }
    if (!config.followUpEnabled && hasFollowUp) {
      const fresh = buildMissedCallTextBackDefinition(config);
      const unknown = def.nodes.filter((n) => !WIZARD_OWNED_NODE_IDS.has(n.id));
      const unknownEdges = def.edges.filter(
        (e) =>
          !WIZARD_OWNED_NODE_IDS.has(e.source) || !WIZARD_OWNED_NODE_IDS.has(e.target),
      );
      return {
        definition: {
          ...fresh,
          nodes: [...fresh.nodes, ...unknown],
          edges: [...fresh.edges, ...unknownEdges],
        },
        advancedCustomized: false,
      };
    }
  }

  // Always safe field patches for follow-up content when nodes exist.
  patchNode(MCTB_NODES.WAIT_FOLLOW_UP, () => waitConfig(config.followUpDelayMinutes));
  patchNode(MCTB_NODES.SEND_FOLLOW_UP_SMS, (cfg) => ({
    ...cfg,
    body: config.followUpMessage,
    stopOnReply: config.stopOnReply,
    phoneNumberId: config.phoneNumberId || cfg.phoneNumberId || "",
  }));

  return { definition: def, advancedCustomized };
}

/** Read wizard config back from an existing definition (best-effort). */
export function configFromDefinition(
  definition: unknown,
  fallback: MissedCallTextBackConfig,
): MissedCallTextBackConfig {
  const def = parseAutomationDefinition(definition);
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const waitInitial = byId.get(MCTB_NODES.WAIT_INITIAL)?.data.config || {};
  const sendInitial = byId.get(MCTB_NODES.SEND_INITIAL_SMS)?.data.config || {};
  const waitReply = byId.get(MCTB_NODES.WAIT_FOR_REPLY)?.data.config || {};
  const waitFollow = byId.get(MCTB_NODES.WAIT_FOLLOW_UP)?.data.config || {};
  const sendFollow = byId.get(MCTB_NODES.SEND_FOLLOW_UP_SMS)?.data.config || {};
  const hasFollowUp = Boolean(byId.get(MCTB_NODES.SEND_FOLLOW_UP_SMS));

  const readMinutes = (
    cfg: Record<string, unknown>,
    fallbackMinutes: number,
    present: boolean,
  ) => {
    if (!present) return fallbackMinutes;
    return totalMinutesFromWait(cfg);
  };

  return {
    ...fallback,
    initialDelayMinutes: readMinutes(
      waitInitial,
      fallback.initialDelayMinutes,
      Boolean(byId.get(MCTB_NODES.WAIT_INITIAL)),
    ),
    firstMessage: String(sendInitial.body || fallback.firstMessage),
    replyWindowMinutes: readMinutes(
      waitReply,
      fallback.replyWindowMinutes,
      Boolean(byId.get(MCTB_NODES.WAIT_FOR_REPLY)),
    ),
    followUpEnabled: hasFollowUp,
    followUpDelayMinutes: readMinutes(
      waitFollow,
      fallback.followUpDelayMinutes,
      hasFollowUp,
    ),
    followUpMessage: String(sendFollow.body || fallback.followUpMessage),
    stopOnReply: Boolean(
      sendInitial.stopOnReply ?? fallback.stopOnReply,
    ),
    phoneNumberId:
      (typeof sendInitial.phoneNumberId === "string" &&
        sendInitial.phoneNumberId) ||
      fallback.phoneNumberId,
  };
}
