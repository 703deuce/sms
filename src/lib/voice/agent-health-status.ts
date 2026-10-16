/** Structured VoiceAgent.healthStatus values (String column — no migration). */

export const VOICE_AGENT_HEALTH_OK = "ok";
export const VOICE_AGENT_HEALTH_WARNING = "warning";
export const VOICE_AGENT_HEALTH_ERROR = "error";
/** Draft saved on an ACTIVE agent but published/live config not yet applied. */
export const VOICE_AGENT_HEALTH_LIVE_SYNC_PENDING = "live_sync_pending";

export function isLiveSyncPendingHealthStatus(status: string | null | undefined): boolean {
  return status === VOICE_AGENT_HEALTH_LIVE_SYNC_PENDING;
}
