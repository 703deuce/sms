import "server-only";

import {
  patchTelnyxNumberConnection,
  readLiveTelnyxConnectionId,
  verifyTelnyxNumberConnection,
} from "@/lib/server/telephony/telnyx-number";

/**
 * Apply Telnyx connection_id only after destination resources are ready; rollback on verify failure.
 */
export async function applyTelnyxConnectionWithVerify(input: {
  e164: string;
  providerNumberId?: string | null;
  targetConnectionId: string;
  priorConnectionId?: string | null;
}): Promise<{
  ok: boolean;
  providerNumberId: string;
  actions: string[];
  error?: string;
}> {
  const actions: string[] = [];
  const live = await readLiveTelnyxConnectionId({
    e164: input.e164,
    providerNumberId: input.providerNumberId,
  });
  const prior = input.priorConnectionId ?? live.connectionId;

  if (live.connectionId === input.targetConnectionId) {
    actions.push("telnyx_already_on_target_connection");
    const verify = await verifyTelnyxNumberConnection({
      providerNumberId: live.providerNumberId,
      expectedConnectionId: input.targetConnectionId,
    });
    if (!verify.ok) {
      return {
        ok: false,
        providerNumberId: live.providerNumberId,
        actions,
        error: "telnyx_verify_failed_existing_connection",
      };
    }
    return { ok: true, providerNumberId: live.providerNumberId, actions };
  }

  try {
    await patchTelnyxNumberConnection({
      providerNumberId: live.providerNumberId,
      connectionId: input.targetConnectionId,
    });
    actions.push(
      prior
        ? `telnyx_rerouted:${prior}->${input.targetConnectionId}`
        : `telnyx_routed:${input.targetConnectionId}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      providerNumberId: live.providerNumberId,
      actions,
      error: `telnyx_patch_failed:${message}`,
    };
  }

  const verify = await verifyTelnyxNumberConnection({
    providerNumberId: live.providerNumberId,
    expectedConnectionId: input.targetConnectionId,
  });
  if (!verify.ok) {
    if (prior && prior !== input.targetConnectionId) {
      try {
        await patchTelnyxNumberConnection({
          providerNumberId: live.providerNumberId,
          connectionId: prior,
        });
        actions.push(`telnyx_rollback:${input.targetConnectionId}->${prior}`);
      } catch (rollbackErr) {
        const rb = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
        actions.push(`telnyx_rollback_failed:${rb}`);
      }
    }
    return {
      ok: false,
      providerNumberId: live.providerNumberId,
      actions,
      error: `telnyx_verify_failed:live=${verify.liveConnectionId || "null"}`,
    };
  }

  actions.push("telnyx_verify_ok");
  return { ok: true, providerNumberId: live.providerNumberId, actions };
}
