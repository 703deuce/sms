/**
 * Deterministic draft builders for tests and scoped modifications.
 * Operates on canonical DraftConfig — no telephony/provider calls.
 */

import { templateForType } from "../templates";
import type { DraftConfig, DraftEdge, DraftNode } from "../types";
import type { AiRoutingContextDestination } from "./types";

function edge(
  from: string,
  to: string,
  conditionType = "always",
  conditionValue?: string,
): DraftEdge {
  return {
    id: `${from}_${conditionType}_${conditionValue ?? "next"}_${to}`,
    fromNodeId: from,
    toNodeId: to,
    conditionType,
    conditionValue,
  };
}

function node(
  id: string,
  type: DraftNode["type"],
  config: Record<string, unknown> = {},
): DraftNode {
  return { id, type, config };
}

export function buildPhoneMenuDraftFromDestinations(input: {
  menuOptions: Array<{
    digit: string;
    label: string;
    destination: AiRoutingContextDestination;
    ringMode?: "simultaneous" | "sequential";
    extraDestinations?: AiRoutingContextDestination[];
    timeoutSeconds?: number;
    overflowDestination?: AiRoutingContextDestination;
  }>;
  greetingText?: string;
  businessHours?: { days: string; open: string; close: string };
  afterHoursVoicemail?: boolean;
}): DraftConfig {
  const template = templateForType("phone_menu");
  const nodes: DraftNode[] = [
    node("entry", "ENTRY"),
    node("menu", "MENU", {
      promptText: input.greetingText ?? "Thanks for calling. Please listen to the options.",
    }),
    node("vm", "VOICEMAIL", { label: "Business Voicemail" }),
    node("hangup", "HANGUP"),
  ];
  const edges: DraftEdge[] = [edge("entry", "menu"), edge("vm", "hangup")];
  const menuOptions: DraftConfig["menuOptions"] = [];

  for (const opt of input.menuOptions) {
    const nodeId = `opt_${opt.digit}`;
    const dests = [opt.destination, ...(opt.extraDestinations ?? [])];
    if (dests.length > 1 || opt.ringMode === "simultaneous") {
      nodes.push(
        node(nodeId, "RING_GROUP", {
          label: opt.label,
          mode: opt.ringMode ?? "simultaneous",
          destinationIds: dests.map((d) => d.id),
          timeoutSeconds: opt.timeoutSeconds ?? 20,
        }),
      );
    } else {
      nodes.push(
        node(nodeId, "TRANSFER_EXTERNAL", {
          label: opt.label,
          destinationId: opt.destination.id,
          phoneNumber: opt.destination.phoneNumber,
        }),
      );
    }
    edges.push(edge("menu", nodeId, "digit", opt.digit));
    if (opt.overflowDestination) {
      const overflowId = `overflow_${opt.digit}`;
      nodes.push(
        node(overflowId, "TRANSFER_EXTERNAL", {
          label: opt.overflowDestination.label,
          destinationId: opt.overflowDestination.id,
          phoneNumber: opt.overflowDestination.phoneNumber,
        }),
      );
      edges.push(edge(nodeId, overflowId, "no_answer"));
      edges.push(edge(overflowId, "vm", "no_answer"));
    } else {
      edges.push(edge(nodeId, "vm", "no_answer"));
    }
    menuOptions.push({
      digit: opt.digit,
      label: opt.label,
      action: "transfer",
      destinationId: opt.destination.id,
      phoneNumber: opt.destination.phoneNumber ?? undefined,
    });
  }
  edges.push(edge("menu", "vm", "timeout"));

  if (input.businessHours) {
    const hoursNode = node("hours", "BUSINESS_HOURS", {
      schedule: input.businessHours,
    });
    const openMenu = node("open_menu", "MENU", { promptText: input.greetingText ?? "" });
    const closedMenu = node("closed_menu", "MENU", {
      promptText: "We are currently closed.",
    });
    nodes.unshift(hoursNode, openMenu, closedMenu);
    edges.unshift(
      edge("entry", "hours"),
      edge("hours", "open_menu", "open"),
      edge("hours", "closed_menu", "closed"),
      edge("closed_menu", "vm", "timeout"),
    );
    // rewire entry
    const entryEdge = edges.find((e) => e.fromNodeId === "entry" && e.toNodeId === "menu");
    if (entryEdge) {
      entryEdge.toNodeId = "hours";
    }
    edges.push(edge("open_menu", "menu"));
  }

  return {
    greeting: {
      source: "elevenlabs",
      text: input.greetingText ?? template.draftConfig.greeting?.text,
    },
    menuOptions,
    nodes,
    edges,
  };
}

export function addDestinationToMenuOption(
  current: DraftConfig,
  menuLabel: string,
  destination: AiRoutingContextDestination,
  mode: "simultaneous" | "sequential" = "simultaneous",
): DraftConfig {
  const draft = JSON.parse(JSON.stringify(current)) as DraftConfig;
  const opt = (draft.menuOptions ?? []).find(
    (o) => o.label.toLowerCase() === menuLabel.toLowerCase(),
  );
  if (!opt) throw new Error(`Menu option ${menuLabel} not found`);

  const menuNode = (draft.nodes ?? []).find((n) => n.type === "MENU");
  if (!menuNode) throw new Error("No menu node");

  const menuEdge = (draft.edges ?? []).find(
    (e) =>
      e.fromNodeId === menuNode.id &&
      e.conditionType === "digit" &&
      e.conditionValue === opt.digit,
  );
  if (!menuEdge) throw new Error("Menu edge not found");

  const target = (draft.nodes ?? []).find((n) => n.id === menuEdge.toNodeId);
  if (!target) throw new Error("Target node not found");

  if (target.type === "RING_GROUP") {
    const ids = (target.config.destinationIds as string[] | undefined) ?? [];
    if (!ids.includes(destination.id)) ids.push(destination.id);
    target.config.destinationIds = ids;
    target.config.mode = mode;
  } else if (target.type === "TRANSFER_EXTERNAL") {
    const existingId = String(target.config.destinationId ?? "");
    if (existingId === destination.id) return draft;
    target.type = "RING_GROUP";
    target.config = {
      label: opt.label,
      mode,
      destinationIds: existingId ? [existingId, destination.id] : [destination.id],
      timeoutSeconds: 20,
    };
  }

  return draft;
}

export function applyTemporaryDestinationSwap(
  current: DraftConfig,
  fromDestinationId: string,
  toDestination: AiRoutingContextDestination,
  expiresAt: string,
): DraftConfig {
  const snapshot = JSON.parse(JSON.stringify(current)) as DraftConfig;
  const draft = JSON.parse(JSON.stringify(current)) as DraftConfig;

  for (const n of draft.nodes ?? []) {
    if (n.type === "TRANSFER_EXTERNAL" && n.config.destinationId === fromDestinationId) {
      n.config.destinationId = toDestination.id;
      n.config.phoneNumber = toDestination.phoneNumber;
    }
    if (n.type === "RING_GROUP") {
      const ids = (n.config.destinationIds as string[] | undefined) ?? [];
      if (ids.includes(fromDestinationId)) {
        n.config.destinationIds = ids.map((id) =>
          id === fromDestinationId ? toDestination.id : id,
        );
      }
    }
  }

  draft.metadata = {
    ...draft.metadata,
    temporaryRoutingRestore: {
      expiresAt,
      snapshotDraftConfig: snapshot,
    },
  };

  return draft;
}

export function restoreExpiredTemporaryRouting(draft: DraftConfig): DraftConfig | null {
  const meta = draft.metadata as Record<string, unknown> | undefined;
  const restore = meta?.temporaryRoutingRestore as
    | { expiresAt?: string; snapshotDraftConfig?: DraftConfig }
    | undefined;
  if (!restore?.expiresAt || !restore.snapshotDraftConfig) return null;
  const exp = new Date(restore.expiresAt);
  if (exp > new Date()) return null;
  return restore.snapshotDraftConfig;
}
