import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { KIMI_DRAFTS_DIR, REPO_ROOT } from "./config";
import { generatedDirForSession, listGeneratedFiles } from "./generated-sandbox";
import { log } from "./logger";

export type KimiPersistManifest = {
  sessionId: string;
  targetRoute: string;
  referenceNames: string[];
  generatedAt: string;
  generatedFiles: string[];
  persistedFiles: string[];
  status: "generated" | "reviewed" | "integrated";
};

const SOURCE_FILE = /\.(tsx|ts|css)$/i;
const SKIP_FILE = /^(preview\.bundle\.|index\.html$|metadata\.json$|APPROVED\.json$|HANDOFF\.json$)/;

function routeToFeatureSlug(route: string): string {
  const trimmed = route.replace(/^\//, "").trim();
  return trimmed ? trimmed.replace(/\//g, "-") : "root";
}

function isPersistableSource(relativePath: string): boolean {
  if (SKIP_FILE.test(relativePath)) return false;
  return SOURCE_FILE.test(relativePath);
}

export function draftDirForSession(sessionId: string, targetRoute: string): string {
  return join(KIMI_DRAFTS_DIR, routeToFeatureSlug(targetRoute), sessionId);
}

export function assertKimiOutputPersisted(sessionId: string, targetRoute: string): KimiPersistManifest {
  const manifestPath = join(draftDirForSession(sessionId, targetRoute), "MANIFEST.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`KIMI_OUTPUT_NOT_PERSISTED: no manifest at ${relative(REPO_ROOT, manifestPath)}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as KimiPersistManifest;
  for (const file of manifest.persistedFiles) {
    const abs = join(REPO_ROOT, file);
    if (!existsSync(abs)) {
      throw new Error(`KIMI_OUTPUT_NOT_PERSISTED: missing ${file}`);
    }
  }
  return manifest;
}

export function persistKimiGeneratedSource(input: {
  sessionId: string;
  targetRoute: string;
  referenceNames?: string[];
  status?: KimiPersistManifest["status"];
}): KimiPersistManifest {
  const { sessionId, targetRoute } = input;
  const sandboxDir = generatedDirForSession(sessionId);
  if (!existsSync(join(sandboxDir, "page.tsx"))) {
    throw new Error(`KIMI_OUTPUT_NOT_PERSISTED: sandbox missing page.tsx for ${sessionId}`);
  }

  const draftDir = draftDirForSession(sessionId, targetRoute);
  mkdirSync(draftDir, { recursive: true });

  const generatedFiles = listGeneratedFiles(sessionId).filter(isPersistableSource);
  const persistedFiles: string[] = [];

  for (const rel of generatedFiles) {
    const src = join(sandboxDir, rel);
    const dest = join(draftDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    persistedFiles.push(relative(REPO_ROOT, dest).replace(/\\/g, "/"));
    log("persisted kimi draft", rel);
  }

  const manifest: KimiPersistManifest = {
    sessionId,
    targetRoute,
    referenceNames: input.referenceNames ?? [],
    generatedAt: new Date().toISOString(),
    generatedFiles,
    persistedFiles,
    status: input.status ?? "generated",
  };

  writeFileSync(join(draftDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf8");
  assertKimiOutputPersisted(sessionId, targetRoute);
  log("kimi draft manifest", join(draftDir, "MANIFEST.json"));
  return manifest;
}

/** Promote any sandbox on disk that lacks a draft copy yet. */
export function promoteExistingSandboxes(targetRouteBySession?: Record<string, string>): number {
  const generatedRoot = join(REPO_ROOT, ".ui-agent", "generated");
  if (!existsSync(generatedRoot)) return 0;

  let count = 0;
  for (const entry of readdirSync(generatedRoot)) {
    if (entry.startsWith(".")) continue;
    const sessionDir = join(generatedRoot, entry);
    if (!statSync(sessionDir).isDirectory()) continue;
    if (!existsSync(join(sessionDir, "page.tsx"))) continue;

    const route = targetRouteBySession?.[entry];
    if (!route) continue;

    const manifestPath = join(draftDirForSession(entry, route), "MANIFEST.json");
    if (existsSync(manifestPath)) continue;

    persistKimiGeneratedSource({ sessionId: entry, targetRoute: route });
    count += 1;
  }
  return count;
}
