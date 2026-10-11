/**
 * Row-level truth for AR completion matrix integrity pass.
 * Keys: AR-WS* — only include fields that override parsed row defaults.
 */
export const ROW_OVERRIDES = {
  "AR-WS1-01": {
    impl: "partial",
    evidence:
      "Shared Transovo signup + `POST /api/appointment-reminders/product-open` and `billing/free` grant AR entitlement; no dedicated AR-only signup landing or cold-signup E2E. Auto: `api-auth.test.ts`, `test-appointment-reminders-api-isolation.ts`.",
  },
  "AR-WS1-03": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Policy exclusion AR-X-01 — Microsoft Calendar only for v1 (`calendar-provider-policy.ts`).",
  },
  "AR-WS1-13": {
    impl: "complete",
    evidence:
      "`setupConfigureCompletedAt` set via `POST .../setup/configure-complete` from configure panel; `activation.ts` blocks activate until saved (unless grandfather `activatedAt`). Auto: activation gate unit paths in cert static checks.",
  },
  "AR-WS2-14": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Google Calendar AR launch excluded (AR-X-01).",
  },
  "AR-WS2-15": {
    impl: "partial",
    evidence:
      "`graph-extended-phone.ts` reads `AR_GRAPH_CUSTOMER_PHONE_PROPERTY_KEYS` on Graph events; no per-tenant UI field mapping spec. Auto: `graph-extended-phone.test.ts`.",
  },
  "AR-WS2-16": {
    impl: "partial",
    evidence:
      "`graphMailboxUserPrincipalName` on connection config + Graph URL helpers for delegated/shared mailbox; no automated Graph permission probe or admin UX for consent errors. Auto: static paths in cert.",
  },
  "AR-WS2-17": {
    impl: "partial",
    prod: "not_run",
    evidence:
      "`importRulesByCalendarId` + `resolveImportRulesForCalendar` in `import-sync.ts`; calendar settings UI still edits connection-level rules only. Auto: `import-rules.test.ts`.",
  },
  "AR-WS3-06": {
    impl: "partial",
    evidence:
      "`outlook-contact-phone.ts` + `enrichContactWithOutlookGraphPhone` on import; requires live `Contacts.Read` token — reconnect UX not fully certified. Auto: import path static.",
  },
  "AR-WS3-07": {
    impl: "partial",
    evidence:
      "Merge vars from `inviteeName`; `attendee-contact.ts` uses `extractIdentityFromEventFields` when subject/description has name — title-only events remain weak. Auto: `reminder-phone-extraction.test.ts` (phone not name).",
  },
  "AR-WS3-08": {
    impl: "partial",
    evidence:
      "`resolveContactForImportedEvent` links CRM contact by attendee email only; phone-only appointments have no durable cross-appointment identity. Auto: DB isolation smoke only.",
  },
  "AR-WS3-10": {
    impl: "complete",
    evidence:
      "`enrichImportMetadataWithRecipientSuppression` on import (`import-sync.ts`); `sms-eligibility.ts` blocks send when `recipientOptedOut`/`smsOptOut`; platform `suppression` + contact UNSUBSCRIBED. Auto: `ar-recipient-suppression.test.ts`, `sms-eligibility.test.ts`. Live re-import E2E not_run.",
  },
  "AR-WS3-12": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence: "Single primary SMS thread v1 (AR-X-05); `extraRecipients` not productized.",
  },
  "AR-WS4-10": {
    impl: "excluded",
    auto: "n/a",
    prod: "n/a",
    evidence:
      "Industry-specific arrival windows out of v1; generic `appointment_time_range` merge var in `appointments-service.ts` only.",
  },
  "AR-WS5-05": {
    impl: "partial",
    evidence:
      "Test SMS endpoint + drawer preview use sample/fixture appointment, not staff-selected live calendar row. Auto: `sendTestReminderSms` paths in API isolation tests.",
  },
  "AR-WS5-08": {
    impl: "complete",
    evidence:
      "`notifyArStaffOfReminderDeliveryFailure` emails/SMS `replyDestinationEmail`/`replyDestinationPhone` from connection defaults; invoked from `reminder-dispatch-executor.ts` on terminal failure. Live Brevo/Telnyx staff alert not_run.",
  },
  "AR-WS8-05": {
    impl: "partial",
    auto: "n/a",
    evidence:
      "Golden-tenant steps documented in `docs/AR-LAUNCH-READINESS-NOW.md`; no recorded production cold-tenant PASS/FAIL execution in this branch.",
  },
  "AR-WS8-06": {
    impl: "partial",
    evidence: "`scripts/test-ar-reminder-throughput.ts` exists; 600-appointment throughput run not executed in CI or prod.",
  },
  "AR-WS8-07": {
    impl: "complete",
    auto: "pass",
    prod: "n/a",
    evidence:
      "AR gate row added to `docs/V1-PRODUCTION-CERTIFICATION.md` pointing at matrix + runbook (doc update on branch; not a live cert execution).",
  },
};

/** Default evidence when row is complete and no override text */
export function defaultEvidence(id, codePaths, impl) {
  if (impl === "excluded") return "See AR-X policy table.";
  if (impl === "partial") return `Partial — see ${codePaths}; production verification pending.`;
  return `Implemented in ${codePaths}; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass.`;
}
