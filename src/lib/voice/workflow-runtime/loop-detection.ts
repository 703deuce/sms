import { createHash } from "node:crypto";

export type ToolCallRecord = {
  toolName: string;
  fingerprint: string;
  resultHash: string;
  atMs: number;
  noProgress: boolean;
};

export type NoProgressLoopResult = {
  blocked: boolean;
  code?: "NO_PROGRESS_LOOP";
  repeatCount: number;
  toolName: string;
};

const MAX_HISTORY = 12;
const NO_PROGRESS_THRESHOLD = 2;

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function fingerprintToolCall(input: {
  toolName: string;
  args?: Record<string, unknown>;
  nodeId?: string | null;
  missingFieldCount?: number;
}): string {
  return hashPayload({
    tool: input.toolName,
    args: input.args || {},
    node: input.nodeId || "",
    missing: input.missingFieldCount ?? 0,
  });
}

export function recordToolCallHistory(
  history: ToolCallRecord[],
  entry: ToolCallRecord,
): ToolCallRecord[] {
  const next = [...history, entry];
  if (next.length > MAX_HISTORY) next.splice(0, next.length - MAX_HISTORY);
  return next;
}

/**
 * Block before executing if history already shows repeated no-progress calls.
 */
export function shouldBlockRepeatedToolCall(input: {
  history: ToolCallRecord[];
  toolName: string;
  fingerprint: string;
}): NoProgressLoopResult {
  const recent = input.history.filter((h) => h.toolName === input.toolName && h.noProgress);
  let repeatCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const row = recent[i]!;
    if (row.fingerprint !== input.fingerprint) break;
    repeatCount++;
  }

  if (repeatCount >= NO_PROGRESS_THRESHOLD) {
    return {
      blocked: true,
      code: "NO_PROGRESS_LOOP",
      repeatCount,
      toolName: input.toolName,
    };
  }

  return { blocked: false, repeatCount, toolName: input.toolName };
}

/**
 * Detect repeated identical tool calls with no material progress.
 * Used after execution to record whether the call made progress.
 */
export function detectNoProgressLoop(input: {
  history: ToolCallRecord[];
  toolName: string;
  fingerprint: string;
  resultHash: string;
  noProgress: boolean;
}): NoProgressLoopResult {
  if (!input.noProgress) {
    return { blocked: false, repeatCount: 0, toolName: input.toolName };
  }

  const recent = input.history.filter((h) => h.toolName === input.toolName);
  let repeatCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const row = recent[i]!;
    if (row.fingerprint !== input.fingerprint || row.resultHash !== input.resultHash) break;
    if (row.noProgress) repeatCount++;
  }

  if (repeatCount >= NO_PROGRESS_THRESHOLD) {
    return {
      blocked: true,
      code: "NO_PROGRESS_LOOP",
      repeatCount,
      toolName: input.toolName,
    };
  }

  return { blocked: false, repeatCount, toolName: input.toolName };
}

export function isNoProgressToolResult(input: {
  toolName: string;
  ok: boolean;
  beforeMissingCount: number;
  afterMissingCount: number;
  beforeNodeId: string;
  afterNodeId: string;
}): boolean {
  if (!input.ok) return false;
  if (input.toolName === "get_booking_requirements") {
    return (
      input.beforeMissingCount === input.afterMissingCount &&
      input.beforeNodeId === input.afterNodeId
    );
  }
  if (input.toolName === "submit_caller_information" || input.toolName === "record_current_field") {
    return input.beforeMissingCount === input.afterMissingCount;
  }
  return input.beforeNodeId === input.afterNodeId;
}

export { hashPayload as hashToolResult };
