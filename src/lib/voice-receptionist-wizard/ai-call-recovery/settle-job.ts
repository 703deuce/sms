import "server-only";

/** No-op — Voice V2 ACR settle jobs are no longer enqueued. */
export async function executeVoiceV2AiCallRecoverySettleJob(
  _payload: Record<string, unknown>,
): Promise<{ ok: true; skipped: true }> {
  return { ok: true, skipped: true };
}
