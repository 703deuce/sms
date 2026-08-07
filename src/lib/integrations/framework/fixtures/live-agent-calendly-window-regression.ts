/**
 * Regression fixture — Calendly invalid params when from=to (point-in-time availability).
 * Call cmsibcgza1o3b3t2m3q44122v (Aug 7 2026 ~2:16 AM UTC).
 */
export const LIVE_AGENT_CALENDLY_WINDOW_REGRESSION = {
  callId: "cmsibcgza1o3b3t2m3q44122v",
  agentId: "cmshz2lc25c622c4i58303501",
  failedAt: "2026-08-07T02:16:48.064Z",
  calendarInput: {
    from: "2026-08-07T18:00:00.000Z",
    to: "2026-08-07T18:00:00.000Z",
    serviceName: "Service Visit",
  },
  previousError:
    "Calendly list available times failed: The supplied parameters are invalid.",
  expectedWindow: {
    startTime: "2026-08-07T18:00:00.000Z",
    endTime: "2026-08-08T18:00:00.000Z",
  },
} as const;
