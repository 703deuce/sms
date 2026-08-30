import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT, SHARED_UI_GLOBS } from "./config";
import type { ProjectManifest } from "./types";

const APP_ROOT = join(REPO_ROOT, "src/app/(app)");

function globMatch(path: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§§")
        .replace(/\*/g, "[^/]*")
        .replace(/§§/g, ".*") +
      "$",
  );
  return regex.test(path);
}

function routeToPageFile(route: string): string[] {
  const clean = route.replace(/\/$/, "") || "/";
  const candidates: string[] = [];

  if (clean.startsWith("src/")) {
    candidates.push(clean);
    return candidates.filter((p) => existsSync(join(REPO_ROOT, p)));
  }

  const segments = clean.split("/").filter(Boolean);
  const pagePath = join("src/app/(app)", ...segments, "page.tsx");
  candidates.push(pagePath);

  if (segments.length > 0) {
    candidates.push(join("src/app/(app)", ...segments, "page.ts"));
    candidates.push(join("src/app/(app)", ...segments, "layout.tsx"));
  }

  return candidates.filter((p) => existsSync(join(REPO_ROOT, p)));
}

function readImports(source: string): string[] {
  const imports: string[] = [];
  const re = /from\s+["'](@\/[^"']+|\.[^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveImportToFile(importPath: string, fromFile: string): string | null {
  if (!importPath.startsWith("@/")) return null;
  const rel = importPath.slice(2);
  const exts = [".tsx", ".ts", "/index.tsx", "/index.ts"];
  for (const ext of exts) {
    const candidate = join(REPO_ROOT, "src", rel + ext);
    if (existsSync(candidate)) return relative(REPO_ROOT, candidate);
  }
  return null;
}

function collectRelatedFiles(entryFiles: string[], maxDepth = 2): string[] {
  const seen = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = entryFiles.map((f) => ({ file: f, depth: 0 }));

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (depth >= maxDepth) continue;

    const abs = join(REPO_ROOT, file);
    if (!existsSync(abs) || statSync(abs).isDirectory()) continue;
    if (!/\.(tsx|ts|css)$/.test(file)) continue;

    let source = "";
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    for (const imp of readImports(source)) {
      const resolved = resolveImportToFile(imp, file);
      if (resolved && !seen.has(resolved)) {
        queue.push({ file: resolved, depth: depth + 1 });
      }
    }
  }

  return [...seen];
}

function listSharedUiFiles(): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.(tsx|ts|css)$/.test(rel)) files.push(rel);
    }
  }

  for (const pattern of SHARED_UI_GLOBS) {
    if (pattern.endsWith("/")) walk(join(REPO_ROOT, pattern));
    else if (existsSync(join(REPO_ROOT, pattern))) files.push(pattern);
  }

  return [...new Set(files)].sort();
}

function extractApiContracts(files: string[]): string[] {
  const contracts = new Set<string>();
  const apiRe = /fetch\(\s*[`'"](\/api\/[^`'"]+)[`'"]/g;
  for (const file of files) {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    let match: RegExpExecArray | null;
    while ((match = apiRe.exec(source))) {
      contracts.add(match[1].split("?")[0]);
    }
  }
  return [...contracts].sort();
}

function extractComponentNames(files: string[]): string[] {
  const names = new Set<string>();
  const fnRe = /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g;
  const constRe = /export\s+(?:const|function)\s+([A-Z][A-Za-z0-9_]*)/g;
  for (const file of files) {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    for (const re of [fnRe, constRe]) {
      let match: RegExpExecArray | null;
      while ((match = re.exec(source))) names.add(match[1]);
    }
  }
  return [...names].sort();
}

export function buildProjectManifest(target: string): ProjectManifest {
  const entryCandidates = routeToPageFile(target);
  if (entryCandidates.length === 0) {
    throw new Error(`Could not resolve target to page/component files: ${target}`);
  }

  const targetFiles = collectRelatedFiles(entryCandidates, 2);
  const sharedUiFiles = listSharedUiFiles();
  const designSystemFiles = sharedUiFiles.filter((f) => f.startsWith("src/components/ui/"));

  const routePrefix = target.startsWith("/") ? target.split("?")[0] : `/${target}`;

  return {
    targetRoute: routePrefix,
    targetFiles,
    sharedUiFiles: sharedUiFiles.slice(0, 40),
    protectedDependencies: [
      "src/lib/**",
      "src/app/api/**",
      "prisma/**",
      "voice-runtime/**",
    ],
    apiContracts: extractApiContracts(targetFiles),
    currentComponents: extractComponentNames(targetFiles),
    designSystemFiles,
    inScope: [routePrefix, ...targetFiles],
    outOfScope: [
      "/campaigns",
      "/contacts",
      "/settings",
      "/dashboard",
      "/voice",
    ].filter((p) => p !== routePrefix && !routePrefix.startsWith(p + "/")),
  };
}

export function manifestToPromptContext(manifest: ProjectManifest): string {
  const chunks: string[] = [];
  chunks.push(`TARGET ROUTE: ${manifest.targetRoute}`);
  chunks.push(`IN SCOPE: ${manifest.inScope.join(", ")}`);
  chunks.push(`OUT OF SCOPE: ${manifest.outOfScope.join(", ")}`);
  chunks.push(`TARGET FILES:\n${manifest.targetFiles.map((f) => `- ${f}`).join("\n")}`);
  chunks.push(`API CONTRACTS (preserve):\n${manifest.apiContracts.map((a) => `- ${a}`).join("\n") || "- none detected"}`);
  chunks.push(`DESIGN SYSTEM:\n${manifest.designSystemFiles.map((f) => `- ${f}`).join("\n")}`);

  for (const file of manifest.targetFiles.slice(0, 8)) {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    const trimmed = source.length > 6000 ? `${source.slice(0, 6000)}\n/* ... truncated ... */` : source;
    chunks.push(`\n--- FILE: ${file} ---\n${trimmed}`);
  }

  return chunks.join("\n\n");
}

/** Compact brand + design-system context for Kimi reference builds (no backend). */
export function designContextForKimi(manifest: ProjectManifest): string {
  const chunks: string[] = [
    "BRAND: Transovo",
    `TARGET ROUTE: ${manifest.targetRoute}`,
    `COMPONENTS IN SCOPE: ${manifest.currentComponents.join(", ") || "unknown"}`,
    `DESIGN SYSTEM FILES: ${manifest.designSystemFiles.join(", ")}`,
  ];

  for (const file of manifest.designSystemFiles.slice(0, 5)) {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    chunks.push(`\n--- ${file} ---\n${source.slice(0, 2500)}`);
  }

  for (const file of ["src/components/layout/sidebar.tsx", "src/components/layout/header.tsx"]) {
    const abs = join(REPO_ROOT, file);
    if (existsSync(abs)) {
      chunks.push(`\n--- APP SHELL: ${file} ---\n${readFileSync(abs, "utf8").slice(0, 2000)}`);
    }
  }

  return chunks.join("\n");
}
