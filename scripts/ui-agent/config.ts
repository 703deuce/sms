import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ViewportConfig, ViewportPreset } from "./types";

export const REPO_ROOT = resolve(join(import.meta.dirname, "..", ".."));

export const UI_AGENT_DIR = join(REPO_ROOT, ".ui-agent");
export const UI_AGENT_REFERENCES_DIR = join(UI_AGENT_DIR, "references");
export const UI_AGENT_REPORTS_DIR = join(UI_AGENT_DIR, "reports");
export const UI_AGENT_SESSIONS_DIR = join(UI_AGENT_DIR, "sessions");

export const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.ai/v1";

export const VIEWPORT_PRESETS: Record<ViewportPreset, ViewportConfig> = {
  desktop: { name: "desktop", width: 1440, height: 900 },
  mobile: { name: "mobile", width: 390, height: 844 },
  tablet: { name: "tablet", width: 768, height: 1024 },
};

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Paths the UI agent must never modify without explicit override. */
export const PROTECTED_PATH_GLOBS = [
  "src/lib/**",
  "src/server/**",
  "prisma/**",
  "supabase/migrations/**",
  "src/app/api/**",
  "voice-runtime/**",
  "scripts/**",
  ".env*",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
] as const;

/** Presentation paths the UI agent may modify. */
export const ALLOWED_PATH_PREFIXES = [
  "src/app/",
  "src/components/",
  "src/styles/",
  "public/",
] as const;

export const SHARED_UI_GLOBS = [
  "src/components/ui/",
  "src/components/layout/",
  "src/app/(app)/product-theme.css",
  "src/app/globals.css",
] as const;

export const DESIGN_REFERENCE_DEFAULT_INSTRUCTION = `Study the reference's visual hierarchy, layout, information density, component patterns, interactions, spacing, typography, responsiveness and overall polish.
Do NOT copy trademarks, company names, logos, proprietary text, illustrations/assets, or exact branding.
Do not blindly duplicate the entire reference application.
Adapt useful ideas to Transovo's existing product, branding, and functionality.`;

export type KimiRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsImage: boolean;
  supportsVideo: boolean;
};

export function loadKimiConfig(): KimiRuntimeConfig {
  const apiKey = process.env.KIMI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error("KIMI_API_KEY is required. Set it in your environment — never commit API keys.");
  }
  const baseUrl = (process.env.KIMI_API_BASE_URL?.trim() || DEFAULT_KIMI_BASE_URL).replace(/\/$/, "");
  const model = process.env.KIMI_UI_MODEL?.trim() || "kimi-k3";
  const modelLower = model.toLowerCase();
  const supportsVideo = !modelLower.includes("256k");
  return {
    apiKey,
    baseUrl,
    model,
    supportsImage: true,
    supportsVideo,
  };
}

export function resolveUiAgentPath(inputPath: string): string {
  const abs = resolve(REPO_ROOT, inputPath);
  if (!abs.startsWith(REPO_ROOT + "/") && abs !== REPO_ROOT) {
    throw new Error(`Path escapes repository: ${inputPath}`);
  }
  return abs;
}

export function ensureUiAgentDirs(): void {
  for (const dir of [UI_AGENT_DIR, UI_AGENT_REFERENCES_DIR, UI_AGENT_REPORTS_DIR, UI_AGENT_SESSIONS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
