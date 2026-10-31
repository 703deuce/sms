/**
 * E6: export status polling with one request in flight, a per-request timeout, and stale
 * responses dropped. Before, every 2s tick fired a new request with no timeout or ordering, and
 * any poll error flipped the toast to "failed" while the dialog kept showing the last progress
 * (the worker's pre-upload 82%) until the page was reloaded.
 */
export const EXPORT_POLL_INTERVAL_MS = 2000
export const EXPORT_POLL_TIMEOUT_MS = 15_000
export const EXPORT_POLL_MAX_ERRORS = 5

export type ExportStatusPoll = { pollNow: () => void; stop: () => void }

export function startExportStatusPoll<T>(opts: {
  fetchStatus: () => Promise<T>
  onResult: (r: T) => void
  /** `streak` = consecutive failures; callers settle UI only at EXPORT_POLL_MAX_ERRORS. */
  onError: (message: string, streak: number) => void
  intervalMs?: number
  timeoutMs?: number
}): ExportStatusPoll {
  let stopped = false
  let inFlight = false
  let seq = 0
  let streak = 0
  const timeoutMs = opts.timeoutMs ?? EXPORT_POLL_TIMEOUT_MS
  const pollNow = () => {
    if (stopped || inFlight) return
    inFlight = true
    const mySeq = ++seq
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Export status check timed out')), timeoutMs)
    })
    Promise.race([opts.fetchStatus(), timeout])
      .then((r) => {
        if (stopped || mySeq !== seq) return
        streak = 0
        opts.onResult(r)
      })
      .catch((e: unknown) => {
        if (stopped || mySeq !== seq) return
        streak += 1
        opts.onError(e instanceof Error ? e.message : 'Could not check export status', streak)
      })
      .finally(() => {
        if (timer) clearTimeout(timer)
        inFlight = false
      })
  }
  const t = setInterval(pollNow, opts.intervalMs ?? EXPORT_POLL_INTERVAL_MS)
  pollNow()
  return {
    pollNow,
    stop: () => {
      stopped = true
      clearInterval(t)
    },
  }
}
