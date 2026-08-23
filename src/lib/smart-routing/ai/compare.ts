import type { DraftConfig } from "../types";
import type { AiRoutingContextDestination, AiRoutingProposedChange } from "./types";
import { summarizeDraftConfig, summarizeMenuOptionRoute } from "./config-summary";

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function compareRoutingConfigs(
  current: DraftConfig,
  proposed: DraftConfig,
  destinations: AiRoutingContextDestination[] = [],
): AiRoutingProposedChange[] {
  const changes: AiRoutingProposedChange[] = [];
  const areas = new Set<string>();

  for (const opt of proposed.menuOptions ?? []) {
    areas.add(opt.label);
  }
  for (const opt of current.menuOptions ?? []) {
    areas.add(opt.label);
  }
  areas.add("Greeting");
  areas.add("Ring group");
  areas.add("Business hours");
  areas.add("Fallback");

  for (const area of areas) {
    if (area === "Greeting") {
      const cur = current.greeting?.text?.trim() ?? "";
      const prop = proposed.greeting?.text?.trim() ?? "";
      if (cur !== prop) {
        changes.push({
          area: "Greeting",
          currentSummary: cur || "No greeting text",
          proposedSummary: prop || "No greeting text",
          changeType: "modify",
        });
      } else if (cur) {
        changes.push({
          area: "Greeting",
          currentSummary: cur,
          proposedSummary: cur,
          changeType: "none",
        });
      }
      continue;
    }

    if (area === "Ring group") {
      const curRing = current.nodes?.find((n) => n.type === "RING_GROUP");
      const propRing = proposed.nodes?.find((n) => n.type === "RING_GROUP");
      const curSum = curRing
        ? summarizeDraftConfig({ nodes: [curRing], edges: [] }, destinations)
        : "—";
      const propSum = propRing
        ? summarizeDraftConfig({ nodes: [propRing], edges: [] }, destinations)
        : "—";
      if (curSum !== propSum) {
        changes.push({
          area: "Ring group",
          currentSummary: curSum,
          proposedSummary: propSum,
          changeType: curRing ? "modify" : "add",
        });
      }
      continue;
    }

    const curRoute = summarizeMenuOptionRoute(current, area, destinations);
    const propRoute = summarizeMenuOptionRoute(proposed, area, destinations);
    if (curRoute || propRoute) {
      const cur = curRoute ?? "Not configured";
      const prop = propRoute ?? "Removed";
      changes.push({
        area,
        currentSummary: cur,
        proposedSummary: prop,
        changeType:
          cur === prop
            ? "none"
            : cur === "Not configured"
              ? "add"
              : prop === "Removed"
                ? "remove"
                : "modify",
      });
    }
  }

  const curMenuDigits = new Set((current.menuOptions ?? []).map((o) => o.digit));
  const propMenuDigits = new Set((proposed.menuOptions ?? []).map((o) => o.digit));
  for (const digit of curMenuDigits) {
    if (!propMenuDigits.has(digit)) {
      const label = current.menuOptions?.find((o) => o.digit === digit)?.label ?? digit;
      if (!changes.some((c) => c.area === label)) {
        changes.push({
          area: label,
          currentSummary: summarizeMenuOptionRoute(current, label, destinations) ?? "Configured",
          proposedSummary: "Removed from menu",
          changeType: "remove",
        });
      }
    }
  }

  if (!changes.length) {
    changes.push({
      area: "Routing",
      currentSummary: summarizeDraftConfig(current, destinations),
      proposedSummary: summarizeDraftConfig(proposed, destinations),
      changeType: "none",
    });
  }

  return changes;
}

export function configsEqual(a: DraftConfig, b: DraftConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeDraftConfigScoped(
  current: DraftConfig,
  patch: Partial<DraftConfig>,
): DraftConfig {
  return {
    ...current,
    ...patch,
    greeting: patch.greeting ? { ...current.greeting, ...patch.greeting } : current.greeting,
    menuOptions: patch.menuOptions ?? current.menuOptions,
    nodes: patch.nodes ?? current.nodes,
    edges: patch.edges ?? current.edges,
    metadata: { ...current.metadata, ...patch.metadata },
  };
}
