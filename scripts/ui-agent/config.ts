import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ViewportConfig, ViewportPreset } from "./types";

export const REPO_ROOT = resolve(join(import.meta.dirname, "..", ".."));

export const UI_AGENT_DIR = join(REPO_ROOT, ".ui-agent");
export const UI_AGENT_REFERENCES_DIR = join(UI_AGENT_DIR, "references");
export const UI_AGENT_REPORTS_DIR = join(UI_AGENT_DIR, "reports");
export const UI_AGENT_SESSIONS_DIR = join(UI_AGENT_DIR, "sessions");
export const UI_AGENT_GENERATED_DIR = join(UI_AGENT_DIR, "generated");
export const UI_AGENT_CURRENT_DIR = join(UI_AGENT_DIR, "current");
export const UI_AGENT_UPLOADS_DIR = join(UI_AGENT_DIR, "uploads");
export const UI_AGENT_CACHE_DIR = join(UI_AGENT_DIR, "cache");
export const KIMI_UI_REFERENCES_PATH = "/transovo/kimi";
export const kimiUiPreviewPath = (sessionId: string) => `/transovo/kimi/preview/${sessionId}`;

export const KIMI_BASE_URL = "https://api.moonshot.ai/v1";
export const KIMI_MODEL = "kimi-k3";
/** K3 defaults to max reasoning if omitted — use low for visual UI codegen. */
export type KimiReasoningEffort = "low" | "high" | "max";
export const KIMI_REASONING_EFFORT: KimiReasoningEffort =
  (process.env.KIMI_REASONING_EFFORT?.trim() as KimiReasoningEffort) || "low";
export const KIMI_MAX_OUTPUT_TOKENS = process.env.KIMI_MAX_OUTPUT_TOKENS
  ? Number(process.env.KIMI_MAX_OUTPUT_TOKENS)
  : undefined;

/** Minimal stack context for first-pass visual UI generation — integration happens later. */
export const MINIMAL_UI_STACK_CONTEXT = `UI STACK (existing app — do NOT scaffold a new project):
- Next.js App Router, React, TypeScript
- Tailwind CSS + project tokens (bg-card, text-foreground, border-border, muted-foreground)
- lucide-react icons
- Brand: Transovo (not competitor names/logos)
- Sandbox only: page.tsx, components/**, mock-data.ts, reference.css
- Use mock data in mock-data.ts; Cursor integrates into production later`;
/** @deprecated Use KIMI_BASE_URL */
export const DEFAULT_KIMI_BASE_URL = KIMI_BASE_URL;

export const VIEWPORT_PRESETS: Record<ViewportPreset, ViewportConfig> = {
  desktop: { name: "desktop", width: 1440, height: 900 },
  mobile: { name: "mobile", width: 390, height: 844 },
  tablet: { name: "tablet", width: 768, height: 1024 },
};

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Kimi chat/completions — video analysis + code generation can take a long time. */
export const KIMI_CHAT_TIMEOUT_MS = Number(process.env.KIMI_CHAT_TIMEOUT_MS || 60 * 60 * 1000);
/** Wait for Kimi Files API to finish processing an uploaded video. */
export const KIMI_FILE_READY_TIMEOUT_MS = Number(process.env.KIMI_FILE_READY_TIMEOUT_MS || 15 * 60 * 1000);
/** Heartbeat log interval while waiting on Kimi HTTP. */
export const KIMI_PROGRESS_HEARTBEAT_MS = Number(process.env.KIMI_PROGRESS_HEARTBEAT_MS || 15_000);
export const KIMI_FILE_UPLOAD_TIMEOUT_MS = Number(process.env.KIMI_FILE_UPLOAD_TIMEOUT_MS || 20 * 60 * 1000);

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

/**
 * Shared integration philosophy for ui:integrate prompts and Cursor agents.
 * Kimi delivers 0→85–95% visual implementation; integration delivers 85–95%→production.
 */
export const INTEGRATION_PRINCIPLES = `Kimi's generated UI is not merely a design reference — it is the STARTING FRONTEND IMPLEMENTATION.

ROLE SPLIT:
- Kimi: reference video/screenshots → runnable sandbox UI (mock data OK in .ui-agent/generated/)
- Cursor/integration: approved Kimi visual result + Transovo production functionality

REUSE STRATEGY:
- Reuse 80–90% of Kimi's presentation code where practical (JSX structure, classNames, layout, spacing, transitions, modals, visual states).
- Visual fidelity matters MORE than preserving exact generated source code.
- Do NOT feel obligated to preserve Kimi's code line-for-line.

REFACTOR FREELY when integrating:
- Replace Kimi local state (e.g. useState("all")) with existing production hooks (e.g. useConversationFilters()).
- Merge Kimi JSX/classes into EXISTING production components when one already exists — do not create parallel Reference* components unless necessary.
- Swap in real data, handlers, APIs, routing, design-system primitives, accessibility fixes, and performance improvements.
- Refactoring must NOT materially degrade the approved visual result.

NEVER INTO PRODUCTION:
- mock-data.ts, MOCK_* constants, fake handlers, or imports from .ui-agent/generated/
- Changes to src/lib, src/app/api, prisma, providers, auth, or billing

GOAL:
Kimi-created visual result + Transovo production functionality.
NOT exact source-code preservation.

FINAL VISUAL CHECK:
Compare the APPROVED Kimi sandbox render (screenshot.png / preview) against production AFTER integration.
Do NOT compare production against the original competitor reference video — the approved Kimi render is the target.`;

/**
 * Video must use Kimi Files API + ms:// native multimodal delivery.
 * Never base64-embed full video files into prompt text.
 */
export const VIDEO_DELIVERY_PRINCIPLES = `VIDEO DELIVERY REQUIREMENT

Do NOT base64-embed full video files into ordinary prompt text.
Do NOT automatically convert videos into large sets of screenshots unless native video delivery is unavailable.

Use Kimi's supported native video/media-upload mechanism for the configured video-capable model (e.g. kimi-k3).

Expected pipeline:
  Supabase Storage reference (private)
    → stream bytes in memory (no disk cache required for video)
    → POST /v1/files (purpose=video)
    → if status=ready, proceed immediately (no mandatory processing poll)
    → persist ms://<file_id> per reference in .ui-agent/cache/kimi-file-ids.json
    → reuse cached ms:// on later sessions (skip Supabase + Kimi re-upload)
    → ms://<file_id> in video_url content part

Do NOT use signed Supabase HTTPS URLs on chat/completions — Kimi rejects them.
Do NOT base64-embed full video files.

Keep the textual request lightweight. The prompt references attached native video and provides:
- target Transovo route
- user instruction
- current-page screenshots (images only — compact data URLs OK)
- relevant frontend context / environment manifest

Do not waste model context by serializing video bytes into text.

File size: default API limit 100MB. Do not assume VS Code's 20MB UI picker limit applies to the API.`;

export type KimiRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsImage: boolean;
  supportsVideo: boolean;
  reasoningEffort: KimiReasoningEffort;
  maxOutputTokens?: number;
};

export function loadKimiConfig(): KimiRuntimeConfig {
  const apiKey = process.env.KIMI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error("KIMI_API_KEY is required. Set it in your environment — never commit API keys.");
  }
  const model = process.env.KIMI_MODEL?.trim() || KIMI_MODEL;
  return {
    apiKey,
    baseUrl: KIMI_BASE_URL,
    model,
    supportsImage: true,
    supportsVideo: true,
    reasoningEffort: (process.env.KIMI_REASONING_EFFORT?.trim() as KimiReasoningEffort) || KIMI_REASONING_EFFORT,
    maxOutputTokens: KIMI_MAX_OUTPUT_TOKENS,
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
  for (const dir of [
    UI_AGENT_DIR,
    UI_AGENT_REFERENCES_DIR,
    UI_AGENT_REPORTS_DIR,
    UI_AGENT_SESSIONS_DIR,
    UI_AGENT_GENERATED_DIR,
    UI_AGENT_CURRENT_DIR,
    UI_AGENT_UPLOADS_DIR,
    UI_AGENT_CACHE_DIR,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
