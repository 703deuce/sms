import { getPrisma } from "@/lib/db";
import { loadAgentRuntime, saveAgentRuntime } from "./runtime-state";

const WRITE_LOCK_KEY = "activeWriteLock";

export type WriteLock = {
  operation_id: string;
  tool: string;
  started_at: string;
};

export async function acquireWriteLock(input: {
  callId: string;
  operationId: string;
  tool: string;
}): Promise<{ acquired: boolean; existing?: WriteLock }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const existing = meta[WRITE_LOCK_KEY] as WriteLock | undefined;
  if (existing && existing.operation_id !== input.operationId) {
    return { acquired: false, existing };
  }
  const lock: WriteLock = {
    operation_id: input.operationId,
    tool: input.tool,
    started_at: new Date().toISOString(),
  };
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: { metadata: { ...meta, [WRITE_LOCK_KEY]: lock } },
  });
  const runtime = await loadAgentRuntime(input.callId);
  if (runtime) {
    await saveAgentRuntime(input.callId, {
      ...runtime,
      pending_operations: [...new Set([...runtime.pending_operations, input.operationId])],
    });
  }
  return { acquired: true };
}

export async function releaseWriteLock(callId: string, operationId: string): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const existing = meta[WRITE_LOCK_KEY] as WriteLock | undefined;
  if (existing?.operation_id === operationId) {
    const { [WRITE_LOCK_KEY]: _, ...rest } = meta;
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { metadata: rest },
    });
  }
  const runtime = await loadAgentRuntime(callId);
  if (runtime) {
    await saveAgentRuntime(callId, {
      ...runtime,
      pending_operations: runtime.pending_operations.filter((id) => id !== operationId),
    });
  }
}

export async function getActiveWriteLock(callId: string): Promise<WriteLock | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  return (meta[WRITE_LOCK_KEY] as WriteLock) || null;
}
