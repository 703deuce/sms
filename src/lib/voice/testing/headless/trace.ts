import type { HeadlessFailureCode, HeadlessScenarioResult, HeadlessTurnTrace } from "./types";

export function formatHeadlessTrace(result: HeadlessScenarioResult): string {
  const lines: string[] = [];
  lines.push(`SCENARIO: ${result.name}`);
  lines.push(result.passed ? "PASS" : "FAIL");
  if (result.failures.length) {
    for (const f of result.failures) {
      lines.push(`FAIL — ${f.code}: ${f.detail}`);
    }
  }
  lines.push(`TOTAL SMS (recording adapter): ${result.totalSms}`);
  lines.push("");

  for (const turn of result.turns) {
    lines.push(`TURN ${turn.turn}`);
    lines.push(`CALLER:\n"${turn.caller}"`);
    if (turn.promptVersion) {
      lines.push(`PROMPT: ${turn.promptVersion} / ctx ${turn.businessContextRevision || "?"}`);
    }
    if (turn.assistantText) {
      lines.push(`AGENT RESPONSE:\n"${turn.assistantText}"`);
    }
    for (const tr of turn.toolRequests) {
      lines.push(`MODEL TOOL REQUEST: ${tr.toolType}`);
      lines.push(`MODEL ARGUMENTS:\n${JSON.stringify(tr.arguments, null, 2)}`);
      lines.push(`WEBHOOK HTTP: ${tr.webhookStatus}`);
      lines.push(`WEBHOOK RESULT:\n${JSON.stringify(tr.webhookJson, null, 2)}`);
      lines.push(`LATENCY: ${tr.latencyMs}ms`);
    }
    lines.push(`SMS AFTER TURN: ${turn.smsCountAfterTurn}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function fail(
  code: HeadlessFailureCode,
  detail: string,
): { code: HeadlessFailureCode; detail: string } {
  return { code, detail };
}

export function emptyTurn(turn: number, caller: string): HeadlessTurnTrace {
  return {
    turn,
    caller,
    toolRequests: [],
    smsCountAfterTurn: 0,
  };
}
