import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT, UI_AGENT_DIR } from "./config";
import { log } from "./logger";

export type FileSnapshot = {
  path: string;
  hash: string;
  existed: boolean;
  content: string | null;
};

export type GitSafetyState = {
  dirtyFiles: string[];
  snapshots: FileSnapshot[];
};

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function readGitDirtyFiles(): string[] {
  try {
    const out = execSync("git status --porcelain", { cwd: REPO_ROOT, encoding: "utf8" });
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(3).trim());
  } catch {
    return [];
  }
}

export function snapshotFiles(relativePaths: string[]): GitSafetyState {
  const dirtyFiles = readGitDirtyFiles();
  const snapshots: FileSnapshot[] = [];

  for (const rel of relativePaths) {
    const abs = join(REPO_ROOT, rel);
    try {
      const content = readFileSync(abs, "utf8");
      snapshots.push({ path: rel, hash: sha256(content), existed: true, content });
    } catch {
      snapshots.push({ path: rel, hash: "", existed: false, content: null });
    }
  }

  return { dirtyFiles, snapshots };
}

export function restoreSnapshots(snapshots: FileSnapshot[]): void {
  for (const snap of snapshots) {
    const abs = join(REPO_ROOT, snap.path);
    if (snap.existed && snap.content != null) {
      writeFileSync(abs, snap.content, "utf8");
      log("restored file", snap.path);
    }
  }
}

export function filesChangedOutsidePlan(dirtyBefore: string[], touchedFiles: string[]): string[] {
  const touched = new Set(touchedFiles);
  return dirtyBefore.filter((f) => !touched.has(f));
}

export type PolishCheckpoint = {
  sessionId: string;
  commitHash: string;
  dirtyBefore: string[];
  createdAt: string;
};

export function createPolishCheckpoint(sessionId: string): PolishCheckpoint {
  const dirtyBefore = readGitDirtyFiles();
  let commitHash = "unknown";
  try {
    commitHash = execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    // ignore
  }
  const checkpoint: PolishCheckpoint = {
    sessionId,
    commitHash,
    dirtyBefore,
    createdAt: new Date().toISOString(),
  };
  mkdirSync(UI_AGENT_DIR, { recursive: true });
  writeFileSync(join(UI_AGENT_DIR, `polish-checkpoint-${sessionId}.json`), JSON.stringify(checkpoint, null, 2), "utf8");
  log("polish checkpoint", `HEAD=${commitHash} dirty=${dirtyBefore.length}`);
  return checkpoint;
}
