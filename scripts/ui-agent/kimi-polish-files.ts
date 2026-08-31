import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config";
import { assertAllowedChangePath, normalizeRepoRelativePath } from "./path-guards";
import { appendProgressLog } from "./progress";
import { log } from "./logger";
import type { ProposedFileChange } from "./types";

const FILE_BEGIN = "KIMI_FILE_BEGIN";
const FILE_END = "KIMI_FILE_END";

/**
 * Parses Kimi polish output and materializes allowed production frontend paths.
 */
export class KimiPolishFileWriter {
  private buffer = "";
  private activePath: string | null = null;
  private activeContent = "";
  private completed: ProposedFileChange[] = [];
  private rejected: Array<{ path: string; reason: string }> = [];

  constructor(private readonly sessionId: string) {}

  feed(chunk: string): void {
    this.buffer += chunk;
    while (true) {
      if (!this.activePath) {
        const beginIdx = this.buffer.indexOf(FILE_BEGIN);
        if (beginIdx === -1) break;
        const lineEnd = this.buffer.indexOf("\n", beginIdx);
        if (lineEnd === -1) break;
        const header = this.buffer.slice(beginIdx, lineEnd).trim();
        const path = header.slice(FILE_BEGIN.length).trim();
        this.activePath = path.replace(/\\/g, "/");
        this.activeContent = "";
        appendProgressLog(this.sessionId, `kimi_polish_begin: ${this.activePath}`);
        this.buffer = this.buffer.slice(lineEnd + 1);
        continue;
      }

      const endIdx = this.buffer.indexOf(FILE_END);
      if (endIdx === -1) break;
      this.activeContent += this.buffer.slice(0, endIdx);
      this.writeActiveFile();
      this.buffer = this.buffer.slice(endIdx + FILE_END.length);
      if (this.buffer.startsWith("\n")) this.buffer = this.buffer.slice(1);
    }
  }

  flush(): { accepted: ProposedFileChange[]; rejected: Array<{ path: string; reason: string }> } {
    if (this.activePath && this.buffer.trim()) {
      this.activeContent += this.buffer;
      this.buffer = "";
      this.writeActiveFile();
    }
    return { accepted: [...this.completed], rejected: [...this.rejected] };
  }

  private writeActiveFile(): void {
    if (!this.activePath) return;
    const rawPath = this.activePath;
    const content = this.activeContent.replace(/^\n+/, "").replace(/\n+$/, "\n");
    this.activePath = null;
    this.activeContent = "";

    try {
      const rel = normalizeRepoRelativePath(rawPath);
      assertAllowedChangePath(rel);
      const change: ProposedFileChange = {
        file: rel,
        action: existsSync(join(REPO_ROOT, rel)) ? "modify" : "create",
        reason: "Kimi polish pass",
        content,
      };
      this.completed.push(change);
      log("kimi polish accepted", rel);
      appendProgressLog(this.sessionId, `kimi_polish_complete: ${rel} (${content.length} bytes)`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.rejected.push({ path: rawPath, reason });
      log("kimi polish rejected", `${rawPath}: ${reason}`);
      appendProgressLog(this.sessionId, `kimi_polish_rejected: ${rawPath} — ${reason}`);
    }
  }
}

export const KIMI_POLISH_FILE_PROTOCOL = `OUTPUT PROTOCOL — POLISH MODE (production frontend)

Emit ONLY files you changed, using repo-relative paths under:
- src/app/
- src/components/
- src/styles/

KIMI_FILE_BEGIN src/components/example/Widget.tsx
// full updated file content
KIMI_FILE_END

Rules:
- Use exact markers KIMI_FILE_BEGIN and KIMI_FILE_END on their own lines
- Path must be repo-relative (start with src/)
- Emit COMPLETE file contents (not diffs)
- Do NOT emit mock-data, API routes, lib/, prisma/, or scripts/
- No markdown fences inside file content`;
