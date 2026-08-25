/**
 * Structured tool result semantics for Owner Amy and specialists.
 */

export type ToolResultStatus =
  | "completed"
  | "queued"
  | "blocked"
  | "not_found"
  | "failed";

export type ToolResult<T = unknown> =
  | { status: "completed"; data: T }
  | { status: "queued"; jobId: string; message: string }
  | { status: "blocked"; code: string; requiredAction: string }
  | { status: "not_found"; message: string }
  | { status: "failed"; code: string; retryable: boolean; message: string };

export function toolCompleted<T>(data: T): ToolResult<T> {
  return { status: "completed", data };
}

export function toolQueued(jobId: string, message: string): ToolResult<never> {
  return { status: "queued", jobId, message };
}

export function toolBlocked(code: string, requiredAction: string): ToolResult<never> {
  return { status: "blocked", code, requiredAction };
}

export function toolNotFound(message: string): ToolResult<never> {
  return { status: "not_found", message };
}

export function toolFailed(
  code: string,
  message: string,
  retryable = false,
): ToolResult<never> {
  return { status: "failed", code, retryable, message };
}

/** Wrap raw control API output into ToolResult when possible. */
export function wrapToolOutput(data: unknown): ToolResult {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.status === "queued" && d.jobId) {
      return toolQueued(String(d.jobId), String(d.message || "Job queued"));
    }
    if (d.ok === false || d.error) {
      return toolFailed(
        String(d.code || "tool_error"),
        String(d.error || d.message || "Tool failed"),
        Boolean(d.retryable),
      );
    }
    if (d.blocked) {
      return toolBlocked(
        String(d.code || "blocked"),
        String(d.requiredAction || d.message || "Action blocked"),
      );
    }
    if (d.notFound) {
      return toolNotFound(String(d.message || "Not found"));
    }
  }
  return toolCompleted(data);
}

export function stringifyToolResult(result: ToolResult | unknown): string {
  const wrapped =
    result && typeof result === "object" && "status" in (result as object)
      ? (result as ToolResult)
      : wrapToolOutput(result);
  const raw = JSON.stringify(wrapped, null, 2);
  if (raw.length <= 12_000) return raw;
  return `${raw.slice(0, 12_000)}\n…[truncated]`;
}
