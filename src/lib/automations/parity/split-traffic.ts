import { createHash } from "crypto";
import type { AutomationCanvasNode, AutomationDefinition } from "../types";
import { mergeExecutionMetadata } from "../metadata";
import { splitTrafficOutcomes } from "../block-registry";
import { outcomeResult } from "./resolve-outcome";

/** Deterministic path assignment per execution (stable across retries). */
export function assignSplitTrafficPath(
  executionId: string,
  nodeId: string,
  config: Record<string, unknown>,
): string {
  const outcomes = splitTrafficOutcomes(config);
  if (!outcomes.length) return "path_a";

  const percentages = Array.isArray(config.percentages)
    ? (config.percentages as number[])
    : [];
  const pathCount = outcomes.length;
  const even = Math.floor(100 / pathCount);
  const weights: number[] = [];
  for (let i = 0; i < pathCount; i++) {
    weights.push(
      percentages[i] ??
        (i === pathCount - 1 ? 100 - even * (pathCount - 1) : even),
    );
  }

  const hash = createHash("sha256")
    .update(`${executionId}:${nodeId}:split`)
    .digest();
  const bucket = hash.readUInt32BE(0) % 100;

  let cumulative = 0;
  for (let i = 0; i < outcomes.length; i++) {
    cumulative += weights[i] || 0;
    if (bucket < cumulative) return outcomes[i].id;
  }
  return outcomes[outcomes.length - 1].id;
}

export async function runSplitTraffic(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  executionId: string,
) {
  const cfg = node.data.config || {};
  const percentages = Array.isArray(cfg.percentages)
    ? (cfg.percentages as number[])
    : [];
  const pathCount = Math.min(6, Math.max(2, Number(cfg.pathCount || 2)));
  if (cfg.distribution === "custom") {
    const total = percentages.slice(0, pathCount).reduce((a, b) => a + Number(b || 0), 0);
    if (total !== 100) {
      return outcomeResult(def, node.id, "failed", {
        error: "percentages_must_total_100",
        total,
      });
    }
  }

  const exec = await import("@/lib/db").then((m) =>
    m.getPrisma().automationExecution.findUnique({
      where: { id: executionId },
      select: { metadata: true },
    }),
  );
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const cacheKey = `splitTraffic:${node.id}`;
  let path = meta[cacheKey] as string | undefined;
  if (!path) {
    path = assignSplitTrafficPath(executionId, node.id, cfg);
    await mergeExecutionMetadata(executionId, { [cacheKey]: path });
  }

  return outcomeResult(def, node.id, path, { path, deterministic: true });
}
