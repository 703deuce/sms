import { timingSafeEqual } from "node:crypto";
import { getPrisma } from "@/lib/db";
import {
  voiceRuntimeInternalSecret,
  verifyVoiceRuntimeInternalAuth,
} from "@/lib/voice/python-runtime-bridge/auth";

/**
 * Telnyx AI Assistant tool webhooks use the same internal secret as the LiveKit
 * voice-runtime bridge (TRANSOVO_INTERNAL_API_KEY / VOICE_RUNTIME_INTERNAL_SECRET).
 */
export function verifyTelnyxVoiceToolWebhookAuth(request: Request): boolean {
  const secret = voiceRuntimeInternalSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  if (verifyVoiceRuntimeInternalAuth(request.headers.get("authorization"))) {
    return true;
  }
  const headerKey = request.headers.get("x-transovo-internal-api-key")?.trim();
  if (!headerKey || headerKey.length !== secret.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(headerKey), Buffer.from(secret));
  } catch {
    return false;
  }
}

export function applyTelnyxToolWebhookInternalAuthHeaders(headers: Headers): void {
  const secret = voiceRuntimeInternalSecret();
  if (!secret) return;
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${secret}`);
  }
}

export type ToolWebhookTenantBindingResult =
  | { ok: true; callId?: string }
  | { ok: false; reason: "workspace_mismatch" | "agent_mismatch" };

/**
 * When Telnyx supplies call identifiers, they must match the claimed workspace/agent.
 */
export async function assertToolWebhookCallTenantBinding(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string;
  conversationId?: string;
}): Promise<ToolWebhookTenantBindingResult> {
  const prisma = getPrisma();
  const callControlId = input.callControlId?.trim();
  const conversationId = input.conversationId?.trim();

  if (!callControlId && !conversationId) {
    return { ok: true };
  }

  const or: Array<Record<string, string>> = [];
  if (callControlId) or.push({ telnyxCallControlId: callControlId });
  if (conversationId) or.push({ telnyxConversationId: conversationId });

  const call = await prisma.voiceCall.findFirst({
    where: { OR: or },
    select: { id: true, workspaceId: true, agentId: true },
  });

  if (!call) {
    return { ok: true };
  }

  if (call.workspaceId !== input.workspaceId) {
    return { ok: false, reason: "workspace_mismatch" };
  }
  if (input.agentId && call.agentId && call.agentId !== input.agentId) {
    return { ok: false, reason: "agent_mismatch" };
  }

  return { ok: true, callId: call.id };
}
