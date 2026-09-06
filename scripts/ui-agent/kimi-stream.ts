import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import { KIMI_CHAT_TIMEOUT_MS, UI_AGENT_SESSIONS_DIR } from "./config";
import { KimiIncrementalFileWriter, writeIncrementalMetadata } from "./kimi-incremental-files";
import { markKimiTiming } from "./kimi-timing";
import { appendProgressLog, updateProgress } from "./progress";
import { log } from "./logger";

const kimiHttpAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 60_000,
});

export type KimiStreamResult = {
  rawText: string;
  firstReasoningMs: number;
  firstContentMs: number;
  totalMs: number;
  charCount: number;
  completedFiles: string[];
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
  useIncrementalFiles?: boolean;
  draftTargetRoute?: string;
  referenceNames?: string[];
}): Promise<KimiStreamResult> {
  const timeoutMs = input.timeoutMs ?? KIMI_CHAT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let firstReasoningMs = 0;
  let firstContentMs = 0;
  let rawText = "";
  let reasoningText = "";
  let lastProgressAt = 0;
  let lastConsoleAt = 0;
  let lastHeartbeatAt = started;
  const seenPaths = new Set<string>();
  const incremental =
    input.sessionId && input.useIncrementalFiles
      ? new KimiIncrementalFileWriter(input.sessionId, {
          draftTargetRoute: input.draftTargetRoute,
          referenceNames: input.referenceNames,
        })
      : null;

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

    if (input.sessionId) {
      markKimiTiming(input.sessionId, "modelRequestAcceptedMs", Date.now() - started);
      appendProgressLog(input.sessionId, `kimi_model_request_accepted_ms=${Date.now() - started}`);
    }

    if (!res.body) throw new Error("Kimi stream returned no body");

    const reader = res.body as unknown as AsyncIterable<Uint8Array>;
    let buffer = "";

    for await (const chunk of reader) {
      const piece = Buffer.from(chunk).toString("utf8");
      buffer += piece;
      if (input.sessionId) {
        appendFileSync(kimiSseDebugPath(input.sessionId), piece, "utf8");
      }

      const now = Date.now();
      if (!firstReasoningMs && !firstContentMs && now - lastHeartbeatAt > 10000) {
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
            if (!firstReasoningMs) {
              firstReasoningMs = Date.now() - started;
              if (input.sessionId) {
                markKimiTiming(input.sessionId, "firstReasoningTokenMs", firstReasoningMs);
                appendProgressLog(input.sessionId, `kimi_first_reasoning_token_ms=${firstReasoningMs}`);
                updateProgress(input.sessionId, {
                  phase: "generating_ui",
                  message: `Kimi reasoning… first activity in ${(firstReasoningMs / 1000).toFixed(1)}s`,
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
            if (input.sessionId && Date.now() - lastProgressAt > 5000) {
              lastProgressAt = Date.now();
              const tail = reasoningText.slice(-100).replace(/\s+/g, " ");
              appendProgressLog(
                input.sessionId,
                `kimi_reasoning ${reasoningText.length} chars (${((Date.now() - started) / 1000).toFixed(0)}s) — …${tail}`,
              );
              updateProgress(input.sessionId, {
                phase: "generating_ui",
                message: `Kimi reasoning… ${reasoningText.length.toLocaleString()} chars (${((Date.now() - started) / 1000).toFixed(0)}s)`,
              });
            }
          }

          if (!content) continue;

          if (!firstContentMs) {
            firstContentMs = Date.now() - started;
            if (input.sessionId) {
              markKimiTiming(input.sessionId, "firstContentTokenMs", firstContentMs);
              appendProgressLog(input.sessionId, `kimi_first_content_token_ms=${firstContentMs}`);
              updateProgress(input.sessionId, {
                phase: "generating_ui",
                message: `Kimi streaming UI code… first tokens in ${(firstContentMs / 1000).toFixed(1)}s`,
              });
            }
            log("kimi stream", `first code token after ${firstContentMs}ms`);
          }

          rawText += content;
          const fileEvents = incremental?.feed(content) ?? [];
          for (const event of fileEvents) {
            if (event.type === "file_complete" && input.sessionId) {
              updateProgress(input.sessionId, {
                phase: "generating_ui",
                message: `Wrote ${event.path} (${event.bytes.toLocaleString()} bytes) — streaming…`,
              });
            }
          }

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

    const completedFiles = incremental ? incremental.flush() : [];
    const totalMs = Date.now() - started;

    if (input.sessionId && completedFiles.length > 0) {
      writeIncrementalMetadata(input.sessionId, completedFiles);
      markKimiTiming(input.sessionId, "allFilesCompleteMs", totalMs);
      markKimiTiming(input.sessionId, "completedFiles", completedFiles);
      appendProgressLog(input.sessionId, `kimi_all_files_complete: ${completedFiles.join(", ")}`);
    }

    if (input.sessionId) {
      markKimiTiming(input.sessionId, "generationTotalMs", totalMs);
      appendProgressLog(
        input.sessionId,
        `kimi_stream_complete code_chars=${rawText.length} reasoning_chars=${reasoningText.length} first_content_ms=${firstContentMs} total_ms=${totalMs} files=${completedFiles.length}`,
      );
    }

    return {
      rawText,
      firstReasoningMs,
      firstContentMs,
      totalMs,
      charCount: rawText.length,
      completedFiles,
    };
  } finally {
    clearTimeout(timeout);
  }
}
