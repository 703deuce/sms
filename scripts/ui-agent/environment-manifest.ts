import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { REPO_ROOT } from "./config";
import { sessionDir } from "./session";
import type { ProjectManifest } from "./types";

const require = createRequire(import.meta.url);
const pkg = require(join(REPO_ROOT, "package.json")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type FrontendEnvironmentManifest = {
  framework: "Next.js";
  language: "TypeScript";
  styling: "Tailwind CSS + existing project design tokens";
  nextVersion: string;
  reactVersion: string;
  targetRoute: string;
  targetPageFiles: string[];
  availableComponents: string[];
  designSystem: string[];
  existingDependencies: string[];
  appShell: {
    sidebar?: string;
    header?: string;
  };
  instructions: string[];
};

const NO_SCAFFOLD_INSTRUCTIONS = [
  "You are implementing a page inside an EXISTING Next.js application.",
  "Return ONLY the files/components required for this target UI.",
  "Do NOT scaffold an application.",
  "Do NOT generate package.json, tsconfig, next.config, tailwind.config, or root application files.",
  "Do NOT initialize Next.js, Tailwind, or a new routing architecture.",
  "Prefer existing project dependencies and design-system primitives.",
  "Do not introduce a new component library merely to reproduce the reference.",
];

export function buildEnvironmentManifest(manifest: ProjectManifest): FrontendEnvironmentManifest {
  const deps = [
    ...Object.entries(pkg.dependencies || {}).map(([name, version]) => `${name}@${version}`),
    ...Object.entries(pkg.devDependencies || {}).map(([name, version]) => `${name}@${version}`),
  ];

  const appShell: FrontendEnvironmentManifest["appShell"] = {};
  for (const file of ["src/components/layout/sidebar.tsx", "src/components/layout/header.tsx"]) {
    if (existsSync(join(REPO_ROOT, file))) {
      if (file.includes("sidebar")) appShell.sidebar = file;
      if (file.includes("header")) appShell.header = file;
    }
  }

  return {
    framework: "Next.js",
    language: "TypeScript",
    styling: "Tailwind CSS + existing project design tokens",
    nextVersion: pkg.dependencies?.next || "unknown",
    reactVersion: pkg.dependencies?.react || "unknown",
    targetRoute: manifest.targetRoute,
    targetPageFiles: manifest.targetFiles.filter((f) => f.includes("/page.")),
    availableComponents: manifest.currentComponents,
    designSystem: manifest.designSystemFiles,
    existingDependencies: deps.filter((d) =>
      /^(next|react|react-dom|lucide-react|@radix-ui|class-variance-authority|tailwind|clsx|tailwind-merge)/.test(d),
    ),
    appShell,
    instructions: NO_SCAFFOLD_INSTRUCTIONS,
  };
}

export function environmentManifestToPrompt(env: FrontendEnvironmentManifest): string {
  return [
    "FRONTEND ENVIRONMENT MANIFEST (existing application — do NOT scaffold a new project):",
    JSON.stringify(env, null, 2),
    "",
    ...env.instructions.map((line) => `- ${line}`),
  ].join("\n");
}

export function writeEnvironmentManifest(sessionId: string, env: FrontendEnvironmentManifest): string {
  const path = join(sessionDir(sessionId), "environment.json");
  writeFileSync(path, JSON.stringify(env, null, 2), "utf8");
  return path;
}

export function writeSessionInput(sessionId: string, input: Record<string, unknown>): string {
  const path = join(sessionDir(sessionId), "input.json");
  writeFileSync(path, JSON.stringify(input, null, 2), "utf8");
  return path;
}
