/**
 * Run the unified-clip auto-start AFTER the progress update has committed, without
 * holding the worker's request open. startUnifiedClipRun can take seconds and holds
 * Prisma pool slots; awaiting it here kept the worker's callback (and, before the
 * worker committed first, its clip_projects row lock) blocked (job_b10ed571).
 * Never throws: failures are logged. The SQL CAS on settings.unifiedClipRunId inside
 * maybeAutoStartUploadAgentBatch remains the double-start guard.
 */
export function scheduleUnifiedAutoStart(
  projectId: string,
  jobId: string,
  start: (projectId: string) => Promise<unknown> = async (id) => {
    const { maybeAutoStartUploadAgentBatch } = await import('@/lib/server/streamer/agent-batch')
    return maybeAutoStartUploadAgentBatch(id)
  },
): Promise<void> {
  const startedAt = Date.now()
  const task = (async () => {
    try {
      // Defer to the next macrotask so nothing in the follow-up runs before the ack.
      await new Promise<void>((resolve) => setImmediate(resolve))
      await start(projectId)
      console.info('[clipper:agent] auto_start_hook_done', {
        projectId,
        jobId,
        latencyMs: Date.now() - startedAt,
      })
    } catch (error) {
      console.error('[clipper:agent] auto_start_hook_failed', {
        projectId,
        jobId,
        error: String(error),
        latencyMs: Date.now() - startedAt,
      })
    }
  })()
  void task
  return task
}
