import "server-only";

export async function runGptLivePstnLeanAnswer(_input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: "voice_v2_gpt_live_lean_removed_use_voice_v3_basic" };
}
