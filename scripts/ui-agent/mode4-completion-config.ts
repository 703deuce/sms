/**
 * Orchestration config for Mode 4 completion batches — not fundamental mode behavior.
 * The completion runner itself is surface-agnostic; this file defines batch ordering for golden screens.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_DIR } from "./config";

const ORDER_PATH = join(UI_AGENT_DIR, "mode4", "golden-completion-order.json");

export type GoldenCompletionOrderConfig = {
  description?: string;
  manifestIds: string[];
};

const DEFAULT_ORDER: GoldenCompletionOrderConfig = {
  description: "Stage E golden authority screens",
  manifestIds: [
    "appointments-calendar",
    "booking-types",
    "home",
    "appointments-list",
    "appointment-detail",
    "workflow-builder",
  ],
};

export function loadGoldenCompletionOrder(): GoldenCompletionOrderConfig {
  if (!existsSync(ORDER_PATH)) return DEFAULT_ORDER;
  try {
    const parsed = JSON.parse(readFileSync(ORDER_PATH, "utf8")) as GoldenCompletionOrderConfig;
    if (!Array.isArray(parsed.manifestIds) || parsed.manifestIds.length === 0) {
      return DEFAULT_ORDER;
    }
    return parsed;
  } catch {
    return DEFAULT_ORDER;
  }
}
