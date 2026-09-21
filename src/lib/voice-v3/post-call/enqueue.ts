import "server-only";

import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function enqueueVoiceV3PostCallJob(input: {
  workspaceId: string;
  callId: string;
  delaySeconds?: number;
}): Promise<void> {
  const delaySeconds = input.delaySeconds ?? 0;
  await enqueueJob({
    jobType: "voice_v3_post_call",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: { callId: input.callId, workspaceId: input.workspaceId },
    idempotencyKey: `voice-v3-post-call:${input.callId}`,
    runAfter: new Date(Date.now() + delaySeconds * 1000),
    wake: delaySeconds === 0,
  }).catch(() => undefined);
}
