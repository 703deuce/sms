import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";

export async function beginLiveVoiceToolExecution(input: {
  workspaceId: string;
  callId: string;
  toolName: string;
  toolInvocationId: string;
  args: Record<string, unknown>;
}): Promise<string | null> {
  const prisma = getPrisma();
  const execution = await prisma.voiceToolExecution
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        toolId: null,
        status: "running",
        input: {
          transport: "openai_live",
          toolType: input.toolName,
          tool_invocation_id: input.toolInvocationId,
          ...input.args,
        } as Prisma.InputJsonValue,
        isAsync: false,
      },
    })
    .catch((err) => {
      console.warn(
        `LIVE_TOOL_EXECUTION_CREATE_FAILED ${JSON.stringify({
          call_id: input.callId,
          tool_name: input.toolName,
          error: err instanceof Error ? err.message : String(err),
        })}`,
      );
      return null;
    });
  return execution?.id ?? null;
}

export async function finishLiveVoiceToolExecution(input: {
  executionId: string | null;
  status: "completed" | "failed";
  output?: Record<string, unknown> | string;
  errorMessage?: string;
  latencyMs: number;
}): Promise<void> {
  if (!input.executionId) return;
  const prisma = getPrisma();
  let outputJson: Prisma.InputJsonValue | undefined;
  if (input.output != null) {
    if (typeof input.output === "string") {
      try {
        outputJson = JSON.parse(input.output) as Prisma.InputJsonValue;
      } catch {
        outputJson = { raw: input.output };
      }
    } else {
      outputJson = input.output as Prisma.InputJsonValue;
    }
  }
  await prisma.voiceToolExecution
    .update({
      where: { id: input.executionId },
      data: {
        status: input.status,
        output: outputJson,
        errorMessage: input.errorMessage ?? null,
        latencyMs: input.latencyMs,
        completedAt: new Date(),
      },
    })
    .catch(() => undefined);
}
