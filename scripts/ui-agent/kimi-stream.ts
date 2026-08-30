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
  let lastProgressAt = 0;
  let lastConsoleAt = 0;
  const seenPaths = new Set<string>();

  if (input.sessionId) {
    ensureSessionDir(input.sessionId);
    writeFileSync(
      kimiStreamLogPath(input.sessionId),
      `# Kimi stream started ${new Date().toISOString()}\n`,
      "utf8",
    );
    writeFileSync(kimiLivePreviewPath(input.sessionId), "", "utf8");
    appendProgressLog(input.sessionId, `kimi_stream_started — watch: tail -f ${kimiStreamLogPath(input.sessionId)}`);
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
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
          };
          const delta =
            json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? "";
          if (!delta) continue;

          if (!firstTokenMs) {
            firstTokenMs = Date.now() - started;
            if (input.sessionId) {
              appendProgressLog(input.sessionId, `kimi_first_token_ms=${firstTokenMs}`);
              updateProgress(input.sessionId, {
                phase: "generating_ui",
                message: `Kimi streaming UI code… first tokens in ${(firstTokenMs / 1000).toFixed(1)}s`,
              });
            }
            log("kimi stream", `first token after ${firstTokenMs}ms`);
          }

          rawText += delta;

          if (input.sessionId) {
            appendFileSync(kimiStreamLogPath(input.sessionId), delta, "utf8");
            writeFileSync(kimiLivePreviewPath(input.sessionId), rawText.slice(-8000), "utf8");
          }

          // Echo code to terminal as it arrives (throttle slightly)
          const now = Date.now();
          if (now - lastConsoleAt > 200) {
            process.stdout.write(delta);
            lastConsoleAt = now;
          }

          const newPaths = extractNewFilePaths(rawText, seenPaths);
          for (const filePath of newPaths) {
            const msg = `kimi_writing_file: ${filePath}`;
            if (input.sessionId) appendProgressLog(input.sessionId, msg);
            log("kimi stream", msg);
          }

          if (input.sessionId && now - lastProgressAt > 5000) {
            lastProgressAt = now;
            const tail = rawText.slice(-120).replace(/\s+/g, " ");
            appendProgressLog(
              input.sessionId,
              `kimi_stream ${rawText.length} chars, ${((Date.now() - started) / 1000).toFixed(0)}s — …${tail}`,
            );
            updateProgress(input.sessionId, {
              phase: "generating_ui",
              message: `Kimi streaming… ${rawText.length.toLocaleString()} chars (${((Date.now() - started) / 1000).toFixed(0)}s)`,
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
