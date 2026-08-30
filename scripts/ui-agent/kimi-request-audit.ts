import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_SESSIONS_DIR } from "./config";
import { appendProgressLog } from "./progress";

export type KimiRequestPayloadReport = {
  recordedAt: string;
  model: string;
  reasoningEffort: string | null;
  maxOutputTokens: number | null;
  temperature: number;
  stream: boolean;
  responseFormat: string | null;
  messageRoles: string[];
  assistantHistoryTurns: number;
  previousReasoningPreserved: boolean;
  textPromptChars: number;
  systemPromptChars: number;
  userPromptChars: number;
  videoAttachments: number;
  imageAttachments: number;
  videoMsReferences: string[];
  leanPrompt: boolean;
  notes: string[];
};

function sessionDir(sessionId: string): string {
  return join(UI_AGENT_SESSIONS_DIR, sessionId);
}

export function auditPath(sessionId: string): string {
  return join(sessionDir(sessionId), "kimi-request-payload.json");
}

export function buildKimiRequestPayloadReport(input: {
  body: Record<string, unknown>;
  sessionId?: string;
  leanPrompt?: boolean;
  videoRefs: string[];
  imageCount: number;
  systemChars: number;
  userChars: number;
}): KimiRequestPayloadReport {
  const messages = (input.body.messages || []) as Array<{ role?: string; content?: unknown }>;
  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const reasoningEffort =
    typeof input.body.reasoning_effort === "string" ? input.body.reasoning_effort : null;

  return {
    recordedAt: new Date().toISOString(),
    model: String(input.body.model || ""),
    reasoningEffort,
    maxOutputTokens:
      typeof input.body.max_tokens === "number" ? input.body.max_tokens : null,
    temperature: typeof input.body.temperature === "number" ? input.body.temperature : 1,
    stream: Boolean(input.body.stream),
    responseFormat:
      (input.body.response_format as { type?: string } | undefined)?.type ?? null,
    messageRoles: messages.map((m) => m.role || "unknown"),
    assistantHistoryTurns: assistantTurns,
    previousReasoningPreserved: assistantTurns > 0,
    textPromptChars: input.systemChars + input.userChars,
    systemPromptChars: input.systemChars,
    userPromptChars: input.userChars,
    videoAttachments: input.videoRefs.length,
    imageAttachments: input.imageCount,
    videoMsReferences: input.videoRefs,
    leanPrompt: Boolean(input.leanPrompt),
    notes: [
      assistantTurns === 0
        ? "Single-turn request — no prior assistant reasoning_content in messages"
        : `${assistantTurns} prior assistant turn(s) in messages`,
      reasoningEffort
        ? `reasoning_effort=${reasoningEffort}`
        : "reasoning_effort not set (K3 API default is max if model is kimi-k3)",
    ],
  };
}

export function writeKimiRequestPayloadReport(
  sessionId: string,
  report: KimiRequestPayloadReport,
): void {
  writeFileSync(auditPath(sessionId), JSON.stringify(report, null, 2), "utf8");
  appendProgressLog(
    sessionId,
    `kimi_request_payload model=${report.model} reasoning_effort=${report.reasoningEffort ?? "default"} max_tokens=${report.maxOutputTokens ?? "default"} videos=${report.videoAttachments} images=${report.imageAttachments} text_chars=${report.textPromptChars} lean=${report.leanPrompt}`,
  );
}

export function printKimiRequestPayloadReport(report: KimiRequestPayloadReport): void {
  console.log("\n--- Kimi request payload (pre-flight) ---");
  console.log(`model:                  ${report.model}`);
  console.log(`reasoning_effort:       ${report.reasoningEffort ?? "(not set — K3 defaults to max)"}`);
  console.log(`max_output_tokens:      ${report.maxOutputTokens ?? "(API default)"}`);
  console.log(`video attachments:    ${report.videoAttachments} ${report.videoMsReferences.join(", ") || ""}`);
  console.log(`image attachments:      ${report.imageAttachments}`);
  console.log(`text prompt size:       ${report.textPromptChars} chars (system ${report.systemPromptChars}, user ${report.userPromptChars})`);
  console.log(`lean prompt:            ${report.leanPrompt}`);
  console.log(`prior assistant turns:  ${report.assistantHistoryTurns}`);
  console.log(`reasoning preserved:    ${report.previousReasoningPreserved}`);
  console.log("");
}
