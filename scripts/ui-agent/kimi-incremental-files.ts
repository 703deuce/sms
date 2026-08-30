import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assertGeneratedSandboxPath, generatedDirForSession } from "./generated-sandbox";
import { appendProgressLog } from "./progress";
import { markKimiTiming } from "./kimi-timing";
import { log } from "./logger";

const FILE_BEGIN = "KIMI_FILE_BEGIN";
const FILE_END = "KIMI_FILE_END";
const MANIFEST_BEGIN = "KIMI_MANIFEST_BEGIN";
const MANIFEST_END = "KIMI_MANIFEST_END";

export type IncrementalWriteEvent =
  | { type: "manifest"; paths: string[] }
  | { type: "file_complete"; path: string; bytes: number };

/**
 * Parses Kimi incremental output protocol and writes each file as soon as
 * KIMI_FILE_END is received — do not wait for the full response.
 */
export class KimiIncrementalFileWriter {
  private buffer = "";
  private activePath: string | null = null;
  private activeContent = "";
  private completed: string[] = [];
  private manifest: string[] = [];
  private firstFileMarked = false;

  constructor(private readonly sessionId: string) {
    mkdirSync(generatedDirForSession(sessionId), { recursive: true });
  }

  feed(chunk: string): IncrementalWriteEvent[] {
    this.buffer += chunk;
    const events: IncrementalWriteEvent[] = [];

    while (true) {
      if (!this.activePath) {
        const manifestBegin = this.buffer.indexOf(MANIFEST_BEGIN);
        if (manifestBegin !== -1) {
          const afterBegin = manifestBegin + MANIFEST_BEGIN.length;
          const manifestEnd = this.buffer.indexOf(MANIFEST_END, afterBegin);
          if (manifestEnd === -1) break;
          const block = this.buffer.slice(afterBegin, manifestEnd).trim();
          this.manifest = block
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          events.push({ type: "manifest", paths: this.manifest });
          appendProgressLog(this.sessionId, `kimi_manifest: ${this.manifest.join(", ")}`);
          this.buffer = this.buffer.slice(manifestEnd + MANIFEST_END.length);
          continue;
        }

        const beginIdx = this.buffer.indexOf(FILE_BEGIN);
        if (beginIdx === -1) break;

        const lineEnd = this.buffer.indexOf("\n", beginIdx);
        if (lineEnd === -1) break;

        const header = this.buffer.slice(beginIdx, lineEnd).trim();
        const path = header.slice(FILE_BEGIN.length).trim();
        if (!path) {
          this.buffer = this.buffer.slice(lineEnd + 1);
          continue;
        }

        this.activePath = path.replace(/\\/g, "/");
        this.activeContent = "";
        appendProgressLog(this.sessionId, `kimi_file_begin: ${this.activePath}`);
        updateProgressFile(this.sessionId, this.activePath);
        this.buffer = this.buffer.slice(lineEnd + 1);
        continue;
      }

      const endIdx = this.buffer.indexOf(FILE_END);
      if (endIdx === -1) break;

      this.activeContent += this.buffer.slice(0, endIdx);
      const writtenPath = this.writeActiveFile();
      if (writtenPath) {
        events.push({ type: "file_complete", path: writtenPath, bytes: this.activeContent.length });
      }
      this.buffer = this.buffer.slice(endIdx + FILE_END.length);
      if (this.buffer.startsWith("\n")) this.buffer = this.buffer.slice(1);
    }

    return events;
  }

  flush(): string[] {
    if (this.activePath && this.buffer.trim()) {
      this.activeContent += this.buffer;
      this.buffer = "";
      this.writeActiveFile();
    }
    return [...this.completed];
  }

  getCompletedFiles(): string[] {
    return [...this.completed];
  }

  private writeActiveFile(): string | null {
    if (!this.activePath) return null;
    const path = this.activePath;
    const content = this.activeContent.replace(/^\n+/, "").replace(/\n+$/, "\n");
    const abs = assertGeneratedSandboxPath(this.sessionId, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
    this.completed.push(path);

    if (!this.firstFileMarked) {
      this.firstFileMarked = true;
      markKimiTiming(this.sessionId, "firstCompleteFileMs");
      appendProgressLog(this.sessionId, `kimi_first_complete_file: ${path} (${content.length} bytes)`);
    }

    appendProgressLog(this.sessionId, `kimi_file_complete: ${path} (${content.length} bytes)`);
    log("kimi incremental", `wrote ${path} (${content.length} bytes)`);

    this.activePath = null;
    this.activeContent = "";
    return path;
  }
}

function updateProgressFile(sessionId: string, path: string): void {
  appendProgressLog(sessionId, `kimi_writing: ${path}`);
}

export function writeIncrementalMetadata(sessionId: string, files: string[]): void {
  writeFileSync(
    join(generatedDirForSession(sessionId), "metadata.json"),
    JSON.stringify(
      {
        sessionId,
        generatedAt: new Date().toISOString(),
        files,
        sandbox: true,
        protocol: "kimi_incremental_v1",
        note: "Visual reference only — mock data allowed here, never copy to src/",
      },
      null,
      2,
    ),
    "utf8",
  );
}

export const INCREMENTAL_FILE_PROTOCOL = `OUTPUT PROTOCOL — INCREMENTAL FILES (required)

Do NOT return one giant JSON object with all files embedded.
Emit files incrementally so each can be materialized immediately.

1. Optional manifest first:
KIMI_MANIFEST_BEGIN
page.tsx
components/Example.tsx
mock-data.ts
reference.css
KIMI_MANIFEST_END

2. Then emit ONE file at a time:
KIMI_FILE_BEGIN page.tsx
export default function ReferencePage() { ... }
KIMI_FILE_END

KIMI_FILE_BEGIN components/Example.tsx
...
KIMI_FILE_END

Rules:
- Use exact markers KIMI_FILE_BEGIN, KIMI_FILE_END, KIMI_MANIFEST_BEGIN, KIMI_MANIFEST_END on their own lines
- Path on same line as KIMI_FILE_BEGIN
- Raw file content between BEGIN and END (not JSON-escaped)
- Required minimum: page.tsx, mock-data.ts, reference.css
- No markdown fences around file content`;
