import 'server-only'
import {createAiProducerAgentRun} from '@/lib/server/ai-producer-agent/runs'
import {
  buildUnifiedClipRunInput,
  type UnifiedClipRunRequest,
} from '@/lib/ai-producer-agent/clip-mode/unified-run-input'

export {
  UNIFIED_CLIP_INSTRUCTION,
  buildUnifiedClipRunInput,
  storyTargetFromAgentSeconds,
} from '@/lib/ai-producer-agent/clip-mode/unified-run-input'
export type {
  UnifiedClipRunSource,
  UnifiedClipRunRequest,
} from '@/lib/ai-producer-agent/clip-mode/unified-run-input'

/** One job, one pass: Story + continuous on the same transcript.
 * Regular upload clipping calls this now. Stream clipping can call it later
 * with kind: 'stream' (or a prepared window project). */
export async function startUnifiedClipRun(
  workspaceId: string,
  opts: UnifiedClipRunRequest,
  userId: string | null = null,
) {
  return createAiProducerAgentRun(workspaceId, userId, buildUnifiedClipRunInput(opts))
}
