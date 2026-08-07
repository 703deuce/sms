/**
 * Regression fixture — live call blocked by AI approval policy on Calendly availability.
 * Call cmsi8r1z50y2e6p183r1t4619 (Aug 7 2026 ~1:03 AM ET).
 *
 * Scenario: Calendly connected + healthy + live caller + approved Amy config
 * → appointment.list_available_times must succeed without interactive owner approval.
 */
export const LIVE_AGENT_CALENDLY_POLICY_REGRESSION = {
  callId: "cmsi8r1z50y2e6p183r1t4619",
  agentId: "cmshz2lc25c622c4i58303501",
  agentVersionId: "cmsi69wq45b0x4s4v5h08651c",
  workspaceId: "ws_1",
  failedAt: "2026-08-07T01:03:29.187Z",
  actionId: "appointment.list_available_times",
  previousSource: "ai",
  previousError:
    "Calendly list available times failed (POLICY: Approval required before execution). Reconnect Calendly or check integration write settings — bookings cannot use the internal calendar while Calendly is connected.",
  toolInput: {
    toolType: "calendar_availability",
    serviceName: "Service Visit",
    from: "2026-08-07T12:00:00.000Z",
    to: "2026-08-07T22:00:00.000Z",
  },
  expectedSourceAfterFix: "live_agent",
  expectedPolicyAllowed: true,
} as const;
