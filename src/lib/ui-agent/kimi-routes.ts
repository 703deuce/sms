/** Transovo Kimi UI tool routes (production-accessible internal tooling). */

export const KIMI_UI_BASE = "/transovo/kimi";
export const KIMI_UI_REFERENCES_PATH = "/transovo/kimi";
export const KIMI_UI_PREVIEW_PATH = (sessionId: string) => `/transovo/kimi/preview/${sessionId}`;

export const KIMI_API_BASE = "/api/transovo/kimi";
export const KIMI_API_REFERENCES = "/api/transovo/kimi/references";
export const KIMI_API_REFERENCES_PREPARE = "/api/transovo/kimi/references/prepare";
export const KIMI_API_REFERENCES_COMPLETE = "/api/transovo/kimi/references/complete";
export const KIMI_API_SESSION = (sessionId: string) => `/api/transovo/kimi/sessions/${sessionId}`;
export const KIMI_API_PREVIEW = (sessionId: string) => `/api/transovo/kimi/preview/${sessionId}`;

export function isKimiUiEnabled(): boolean {
  return true;
}
