import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import { KIMI_CHAT_TIMEOUT_MS } from "./config";
import { appendProgressLog, updateProgress } from "./progress";
import { UI_AGENT_SESSIONS_DIR } from "./config";
import { log } from "./logger";

const kimiHttpAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 60_000,
});

export type KimiStreamResult = {
  rawText: string;
  firstTokenMs: number;
  totalMs: number;
  charCount: number;
};

function sessionDir(sessionId: string): string {
  return join(UI_AGENT_SESSIONS_DIR, sessionId);
}

export function kimiStreamLogPath(sessionId: string): string {
  return join(sessionDir(sessionId), "kimi-stream.log");
}

export function kimiLivePreviewPath(sessionId: string): string {
  return join(sessionDir(sessionId), "kimi-live.txt");
}

export function kimiReasoningLogPath(sessionId: string): string {
  return join(sessionDir(sessionId), "kimi-reasoning.log");
}

export function kimiSseDebugPath(sessionId: string): string {
  return join(sessionDir(sessionId), "kimi-sse-raw.log");
}

function ensureSessionDir(sessionId: string): void {
  mkdirSync(sessionDir(sessionId), { recursive: true });
}

function extractNewFilePaths(text: string, seen: Set<string>): string[] {
  const found: string[] = [];
  const re = /"path"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const path = match[1];
    if (!seen.has(path)) {
      seen.add(path);
      found.push(path);
    }
  }
  return found;
}

export async function streamKimiChatCompletion(input: {
  baseUrl: string;
  apiKey: string;
  body: Record<string, unknown>;
  sessionId?: string;
  label: string;
  timeoutMs?: number;
}): Promise<KimiStreamResult> {
  const timeoutMs = input.timeoutMs ?? KIMI_CHAT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let firstTokenMs = 0;
  let rawText = "";
  let reasoningText = "";
  let lastProgressAt = 0;
  let lastConsoleAt = 0;
  let lastHeartbeatAt = started;
  const seenPaths = new Set<string>();

  if (input.sessionId) {
    ensureSessionDir(input.sessionId);
    writeFileSync(
      kimiStreamLogPath(input.sessionId),
      `# Kimi stream started ${new Date().toISOString()}\n`,
      "utf8",
    );
    writeFileSync(kimiLivePreviewPath(input.sessionId), "", "utf8");
    writeFileSync(kimiReasoningLogPath(input.sessionId), "", "utf8");
    appendProgressLog(input.sessionId, `kimi_stream_started — watch: tail -f ${kimiStreamLogPath(input.sessionId)}`);
    appendProgressLog(input.sessionId, `kimi_reasoning — watch: tail -f ${kimiReasoningLogPath(input.sessionId)}`);
  }

  const streamBody = { ...input.body, stream: true };

  try {
    const res = await undiciFetch(`${input.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(streamBody),
      signal: controller.signal,
      dispatcher: kimiHttpAgent,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kimi stream ${res.status}: ${errText.slice(0, 500)}`);
    }

    if (!res.body) throw new Error("Kimi stream returned no body");

    const reader = res.body as unknown as AsyncIterable<Uint8Array>;
    let buffer = "";

    for await (const chunk of reader) {
      buffer += Buffer.from(chunk).toString("utf8");
      if (input.sessionId && buffer.length < 50000) {
        appendFileSync(kimiSseDebugPath(input.sessionId), buffer, "utf8");
      }

      const now = Date.now();
      if (!firstTokenMs && now - lastHeartbeatAt > 10000) {
        lastHeartbeatAt = now;
        const waitSec = Math.round((now - started) / 1000);
        const msg = `kimi_waiting_for_tokens… ${waitSec}s (video analysis / reasoning before code)`;
        if (input.sessionId) {
          appendProgressLog(input.sessionId, msg);
          updateProgress(input.sessionId, {
            phase: "generating_ui",
            message: `Waiting for Kimi… ${waitSec}s (analyzing video)`,
          });
        }
        log("kimi stream", msg);
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string; reasoning_content?: string };
              message?: { content?: string; reasoning_content?: string };
            }>;
          };
          const delta = json.choices?.[0]?.delta;
          const content = delta?.content ?? json.choices?.[0]?.message?.content ?? "";
          const reasoning = delta?.reasoning_content ?? json.choices?.[0]?.message?.reasoning_content ?? "";

          if (reasoning) {
            if (!firstTokenMs) {
              firstTokenMs = Date.now() - started;
              if (input.sessionId) {
                appendProgressLog(input.sessionId, `kimi_first_reasoning_token_ms=${firstTokenMs}`);
                updateProgress(input.sessionId, {
                  phase: "generating_ui",
                  message: `Kimi reasoning… first activity in ${(firstTokenMs / 1000).toFixed(1)}s`,
                });
              }
            }
            reasoningText += reasoning;
            if (input.sessionId) {
              appendFileSync(kimiReasoningLogPath(input.sessionId), reasoning, "utf8");
            }
            if (Date.now() - lastConsoleAt > 300) {
              process.stdout.write(reasoning);
              lastConsoleAt = Date.now();
            }
          }

          if (!content) continue;

          if (!firstTokenMs) {
            firstTokenMs = Date.now() - started;
            if (input.sessionId) {
              appendProgressLog(input.sessionId, `kimi_first_code_token_ms=${firstTokenMs}`);
              updateProgress(input.sessionId, {
                phase: "generating_ui",
                message: `Kimi streaming UI code… first tokens in ${(firstTokenMs / 1000).toFixed(1)}s`,
              });
            }
            log("kimi stream", `first code token after ${firstTokenMs}ms`);
          }

          rawText += content;

          if (input.sessionId) {
            appendFileSync(kimiStreamLogPath(input.sessionId), content, "utf8");
            writeFileSync(kimiLivePreviewPath(input.sessionId), rawText.slice(-8000), "utf8");
          }

          if (Date.now() - lastConsoleAt > 200) {
            process.stdout.write(content);
            lastConsoleAt = Date.now();
          }

          const newPaths = extractNewFilePaths(rawText, seenPaths);
          for (const filePath of newPaths) {
            const msg = `kimi_writing_file: ${filePath}`;
            if (input.sessionId) appendProgressLog(input.sessionId, msg);
            log("kimi stream", msg);
          }

          if (input.sessionId && Date.now() - lastProgressAt > 5000) {
            lastProgressAt = Date.now();
            const tail = rawText.slice(-120).replace(/\s+/g, " ");
            appendProgressLog(
              input.sessionId,
              `kimi_stream ${rawText.length} code chars, ${reasoningText.length} reasoning chars — …${tail}`,
            );
            updateProgress(input.sessionId, {
              phase: "generating_ui",
              message: `Kimi streaming… ${rawText.length.toLocaleString()} code chars (${((Date.now() - started) / 1000).toFixed(0)}s)`,
            });
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    process.stdout.write("\n");

    const totalMs = Date.now() - started;
    if (input.sessionId) {
      appendProgressLog(
        input.sessionId,
        `kimi_stream_complete chars=${rawText.length} first_token_ms=${firstTokenMs} total_ms=${totalMs}`,
      );
    }

    return { rawText, firstTokenMs, totalMs, charCount: rawText.length };
  } finally {
    clearTimeout(timeout);
  }
}
