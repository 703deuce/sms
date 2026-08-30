import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { UI_AGENT_GENERATED_DIR, REPO_ROOT } from "./config";
import { log } from "./logger";

export type GeneratedFileInput = {
  path: string;
  content: string;
};

export function generatedDirForSession(sessionId: string): string {
  return join(UI_AGENT_GENERATED_DIR, sessionId);
}

export function assertGeneratedSandboxPath(sessionId: string, relativePath: string): string {
  const clean = relativePath.replace(/\\/g, "/").replace(/^\//, "");
  if (clean.includes("..")) throw new Error(`Path traversal in generated sandbox: ${relativePath}`);
  const abs = join(generatedDirForSession(sessionId), clean);
  const root = generatedDirForSession(sessionId);
  if (!abs.startsWith(root + "/") && abs !== root) {
    throw new Error(`Generated file escapes sandbox: ${relativePath}`);
  }
  return abs;
}

export function writeGeneratedFiles(sessionId: string, files: GeneratedFileInput[]): string[] {
  const written: string[] = [];
  const root = generatedDirForSession(sessionId);
  mkdirSync(root, { recursive: true });

  for (const file of files) {
    const abs = assertGeneratedSandboxPath(sessionId, file.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.content, "utf8");
    written.push(relative(REPO_ROOT, abs).replace(/\\/g, "/"));
    log("wrote generated file", file.path);
  }

  writeFileSync(
    join(root, "metadata.json"),
    JSON.stringify(
      {
        sessionId,
        generatedAt: new Date().toISOString(),
        files: files.map((f) => f.path),
        sandbox: true,
        note: "Visual reference only — mock data allowed here, never copy to src/",
      },
      null,
      2,
    ),
    "utf8",
  );

  return written;
}

export function listGeneratedFiles(sessionId: string): string[] {
  const root = generatedDirForSession(sessionId);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) walk(abs);
      else out.push(relative(root, abs).replace(/\\/g, "/"));
    }
  }
  walk(root);
  return out.filter((f) => f !== "metadata.json" && f !== "APPROVED.json");
}

export function readGeneratedFile(sessionId: string, filePath: string): string {
  return readFileSync(assertGeneratedSandboxPath(sessionId, filePath), "utf8");
}

export function readAllGeneratedSources(sessionId: string): GeneratedFileInput[] {
  return listGeneratedFiles(sessionId)
    .filter((f) => /\.(tsx|ts|css|md)$/.test(f))
    .map((path) => ({ path, content: readGeneratedFile(sessionId, path) }));
}
