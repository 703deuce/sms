/**
 * Ensure the ElevenLabs API key is stored as a Telnyx integration secret.
 * api_key_ref uses the secret identifier (never the raw key).
 */

import * as ai from "@/lib/voice/telnyx/ai-client";
import { TelnyxApiError } from "@/lib/voice/telnyx/ai-client";
import { getElevenLabsApiKey, isElevenLabsConfigured } from "./client";
import { ELEVENLABS_SECRET_IDENTIFIER } from "./models";

function unwrapList(res: unknown): Array<Record<string, unknown>> {
  if (!res || typeof res !== "object") return [];
  const data = (res as { data?: unknown }).data;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: Array<Record<string, unknown>> }).data;
  }
  return [];
}

export type ElevenLabsSecretStatus = {
  configuredEnv: boolean;
  secretIdentifier: string;
  secretExists: boolean;
  connected: boolean;
  /** Present only when connected — never includes the key value. */
  apiKeyRef: string | null;
  message: string;
};

export async function getElevenLabsSecretStatus(): Promise<ElevenLabsSecretStatus> {
  const configuredEnv = isElevenLabsConfigured();
  if (!ai.isTelnyxAiConfigured()) {
    return {
      configuredEnv,
      secretIdentifier: ELEVENLABS_SECRET_IDENTIFIER,
      secretExists: false,
      connected: false,
      apiKeyRef: null,
      message: "TELNYX_API_KEY not configured",
    };
  }
  try {
    const listed = await ai.listIntegrationSecrets();
    const rows = unwrapList(listed);
    const found = rows.find(
      (r) => String(r.identifier || "") === ELEVENLABS_SECRET_IDENTIFIER,
    );
    const exists = Boolean(found);
    return {
      configuredEnv,
      secretIdentifier: ELEVENLABS_SECRET_IDENTIFIER,
      secretExists: exists,
      connected: configuredEnv && exists,
      apiKeyRef: exists ? ELEVENLABS_SECRET_IDENTIFIER : null,
      message: exists
        ? "ElevenLabs connected via Telnyx integration secret"
        : configuredEnv
          ? "ELEVENLABS_KEY present — run Connect ElevenLabs to create Telnyx secret"
          : "ELEVENLABS_KEY missing on server",
    };
  } catch (err) {
    return {
      configuredEnv,
      secretIdentifier: ELEVENLABS_SECRET_IDENTIFIER,
      secretExists: false,
      connected: false,
      apiKeyRef: null,
      message: err instanceof Error ? err.message : "Failed to list Telnyx secrets",
    };
  }
}

/**
 * Create (or confirm) Telnyx integration secret from server ELEVENLABS_KEY.
 * Never returns the key value.
 */
export async function ensureElevenLabsTelnyxSecret(): Promise<{
  ok: boolean;
  apiKeyRef: string;
  created: boolean;
  message: string;
}> {
  if (!ai.isTelnyxAiConfigured()) {
    throw new Error("TELNYX_API_KEY not configured");
  }
  const token = getElevenLabsApiKey();
  if (!token) {
    throw new Error(
      "ELEVENLABS_KEY is not configured on the server. Add it in Coolify, then retry Connect ElevenLabs.",
    );
  }

  const status = await getElevenLabsSecretStatus();
  if (status.secretExists) {
    return {
      ok: true,
      apiKeyRef: ELEVENLABS_SECRET_IDENTIFIER,
      created: false,
      message: "Telnyx integration secret already exists",
    };
  }

  try {
    await ai.createIntegrationSecret({
      identifier: ELEVENLABS_SECRET_IDENTIFIER,
      type: "bearer",
      token,
    });
    return {
      ok: true,
      apiKeyRef: ELEVENLABS_SECRET_IDENTIFIER,
      created: true,
      message: "Created Telnyx integration secret elevenlabs_transovo",
    };
  } catch (err) {
    // Identifier collision / already exists → treat as connected.
    if (err instanceof TelnyxApiError && (err.status === 409 || err.status === 422)) {
      return {
        ok: true,
        apiKeyRef: ELEVENLABS_SECRET_IDENTIFIER,
        created: false,
        message: "Telnyx integration secret already present",
      };
    }
    throw err;
  }
}
