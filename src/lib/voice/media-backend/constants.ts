import type { MediaBackendMode } from "./types";

/**
 * Frozen Transovo media-plane infrastructure (non-secret).
 * API keys stay in env; these IDs/hosts should not drift via Coolify typos.
 *
 * @see docs/snapshots/self-hosted-livekit-working-2026-08-24.json
 */
export const LIVEKIT_SELF_HOSTED_WSS_URL = "wss://voice.transovo.ai";
export const LIVEKIT_SELF_HOSTED_SIP_HOST = "voice.transovo.ai";
export const LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID = "ST_acZETLdoDQ8o";
export const LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID = "SDR_anLzF5j5kqpU";

/** Superseded trunk — restrictive allowlist; never use for new provisioning. */
export const LIVEKIT_SELF_HOSTED_STALE_INBOUND_TRUNK_ID = "ST_9v6jM2L5ktzr";

/** LiveKit Cloud project trunks (571 / MCTB platform demo). */
export const LIVEKIT_CLOUD_INBOUND_TRUNK_ID = "ST_niZH3LgKj7Po";
export const LIVEKIT_CLOUD_DISPATCH_RULE_ID = "SDR_6rYudQdFWV7R";

/** Production default — LiveKit Cloud (self-hosted voice server removed). */
export const DEFAULT_MEDIA_BACKEND_MODE: MediaBackendMode = "livekit_cloud";
