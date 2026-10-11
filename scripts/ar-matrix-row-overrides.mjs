/**
 * Row-level truth for AR completion matrix — implementation-focused overrides.
 */
export const ROW_OVERRIDES = {
  "AR-WS1-01": {
    impl: "complete",
    evidence:
      "`/signup/appointment-reminders` + `?product=appointment_reminders` signup copy; post-signup `assignArFreePlan`; `product-open` for returning users.",
  },
  "AR-WS1-03": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Policy exclusion AR-X-01 — Microsoft Calendar only for v1.",
  },
  "AR-WS2-14": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Google Calendar AR launch excluded (AR-X-01).",
  },
  "AR-WS2-15": {
    impl: "complete",
    evidence:
      "Per-connection `graphCustomerPhonePropertyKeys` in calendar settings UI + `extractPhoneFromExtendedProperties` on import.",
  },
  "AR-WS2-16": {
    impl: "complete",
    evidence:
      "`graphMailboxUserPrincipalName` + verify probes delegated `/users/{upn}/calendars` and surfaces permission errors in calendar verify.",
  },
  "AR-WS2-17": {
    impl: "complete",
    evidence:
      "`importRulesByCalendarId` persisted via calendar PATCH; per-calendar override UI when multiple import calendars selected.",
  },
  "AR-WS3-06": {
    impl: "complete",
    evidence:
      "OAuth includes Contacts.Read; `lookupOutlookContactPhoneByEmail` on import; verify flags missing Contacts permission with reconnect guidance.",
  },
  "AR-WS3-07": {
    impl: "complete",
    evidence:
      "`extractIdentityFromEventFields` for title/description names; `customerFirstName` on import metadata; merge vars from resolved display name.",
  },
  "AR-WS3-08": {
    impl: "complete",
    evidence:
      "`resolveContactForImportedEvent` links/creates contacts by phone when email absent; reuses workspace contact by `workspaceId_phone`.",
  },
  "AR-WS3-12": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Single primary SMS thread v1 (AR-X-05).",
  },
  "AR-WS4-10": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Industry arrival windows out of v1; `appointment_time_range` merge var only.",
  },
  "AR-WS5-05": {
    impl: "complete",
    evidence:
      "Setup configure panel previews real appointments via `GET .../reminders/test?appointmentId=` when staff selects an upcoming row.",
  },
  "AR-WS8-05": {
    impl: "complete",
    auto: "n/a",
    evidence: "Cold-tenant runbook authored in `docs/AR-LAUNCH-READINESS-NOW.md` (operational execution is separate).",
  },
  "AR-WS8-06": {
    impl: "complete",
    evidence: "Throughput harness `scripts/test-ar-reminder-throughput.ts` shipped for load certification.",
  },
};

export function defaultEvidence(id, codePaths, impl) {
  if (impl === "excluded") return "See AR-X policy table.";
  return `Implemented in ${codePaths}.`;
}
