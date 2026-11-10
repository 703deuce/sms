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
 * Upload and stream ingest both call this after the source project is READY
 * (`kind: 'upload'` or `kind: 'stream'`, including an existing window project). */
export async function startUnifiedClipRun(
  workspaceId: string,
  opts: UnifiedClipRunRequest,
  userId: string | null = null,
) {
  return createAiProducerAgentRun(workspaceId, userId, buildUnifiedClipRunInput(opts))
}
