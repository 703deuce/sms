import "server-only";

/** KIE Market model id — must match createTask `model` (not google/nano-banana-edit). */
export function resolveVisualizerKieModel(): string {
  const configured = process.env.VISUALIZER_KIE_MODEL?.trim();
  if (configured) return configured;
  // Launch default: Nano Banana 2.1 @ 1K (override with VISUALIZER_KIE_MODEL, e.g. nano-banana-pro).
  return "nano-banana-2-1";
}

export function resolveVisualizerKieResolution(): "1K" | "2K" | "4K" {
  const r = process.env.VISUALIZER_KIE_RESOLUTION?.trim();
  if (r === "2K" || r === "4K" || r === "1K") return r;
  return "1K";
}

export function resolveVisualizerKieOutputFormat(): "png" | "jpg" {
  const f = process.env.VISUALIZER_KIE_OUTPUT_FORMAT?.trim()?.toLowerCase();
  if (f === "jpg" || f === "jpeg") return "jpg";
  return "png";
}

export function isVisualizerKieMockMode(): boolean {
  const v = process.env.VISUALIZER_KIE_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export const KIE_JOBS_API_BASE =
  process.env.KIE_API_BASE_URL?.trim().replace(/\/$/, "") || "https://api.kie.ai";

export const KIE_UPLOAD_API_BASE =
  process.env.KIE_UPLOAD_BASE_URL?.trim().replace(/\/$/, "") || "https://kieai.redpandaai.co";

export function getKieApiKey(): string {
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "KIE_API_KEY is not configured. Visualizer image generation requires your KIE.ai API key.",
    );
  }
  return key;
}
