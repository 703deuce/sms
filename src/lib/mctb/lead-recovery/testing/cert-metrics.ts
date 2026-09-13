let inputTokens = 0;
let outputTokens = 0;
let unrequestedActionAttempts = 0;

export function resetCertMetrics() {
  inputTokens = 0;
  outputTokens = 0;
  unrequestedActionAttempts = 0;
}

export function recordCertLlmUsage(usage: { inputTokens?: number; outputTokens?: number }) {
  inputTokens += usage.inputTokens ?? 0;
  outputTokens += usage.outputTokens ?? 0;
}

export function recordUnrequestedActionAttempt() {
  unrequestedActionAttempts += 1;
}

export function snapshotCertMetrics() {
  return { inputTokens, outputTokens, unrequestedActionAttempts };
}
